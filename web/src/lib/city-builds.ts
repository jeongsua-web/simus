// Public URL routing is fixed, never derived from a request or filesystem path.
export const V002_MAP_VERSION = "test-only-city-rebuild-v002-webgl-v1";
export const V002_PATH_VERSION = "city-rebuild-v002-walk-v1";
export function cityBuildBase(mapVersion: string) {
  return mapVersion === V002_MAP_VERSION ? "/city-rebuild-v002" : "/city";
}
