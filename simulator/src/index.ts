#!/usr/bin/env node

import mqtt from "mqtt";
import { RobotSimulator, type RobotBehavior } from "./robot-sim";
import { CoordinatorSimulator } from "./coordinator-sim";
import { DEFAULT_FARM, type FarmConfig } from "./farm-data";
import type { RobotType } from "../../src/types";

// ─── CLI Argument Parsing ───

interface SimConfig {
  broker: string;
  robots: number;
  farmLat?: number;
  farmLon?: number;
  behaviors: RobotBehavior[];
}

function parseArgs(): SimConfig {
  const args = process.argv.slice(2);
  const config: SimConfig = {
    broker: "mqtt://localhost:1883",
    robots: 3,
    behaviors: [],
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--broker":
      case "-b":
        config.broker = args[++i];
        break;
      case "--robots":
      case "-r":
        config.robots = parseInt(args[++i], 10);
        break;
      case "--farm-lat":
        config.farmLat = parseFloat(args[++i]);
        break;
      case "--farm-lon":
        config.farmLon = parseFloat(args[++i]);
        break;
      case "--behaviors":
        config.behaviors = args[++i].split(",") as RobotBehavior[];
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
    }
  }

  return config;
}

function printHelp(): void {
  console.log(`
qrop-simulator — Simulate Qrop robots publishing MQTT telemetry

Usage:
  qrop-simulator [options]

Options:
  -b, --broker <url>       MQTT broker URL (default: mqtt://localhost:1883)
  -r, --robots <n>         Number of robots to simulate (default: 3)
  --farm-lat <lat>         Farm center latitude (default: 43.6045)
  --farm-lon <lon>         Farm center longitude (default: 1.4440)
  --behaviors <list>       Comma-separated behaviors: patrol,idle,low_battery,error,mission
                           (default: assigns varied behaviors automatically)
  -h, --help               Show this help

Examples:
  qrop-simulator                          # 3 robots, local broker
  qrop-simulator -r 5 -b mqtt://pi:1883  # 5 robots, remote broker
  qrop-simulator --behaviors patrol,idle,error
`);
}

// ─── Default Behavior Assignment ───

const DEFAULT_BEHAVIORS: RobotBehavior[] = [
  "patrol",
  "mission",
  "idle",
  "low_battery",
  "error",
];

function assignBehavior(index: number, explicit: RobotBehavior[]): RobotBehavior {
  if (index < explicit.length) return explicit[index];
  return DEFAULT_BEHAVIORS[index % DEFAULT_BEHAVIORS.length];
}

function assignRobotType(index: number): RobotType {
  // First robot is always a scout, then alternate
  if (index === 0) return "scout";
  if (index % 3 === 1) return "weeder";
  return "scout";
}

// ─── Main ───

function buildFarm(config: SimConfig): FarmConfig {
  if (!config.farmLat && !config.farmLon) return DEFAULT_FARM;

  const lat = config.farmLat ?? DEFAULT_FARM.center.lat;
  const lon = config.farmLon ?? DEFAULT_FARM.center.lon;
  const size = 0.0005; // ~55m

  return {
    ...DEFAULT_FARM,
    center: { lat, lon },
    boundary: {
      type: "Polygon",
      coordinates: [
        [
          [lon - size, lat - size],
          [lon + size, lat - size],
          [lon + size, lat + size],
          [lon - size, lat + size],
          [lon - size, lat - size],
        ],
      ],
    },
  };
}

async function main(): Promise<void> {
  const config = parseArgs();
  const farm = buildFarm(config);

  console.log(`\n🌱 Qrop Simulator`);
  console.log(`   Broker: ${config.broker}`);
  console.log(`   Farm: ${farm.name} (${farm.center.lat.toFixed(4)}, ${farm.center.lon.toFixed(4)})`);
  console.log(`   Robots: ${config.robots}\n`);

  // Connect to MQTT broker
  const client = mqtt.connect(config.broker, {
    clientId: `qrop-simulator-${Date.now().toString(36)}`,
    clean: true,
    connectTimeout: 5000,
    reconnectPeriod: 3000,
  });

  await new Promise<void>((resolve, reject) => {
    client.on("connect", () => {
      console.log(`   Connected to MQTT broker\n`);
      resolve();
    });
    client.on("error", (err) => {
      console.error(`   Failed to connect to MQTT broker: ${err.message}`);
      reject(err);
    });
    setTimeout(() => reject(new Error("Connection timeout")), 10000);
  });

  // Start coordinator simulator
  const coordinator = new CoordinatorSimulator(client, farm, config.robots);
  coordinator.start();

  // Start robot simulators
  const robots: RobotSimulator[] = [];
  for (let i = 0; i < config.robots; i++) {
    const behavior = assignBehavior(i, config.behaviors);
    const robotType = assignRobotType(i);
    const sim = new RobotSimulator(client, {
      id: `robot-sim-${String(i + 1).padStart(2, "0")}`,
      type: robotType,
      behavior,
      farm,
    });
    sim.start();
    robots.push(sim);
  }

  // Stats logging
  const statsInterval = setInterval(() => {
    const now = new Date().toLocaleTimeString();
    console.log(`\n  [${now}] Simulator running — ${config.robots} robots publishing telemetry`);
  }, 30000);

  // Graceful shutdown
  const shutdown = () => {
    console.log("\n\n   Shutting down simulator...");
    clearInterval(statsInterval);
    robots.forEach((r) => r.stop());
    coordinator.stop();
    client.end(false, () => {
      console.log("   Disconnected. Goodbye!\n");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
