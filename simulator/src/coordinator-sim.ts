import type { MqttClient } from "mqtt";
import type { CoordinatorStatus } from "../../src/types";
import { Topics } from "../../src/topics";
import type { FarmConfig } from "./farm-data";

const HEARTBEAT_INTERVAL_MS = 10000; // Every 10 seconds

export class CoordinatorSimulator {
  private client: MqttClient;
  private farm: FarmConfig;
  private robotCount: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private startTime = Date.now();

  constructor(client: MqttClient, farm: FarmConfig, robotCount: number) {
    this.client = client;
    this.farm = farm;
    this.robotCount = robotCount;
  }

  start(): void {
    this.publishStatus();
    this.timer = setInterval(() => this.publishStatus(), HEARTBEAT_INTERVAL_MS);
    console.log(`  [${this.farm.coordinator_id}] Coordinator online — ${this.robotCount} robots`);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private publishStatus(): void {
    const status: CoordinatorStatus = {
      coordinator_id: this.farm.coordinator_id,
      farm_id: this.farm.farm_id,
      status: "online",
      timestamp: Date.now(),
      connected_robots: this.robotCount,
      active_missions: Math.max(0, this.robotCount - 1),
      cloud_connected: true,
      last_cloud_sync: Date.now(),
      version: "0.1.0-sim",
    };

    this.client.publish(
      Topics.coordinatorStatus(this.farm.coordinator_id),
      JSON.stringify(status),
      { qos: 0 }
    );
  }
}
