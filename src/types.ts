// ─── Shared Primitives ───

export interface GeoPosition {
  lat: number;
  lon: number;
  altitude_m?: number;
  heading_deg?: number;
  accuracy_m?: number;
  fix_type?: "none" | "gps" | "dgps" | "rtk_float" | "rtk_fixed";
}

// ─── Robot ───

export type RobotType = "scout" | "weeder" | "drone";

export type RobotState =
  | "online"
  | "offline"
  | "busy"
  | "error"
  | "charging"
  | "returning_home";

export interface RobotStatus {
  robot_id: string;
  robot_type: RobotType;
  status: RobotState;
  timestamp: number;
  battery_pct?: number;
  position?: GeoPosition;
  current_mission_id?: string | null;
  firmware_version?: string;
  uptime_s?: number;
}

export interface RobotTelemetry {
  robot_id: string;
  timestamp: number;
  position?: GeoPosition;
  velocity_mps?: number;
  imu?: {
    roll_deg: number;
    pitch_deg: number;
    yaw_deg: number;
    accel_x: number;
    accel_y: number;
    accel_z: number;
  };
  motor_temps_c?: number[];
  cpu_temp_c?: number;
  wifi_rssi_dbm?: number;
}

// ─── Coordinator ───

export type CoordinatorState = "online" | "offline" | "syncing" | "error";

export interface CoordinatorStatus {
  coordinator_id: string;
  farm_id: string;
  status: CoordinatorState;
  timestamp: number;
  connected_robots?: number;
  active_missions?: number;
  cloud_connected?: boolean;
  last_cloud_sync?: number | null;
  version?: string;
}

// ─── Missions ───

export type MissionType = "scan" | "weed" | "patrol" | "return_home";

export type MissionState =
  | "pending"
  | "assigned"
  | "in_progress"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export interface GeoJSONPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

export interface MissionParameters {
  scan_resolution_m?: number;
  weed_confidence_threshold?: number;
  max_speed_mps?: number;
}

export interface Mission {
  mission_id: string;
  mission_type: MissionType;
  farm_id: string;
  created_at: number;
  created_by?: string;
  status: MissionState;
  assigned_robot_id?: string | null;
  priority?: number;
  area?: GeoJSONPolygon;
  waypoints?: GeoPosition[];
  parameters?: MissionParameters;
}

export interface MissionCreate {
  mission_type: MissionType;
  farm_id: string;
  priority?: number;
  assigned_robot_id?: string | null;
  area: GeoJSONPolygon;
  parameters?: MissionParameters;
  scheduled_at?: number | null;
}

export interface MissionProgress {
  mission_id: string;
  robot_id: string;
  timestamp: number;
  progress_pct: number;
  waypoints_completed?: number;
  waypoints_total?: number;
  current_position?: GeoPosition;
  eta_seconds?: number | null;
  status: "in_progress" | "paused" | "completed" | "failed";
  error_message?: string | null;
}

// ─── Detection ───

export type DetectionType = "weed" | "crop" | "obstacle" | "boundary";
export type DetectionAction = "marked" | "eliminated" | "avoided";

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Detection {
  detection_id: string;
  robot_id: string;
  mission_id?: string | null;
  timestamp: number;
  detection_type: DetectionType;
  position: GeoPosition;
  confidence: number;
  species?: string | null;
  bounding_box?: BoundingBox;
  image_ref?: string | null;
  action_taken?: DetectionAction | null;
}

// ─── Emergency Stop ───

export type EmergencyStopScope = "single_robot" | "all_robots" | "farm";

export interface EmergencyStop {
  timestamp: number;
  reason: string;
  issued_by: string;
  scope?: EmergencyStopScope;
  target_robot_id?: string | null;
}
