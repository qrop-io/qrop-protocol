// Default farm data for simulation — a small field in the French countryside

import type { GeoPosition, GeoJSONPolygon } from "../../src/types";

export interface FarmConfig {
  farm_id: string;
  coordinator_id: string;
  name: string;
  center: GeoPosition;
  boundary: GeoJSONPolygon;
}

// Default: ~100m x 80m field near Toulouse, France
export const DEFAULT_FARM: FarmConfig = {
  farm_id: "farm-sim-001",
  coordinator_id: "coord-sim-001",
  name: "Simulator Farm",
  center: { lat: 43.6045, lon: 1.4440 },
  boundary: {
    type: "Polygon",
    coordinates: [
      [
        [1.4435, 43.6041],
        [1.4445, 43.6041],
        [1.4445, 43.6049],
        [1.4435, 43.6049],
        [1.4435, 43.6041],
      ],
    ],
  },
};

/** Generate a lawn-mower pattern of waypoints within the farm boundary */
export function generateScanWaypoints(
  farm: FarmConfig,
  rows: number = 8
): GeoPosition[] {
  const coords = farm.boundary.coordinates[0];
  const minLon = Math.min(...coords.map((c) => c[0]));
  const maxLon = Math.max(...coords.map((c) => c[0]));
  const minLat = Math.min(...coords.map((c) => c[1]));
  const maxLat = Math.max(...coords.map((c) => c[1]));

  const waypoints: GeoPosition[] = [];
  for (let i = 0; i < rows; i++) {
    const lat = minLat + ((maxLat - minLat) * i) / (rows - 1);
    if (i % 2 === 0) {
      waypoints.push({ lat, lon: minLon });
      waypoints.push({ lat, lon: maxLon });
    } else {
      waypoints.push({ lat, lon: maxLon });
      waypoints.push({ lat, lon: minLon });
    }
  }
  return waypoints;
}

/** Generate random weed positions within the boundary */
export function generateWeedPositions(
  farm: FarmConfig,
  count: number = 15
): GeoPosition[] {
  const coords = farm.boundary.coordinates[0];
  const minLon = Math.min(...coords.map((c) => c[0]));
  const maxLon = Math.max(...coords.map((c) => c[0]));
  const minLat = Math.min(...coords.map((c) => c[1]));
  const maxLat = Math.max(...coords.map((c) => c[1]));

  return Array.from({ length: count }, () => ({
    lat: minLat + Math.random() * (maxLat - minLat),
    lon: minLon + Math.random() * (maxLon - minLon),
  }));
}
