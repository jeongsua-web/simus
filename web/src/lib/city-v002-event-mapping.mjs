import manifest from './data/city-v002-event-mapping.json' with { type: 'json' };
import { MAP_VERSION, PATH_VERSION, isV002MapVersion, locate, routeBetween, nodePoint } from './city-v002-graph.mjs';

export const eventManifest = manifest;
export const eventMapping = code => manifest.events.find(row => row.code === code);
const graphPoints = new Map();

// Existing mappings are never replaced by the manifest at runtime. It only
// prevents unfinished authored scenes from firing at legacy saved coordinates.
export function playableLocation(code, location) {
  if (!location) return false;
  if (!isV002MapVersion(location.map_version)) return true;
  const mapping = eventMapping(code);
  if (mapping && mapping.status !== 'READY') return false;
  try {
    const key = JSON.stringify([location.map_version, location.point]);
    if (!graphPoints.has(key)) {
      locate(location.point, location.map_version);
      if (graphPoints.size >= 2048) graphPoints.clear();
      graphPoints.set(key, true);
    }
    return location.radius_m > 0 && Number.isFinite(location.radius_m);
  } catch { return false; }
}

// Called during DRAFT preparation, not automatically at server startup.
export function preparedLocation(code) {
  const row = eventMapping(code);
  if (!row || row.status !== 'READY') return null;
  if (manifest.map_version !== MAP_VERSION || manifest.path_version !== PATH_VERSION ||
      !playableLocation(code, row.event_location)) throw Error(`Unreachable mapping: ${code}`);
  routeBetween(nodePoint('CAMPUS_PLAZA'), row.event_location.point);
  return row.event_location;
}
