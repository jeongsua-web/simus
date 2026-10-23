// Public URL routing is fixed, never derived from a request or filesystem path.
export const V002_MAP_VERSION = "test-only-city-rebuild-v002-webgl-v1";
export const V002_PATH_VERSION = "city-rebuild-v002-walk-v1";
export const V002_PHASE1_MAP_VERSION = "test-only-city-rebuild-v002-phase1-v1";
export const V002_PHASE1_PATH_VERSION = "city-rebuild-v002-walk-phase1-v1";
export const isCityV002Map = (version: string) => version === V002_MAP_VERSION || version === V002_PHASE1_MAP_VERSION;
export function cityBuildBase(mapVersion: string) {
  if (mapVersion === V002_PHASE1_MAP_VERSION) return "/city-rebuild-v002-phase1";
  return mapVersion === V002_MAP_VERSION ? "/city-rebuild-v002" : "/city";
}
