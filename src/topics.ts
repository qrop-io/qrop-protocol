// ─── MQTT Topic Builders ───
// Typed helpers to construct MQTT topic strings consistently.

export const Topics = {
  // Farm
  farmStatus: (farmId: string) => `qrop/farms/${farmId}/status` as const,
  farmWeather: (farmId: string) => `qrop/farms/${farmId}/weather` as const,

  // Coordinator
  coordinatorStatus: (coordinatorId: string) =>
    `qrop/coordinators/${coordinatorId}/status` as const,
  coordinatorMissionCreate: (coordinatorId: string) =>
    `qrop/coordinators/${coordinatorId}/commands/mission/create` as const,
  coordinatorMissionCancel: (coordinatorId: string) =>
    `qrop/coordinators/${coordinatorId}/commands/mission/cancel` as const,
  coordinatorEmergencyStop: (coordinatorId: string) =>
    `qrop/coordinators/${coordinatorId}/commands/emergency-stop` as const,
  coordinatorMissionStarted: (coordinatorId: string) =>
    `qrop/coordinators/${coordinatorId}/events/mission/started` as const,
  coordinatorMissionCompleted: (coordinatorId: string) =>
    `qrop/coordinators/${coordinatorId}/events/mission/completed` as const,
  coordinatorMissionFailed: (coordinatorId: string) =>
    `qrop/coordinators/${coordinatorId}/events/mission/failed` as const,

  // Robot
  robotStatus: (robotId: string) =>
    `qrop/robots/${robotId}/status` as const,
  robotTelemetry: (robotId: string) =>
    `qrop/robots/${robotId}/telemetry` as const,
  robotMissionStart: (robotId: string) =>
    `qrop/robots/${robotId}/commands/mission/start` as const,
  robotMissionPause: (robotId: string) =>
    `qrop/robots/${robotId}/commands/mission/pause` as const,
  robotMissionResume: (robotId: string) =>
    `qrop/robots/${robotId}/commands/mission/resume` as const,
  robotMissionAbort: (robotId: string) =>
    `qrop/robots/${robotId}/commands/mission/abort` as const,
  robotNavigate: (robotId: string) =>
    `qrop/robots/${robotId}/commands/navigate` as const,
  robotEmergencyStop: (robotId: string) =>
    `qrop/robots/${robotId}/commands/emergency-stop` as const,
  robotMissionProgress: (robotId: string) =>
    `qrop/robots/${robotId}/events/mission/progress` as const,
  robotMissionCompleted: (robotId: string) =>
    `qrop/robots/${robotId}/events/mission/completed` as const,
  robotDetection: (robotId: string) =>
    `qrop/robots/${robotId}/events/detection` as const,
  robotAlert: (robotId: string) =>
    `qrop/robots/${robotId}/events/alert` as const,

  // System
  systemTime: () => `qrop/system/time` as const,
  otaLatest: (robotType: string) =>
    `qrop/system/ota/${robotType}/latest` as const,

  // Wildcard subscriptions
  allRobotStatus: () => `qrop/robots/+/status` as const,
  allRobotEvents: (robotId: string) =>
    `qrop/robots/${robotId}/events/#` as const,
  allCoordinatorCommands: (coordinatorId: string) =>
    `qrop/coordinators/${coordinatorId}/commands/#` as const,
} as const;
