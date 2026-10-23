import { readFile, readdir, access } from "node:fs/promises";
import path from "node:path";
import { ApiError } from "./api";
import { cityBuildBase, isCityV002Map, V002_PHASE1_MAP_VERSION } from "./city-builds";
import { graphForMap, isGraphSegment, locate } from "./city-v002-graph.mjs";
import { validateMotion } from "./npc-position-sync";
import { assertLocationGroups } from "./event-locations";

// Optional root supports packaged deployments and disposable integration fixtures.
// The URL mapping remains fixed; there is no request-controlled path or validation bypass.
export async function assertSessionBuild(motion: unknown) {
  if (!motion) throw new ApiError(409, "NPC_MOTION_NOT_CONFIGURED", "회차의 NPC 맵과 경로를 먼저 설정해주세요.");
  const m = motion as Record<string, unknown>;
  try { validateMotion(m); }
  catch { throw new ApiError(409, "NPC_PATH_INCOMPATIBLE", "회차의 경로 버전 또는 NPC 보행 경로 데이터가 호환되지 않습니다."); }
  const base = cityBuildBase(m.map_version as string);
  const root = path.join(/* turbopackIgnore: true */ process.env.SIMUS_WEBGL_PUBLIC_ROOT || path.join(process.cwd(), "public"), base);
  let build;
  try {
    build = JSON.parse(await readFile(path.join(root, "build.json"), "utf8"));
    if (!build || typeof build !== "object" || typeof build.map_version !== "string" ||
        (build.path_versions !== undefined && (!Array.isArray(build.path_versions) || build.path_versions.some((v: unknown) => typeof v !== "string"))))
      throw Error("Invalid manifest");
    await Promise.all([access(path.join(root, "index.html")), access(path.join(root, "bridge.js"))]);
    const files = await readdir(path.join(root, "Build"));
    if (![".loader.js", ".framework.js", ".wasm", ".data"].every(suffix => files.some(name => name.endsWith(suffix)))) throw Error("Incomplete build");
  } catch { throw new ApiError(409, "CITY_BUILD_UNAVAILABLE", `${base} WebGL 배포 파일을 확인할 수 없습니다. 회차를 시작할 수 없습니다.`); }
  if (build.protocol_version !== 1 || build.map_version !== m.map_version)
    throw new ApiError(409, "CITY_MAP_MISMATCH", `회차 맵(${m.map_version})과 배포 맵(${build.map_version ?? "미설정"})이 다릅니다.`);
  if (build.npc_motion_enabled === false)
    throw new ApiError(409, "CITY_NPC_DISABLED", "배포된 WebGL은 지도 표시 전용입니다. NPC 지원 빌드가 필요합니다.");
  if (Array.isArray(build.path_versions) && !build.path_versions.includes(m.path_version))
    throw new ApiError(409, "NPC_PATH_INCOMPATIBLE", `배포 빌드가 회차 경로 버전(${m.path_version})을 지원하지 않습니다.`);
  if (isCityV002Map(m.map_version as string)) {
    const graph = graphForMap(m.map_version as string);
    if (m.path_version !== graph.path_version ||
        build.kind !== "city-rebuild-v002-session" || build.npc_motion_enabled !== true || !build.path_versions?.includes(graph.path_version))
      throw new ApiError(409, "NPC_PATH_INCOMPATIBLE", "v002 서버 그래프·회차 경로·WebGL 지원 버전이 일치하지 않습니다.");
    // Phase 1 must be rebuilt from the matching saved scene; a legacy binary cannot pass as Phase 1.
    if (m.map_version === V002_PHASE1_MAP_VERSION && build.source_scene_sha256 !== graph.source_sha256)
      throw new ApiError(409, "NPC_PATH_INCOMPATIBLE", "Phase 1 씬과 WebGL 빌드의 기준 파일이 일치하지 않습니다.");
    const points = m.points as number[][];
    const legs = m.loop ? [...points, points[0]] : points;
    if (legs.slice(1).some((point, i) => !isGraphSegment(legs[i], point, m.map_version as string)))
      throw new ApiError(409, "NPC_PATH_INCOMPATIBLE", "v002 NPC 경로가 배포 맵의 보행 그래프를 벗어납니다.");
  }
}

export function assertEventLocations(motion: { map_version: string }, locations: unknown[]) {
  if (!isCityV002Map(motion.map_version)) {
    assertLocationGroups(locations, motion.map_version);
    return;
  }
  for (const item of locations) {
    const location = item as { map_version: string; point: number[] };
    try {
      if (location.map_version !== motion.map_version) throw Error("Wrong map");
      locate(location.point, motion.map_version);
    } catch { throw new ApiError(409, "EVENT_MAP_INCOMPATIBLE", "v002 상황 위치의 맵 버전과 보행 그래프 좌표를 확인해주세요."); }
  }
  assertLocationGroups(locations, motion.map_version);
}
