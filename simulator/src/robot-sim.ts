import type { MqttClient } from "mqtt";
import type {
  RobotType,
  RobotState,
  RobotStatus,
  RobotTelemetry,
  Detection,
  MissionProgress,
  GeoPosition,
} from "../../src/types";
import { Topics } from "../../src/topics";
import { FarmConfig, generateScanWaypoints, generateWeedPositions } from "./farm-data";

export type RobotBehavior = "patrol" | "idle" | "low_battery" | "error" | "mission";

export interface RobotSimConfig {
  id: string;
  type: RobotType;
  behavior: RobotBehavior;
  farm: FarmConfig;
}

// Simulation constants
const TELEMETRY_INTERVAL_MS = 2000;
const STATUS_INTERVAL_MS = 5000;
const MOVE_SPEED_DEG_PER_SEC = 0.000008; // ~0.9 m/s at this latitude
const BATTERY_DRAIN_PER_SEC = 0.015; // ~100% in ~110 minutes
const BATTERY_CHARGE_PER_SEC = 0.05; // ~100% in ~33 minutes
const LOW_BATTERY_THRESHOLD = 15;
const CHARGE_COMPLETE_THRESHOLD = 95;
const WEED_DETECTION_CHANCE = 0.12; // per telemetry tick while scanning

const WEED_SPECIES = [
  "Amaranthus retroflexus",
  "Chenopodium album",
  "Taraxacum officinale",
  "Convolvulus arvensis",
  "Digitaria sanguinalis",
];

export class RobotSimulator {
  private client: MqttClient;
  private config: RobotSimConfig;
  private state: RobotState = "online";
  private battery = 100;
  private position: GeoPosition;
  private velocity = 0;
  private waypoints: GeoPosition[] = [];
  private waypointIndex = 0;
  private missionId: string | null = null;
  private missionProgress = 0;
  private uptime = 0;
  private detectionCount = 0;
  private weedPositions: GeoPosition[] = [];

  private telemetryTimer: ReturnType<typeof setInterval> | null = null;
  private statusTimer: ReturnType<typeof setInterval> | null = null;

  constructor(client: MqttClient, config: RobotSimConfig) {
    this.client = client;
    this.config = config;
    // Start at farm center with slight random offset
    this.position = {
      lat: config.farm.center.lat + (Math.random() - 0.5) * 0.0002,
      lon: config.farm.center.lon + (Math.random() - 0.5) * 0.0002,
      altitude_m: 45 + Math.random() * 5,
      heading_deg: Math.random() * 360,
      accuracy_m: 0.02 + Math.random() * 0.05,
      fix_type: "rtk_fixed",
    };

    // Pre-generate weed positions for detection simulation
    this.weedPositions = generateWeedPositions(config.farm, 20);

    // Set initial state based on behavior
    this.initBehavior();
  }

  private initBehavior(): void {
    switch (this.config.behavior) {
      case "patrol":
      case "mission":
        this.state = "busy";
        this.waypoints = generateScanWaypoints(this.config.farm);
        this.missionId = `mission-sim-${Date.now().toString(36)}`;
        this.battery = 70 + Math.random() * 30;
        break;
      case "idle":
        this.state = "online";
        this.battery = 50 + Math.random() * 50;
        break;
      case "low_battery":
        this.state = "returning_home";
        this.battery = 8 + Math.random() * 10;
        break;
      case "error":
        this.state = "error";
        this.battery = 30 + Math.random() * 40;
        break;
    }
  }

  start(): void {
    this.telemetryTimer = setInterval(() => this.tick(), TELEMETRY_INTERVAL_MS);
    this.statusTimer = setInterval(() => this.publishStatus(), STATUS_INTERVAL_MS);
    // Publish initial status immediately
    this.publishStatus();
    console.log(
      `  [${this.config.id}] ${this.config.type} started — behavior: ${this.config.behavior}, battery: ${this.battery.toFixed(0)}%`
    );
  }

  stop(): void {
    if (this.telemetryTimer) clearInterval(this.telemetryTimer);
    if (this.statusTimer) clearInterval(this.statusTimer);
  }

  private tick(): void {
    const dt = TELEMETRY_INTERVAL_MS / 1000;
    this.uptime += dt;

    // Update simulation state
    this.updateBattery(dt);
    this.updatePosition(dt);
    this.checkStateTransitions();

    // Publish telemetry
    this.publishTelemetry();

    // Maybe detect a weed (only while scanning/busy)
    if (this.state === "busy" && this.config.type === "scout") {
      this.maybeDetectWeed();
    }

    // Publish mission progress if on a mission
    if (this.missionId && this.state === "busy") {
      this.publishMissionProgress();
    }
  }

  private updateBattery(dt: number): void {
    if (this.state === "charging") {
      this.battery = Math.min(100, this.battery + BATTERY_CHARGE_PER_SEC * dt);
    } else if (this.state !== "error" && this.state !== "offline") {
      const drainRate =
        this.state === "busy" ? BATTERY_DRAIN_PER_SEC * 1.5 : BATTERY_DRAIN_PER_SEC;
      this.battery = Math.max(0, this.battery - drainRate * dt);
    }
  }

  private updatePosition(dt: number): void {
    if (this.state !== "busy" && this.state !== "returning_home") {
      this.velocity = 0;
      // Add GPS jitter when stationary
      this.position.lat += (Math.random() - 0.5) * 0.0000005;
      this.position.lon += (Math.random() - 0.5) * 0.0000005;
      return;
    }

    // Move toward current waypoint
    const target =
      this.state === "returning_home"
        ? this.config.farm.center
        : this.waypoints[this.waypointIndex];

    if (!target) return;

    const dlat = target.lat - this.position.lat;
    const dlon = target.lon - this.position.lon;
    const dist = Math.sqrt(dlat * dlat + dlon * dlon);

    if (dist < 0.000005) {
      // Reached waypoint
      if (this.state === "returning_home") {
        this.state = "charging";
        this.velocity = 0;
        return;
      }
      this.waypointIndex++;
      if (this.waypointIndex >= this.waypoints.length) {
        // Mission complete — loop back
        this.waypointIndex = 0;
        this.missionProgress = 100;
      }
      this.missionProgress =
        (this.waypointIndex / Math.max(1, this.waypoints.length)) * 100;
      return;
    }

    // Move toward target
    const step = MOVE_SPEED_DEG_PER_SEC * dt;
    const ratio = Math.min(step / dist, 1);
    this.position.lat += dlat * ratio;
    this.position.lon += dlon * ratio;
    this.position.heading_deg = (Math.atan2(dlon, dlat) * 180) / Math.PI;
    this.position.accuracy_m = 0.02 + Math.random() * 0.03;
    this.velocity = 0.8 + Math.random() * 0.3; // ~0.8–1.1 m/s
  }

  private checkStateTransitions(): void {
    // Low battery → return home
    if (
      this.battery < LOW_BATTERY_THRESHOLD &&
      this.state === "busy"
    ) {
      this.state = "returning_home";
      this.missionId = null;
      console.log(`  [${this.config.id}] Low battery (${this.battery.toFixed(0)}%), returning home`);
    }

    // Charging complete → resume based on behavior
    if (this.state === "charging" && this.battery > CHARGE_COMPLETE_THRESHOLD) {
      if (this.config.behavior === "patrol" || this.config.behavior === "mission") {
        this.state = "busy";
        this.waypoints = generateScanWaypoints(this.config.farm);
        this.waypointIndex = 0;
        this.missionId = `mission-sim-${Date.now().toString(36)}`;
        this.missionProgress = 0;
        console.log(`  [${this.config.id}] Charged to ${this.battery.toFixed(0)}%, resuming patrol`);
      } else {
        this.state = "online";
      }
    }

    // Error behavior: randomly toggle error state
    if (this.config.behavior === "error" && Math.random() < 0.005) {
      this.state = this.state === "error" ? "online" : "error";
    }
  }

  private maybeDetectWeed(): void {
    if (Math.random() > WEED_DETECTION_CHANCE) return;

    this.detectionCount++;
    const detection: Detection = {
      detection_id: `det-${this.config.id}-${this.detectionCount}`,
      robot_id: this.config.id,
      mission_id: this.missionId,
      timestamp: Date.now(),
      detection_type: "weed",
      position: {
        lat: this.position.lat + (Math.random() - 0.5) * 0.00005,
        lon: this.position.lon + (Math.random() - 0.5) * 0.00005,
      },
      confidence: 0.7 + Math.random() * 0.3,
      species: WEED_SPECIES[Math.floor(Math.random() * WEED_SPECIES.length)],
      action_taken: "marked",
    };

    this.publish(Topics.robotDetection(this.config.id), detection);
  }

  private publishTelemetry(): void {
    const telemetry: RobotTelemetry = {
      robot_id: this.config.id,
      timestamp: Date.now(),
      position: { ...this.position },
      velocity_mps: this.velocity,
      imu: {
        roll_deg: (Math.random() - 0.5) * 3,
        pitch_deg: (Math.random() - 0.5) * 5,
        yaw_deg: this.position.heading_deg ?? 0,
        accel_x: (Math.random() - 0.5) * 0.2,
        accel_y: (Math.random() - 0.5) * 0.2,
        accel_z: 9.78 + (Math.random() - 0.5) * 0.1,
      },
      motor_temps_c: [35 + Math.random() * 10, 36 + Math.random() * 10],
      cpu_temp_c: 42 + Math.random() * 15,
      wifi_rssi_dbm: -45 - Math.random() * 30,
    };

    this.publish(Topics.robotTelemetry(this.config.id), telemetry);
  }

  private publishStatus(): void {
    const status: RobotStatus = {
      robot_id: this.config.id,
      robot_type: this.config.type,
      status: this.state,
      timestamp: Date.now(),
      battery_pct: Math.round(this.battery * 10) / 10,
      position: { ...this.position },
      current_mission_id: this.missionId,
      firmware_version: "0.1.0-sim",
      uptime_s: Math.round(this.uptime),
    };

    this.publish(Topics.robotStatus(this.config.id), status);
  }

  private publishMissionProgress(): void {
    const progress: MissionProgress = {
      mission_id: this.missionId!,
      robot_id: this.config.id,
      timestamp: Date.now(),
      progress_pct: Math.round(this.missionProgress * 10) / 10,
      waypoints_completed: this.waypointIndex,
      waypoints_total: this.waypoints.length,
      current_position: { ...this.position },
      eta_seconds:
        this.missionProgress < 100
          ? Math.round(
              ((100 - this.missionProgress) / Math.max(1, this.missionProgress)) *
                this.uptime
            )
          : 0,
      status: "in_progress",
      error_message: null,
    };

    this.publish(Topics.robotMissionProgress(this.config.id), progress);
  }

  private publish(topic: string, payload: object): void {
    this.client.publish(topic, JSON.stringify(payload), { qos: 0 });
  }
}
