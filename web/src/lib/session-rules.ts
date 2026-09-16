import { ApiError } from "./api";

export const alignmentCodes = [
  "LAWFUL_GOOD", "LAWFUL_NEUTRAL", "LAWFUL_EVIL", "NEUTRAL_GOOD", "TRUE_NEUTRAL",
  "NEUTRAL_EVIL", "CHAOTIC_GOOD", "CHAOTIC_NEUTRAL", "CHAOTIC_EVIL",
] as const;
export type AlignmentCode = typeof alignmentCodes[number];
type Pole = "LAWFUL" | "CHAOTIC" | "GOOD" | "EVIL";
type Axis = { negative: Pole; positive: Pole };
export type SessionRules = {
  version: 1;
  alignment_thresholds: { negative: -3; positive: 3 };
  alignment_axes: { x: Axis; y: Axis };
  interpretations: Record<AlignmentCode, string>;
  initial_city_state: { happiness: number; safety: number; cleanliness: number };
  initial_region_pollution: Record<string, number>;
  zero_response_policy: "INCLUDE" | "EXCLUDE";
  completion_policy: "DRAIN";
};

function invalid(message: string): never {
  throw new ApiError(409, "INVALID_RULES", message);
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid("규칙 항목은 객체여야 합니다.");
  return value as Record<string, unknown>;
}
function axis(value: unknown): "ORDER" | "MORALITY" {
  const a = object(value);
  const pair = [a.negative, a.positive].sort().join(",");
  if (pair === "CHAOTIC,LAWFUL") return "ORDER";
  if (pair === "EVIL,GOOD") return "MORALITY";
  return invalid("축의 양/음 방향에 서로 반대인 성향을 지정해야 합니다.");
}
function initial(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100)
    invalid("초기 상태는 유한한 0~100 숫자여야 합니다.");
}

// Missing product decisions fail closed instead of assigning an inferred interpretation.
export function validateRules(value: unknown, regionCodes: string[]): SessionRules {
  const r = object(value);
  if (r.version !== 1 || r.completion_policy !== "DRAIN") invalid("version=1, completion_policy=DRAIN 규칙이 필요합니다.");
  const thresholds = object(r.alignment_thresholds);
  if (thresholds.negative !== -3 || thresholds.positive !== 3) invalid("성향 경계는 -3과 3이어야 합니다.");
  const axes = object(r.alignment_axes);
  if (axis(axes.x) === axis(axes.y)) invalid("질서/혼돈과 선/악 축을 각각 지정해야 합니다.");
  const interpretations = object(r.interpretations);
  for (const code of alignmentCodes) {
    const text = interpretations[code];
    if (typeof text !== "string" || !text.trim() || text.length > 10_000) invalid(`${code} 해석 문구가 필요합니다(최대 10000자).`);
  }
  const city = object(r.initial_city_state);
  for (const key of ["happiness", "safety", "cleanliness"]) initial(city[key]);
  const regions = object(r.initial_region_pollution);
  if (Object.keys(regions).length !== regionCodes.length) invalid("모든 지역의 초기 오염 값을 지정해야 합니다.");
  for (const code of regionCodes) {
    if (!Object.hasOwn(regions, code)) invalid(`${code} 지역 초기값이 없습니다.`);
    initial(regions[code]);
  }
  if (r.zero_response_policy !== "INCLUDE" && r.zero_response_policy !== "EXCLUDE") invalid("무응답 결과 정책(INCLUDE/EXCLUDE)이 필요합니다.");
  return r as SessionRules;
}

export function classifyAlignment(x: string, y: string, rules: SessionRules): AlignmentCode {
  let order = "NEUTRAL", morality = "NEUTRAL";
  for (const [value, a] of [[x, rules.alignment_axes.x], [y, rules.alignment_axes.y]] as const) {
    const score = BigInt(value);
    const pole = score <= BigInt(-3) ? a.negative : score >= BigInt(3) ? a.positive : "NEUTRAL";
    if (a.positive === "LAWFUL" || a.positive === "CHAOTIC") order = pole;
    else morality = pole;
  }
  return (order === "NEUTRAL" && morality === "NEUTRAL" ? "TRUE_NEUTRAL" : `${order}_${morality}`) as AlignmentCode;
}
