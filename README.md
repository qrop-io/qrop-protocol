# qrop-protocol

Shared communication protocol for the Qrop autonomous farming system. Defines MQTT topics, message schemas, and cross-component types.

## Overview

All Qrop components (dashboard, coordinator, robots) communicate using MQTT with JSON payloads. This repo is the single source of truth for message formats.

## MQTT Topic Hierarchy

```
qrop/
├── farms/{farm_id}/
│   ├── status                    # Farm-level status summary
│   └── weather                   # Weather data updates
├── coordinators/{coordinator_id}/
│   ├── status                    # Coordinator online/offline/syncing
│   ├── commands/                 # Commands FROM dashboard TO coordinator
│   │   ├── mission/create        # Create a new mission
│   │   ├── mission/cancel        # Cancel a running mission
│   │   └── emergency-stop        # Emergency stop all robots
│   └── events/                   # Events FROM coordinator TO dashboard
│       ├── mission/started       # Mission execution began
│       ├── mission/completed     # Mission finished
│       └── mission/failed        # Mission failed
├── robots/{robot_id}/
│   ├── status                    # Heartbeat: online, battery, position
│   ├── telemetry                 # High-frequency sensor data
│   ├── commands/                 # Commands FROM coordinator TO robot
│   │   ├── mission/start         # Begin assigned mission
│   │   ├── mission/pause         # Pause current mission
│   │   ├── mission/resume        # Resume paused mission
│   │   ├── mission/abort         # Abort and return home
│   │   ├── navigate              # Go to specific waypoint
│   │   └── emergency-stop        # Immediate halt
│   └── events/                   # Events FROM robot TO coordinator
│       ├── mission/progress      # Waypoint reached, % complete
│       ├── mission/completed     # Mission finished
│       ├── detection             # Weed/obstacle/crop detection
│       └── alert                 # Low battery, hardware fault, etc.
└── system/
    ├── time                      # NTP-synced timestamp broadcast
    └── ota/{robot_type}/latest   # Firmware update availability
```

## Schemas

JSON Schema files in `schemas/` define the payload format for each message type:

| Schema | Used On Topic | Description |
|--------|--------------|-------------|
| `robot-status.json` | `robots/{id}/status` | Heartbeat with position, battery, state |
| `robot-telemetry.json` | `robots/{id}/telemetry` | Sensor readings at high frequency |
| `coordinator-status.json` | `coordinators/{id}/status` | Coordinator health and connectivity |
| `mission-create.json` | `coordinators/{id}/commands/mission/create` | Mission definition from dashboard |
| `mission-progress.json` | `robots/{id}/events/mission/progress` | Execution progress update |
| `detection.json` | `robots/{id}/events/detection` | Weed/obstacle detection report |
| `emergency-stop.json` | `*/commands/emergency-stop` | Emergency stop command |
| `geo-position.json` | (shared type) | GPS position with accuracy |
| `mission.json` | (shared type) | Full mission definition |

## Usage

### TypeScript (Dashboard)

```bash
npm install @qrop/protocol
```

### Go (Coordinator)

```bash
go get github.com/qrop-io/qrop-protocol
```

### Rust (Robot Firmware)

Reference the JSON schemas directly or use the generated types.

## QoS Levels

| Message Type | QoS | Rationale |
|-------------|-----|-----------|
| Heartbeat/status | 0 | Frequent, loss acceptable |
| Telemetry | 0 | High-frequency, latest value wins |
| Mission commands | 1 | Must be delivered at least once |
| Emergency stop | 1 | Critical safety — must arrive |
| Detection events | 1 | Data loss unacceptable |
