/** Telemetry packet from DCS Export.lua via UDP — all values in SI units */
export interface TelemetryPacket {
  type: 'telemetry'
  /** LoGetModelTime() — mission elapsed seconds */
  t_model: number
  pos: {
    lat: number
    lon: number
    /** Altitude MSL in metres */
    alt_m: number
    /** Altitude AGL in metres — LoGetAltitudeAboveGroundLevel() */
    alt_agl_m?: number
  }
  att: {
    pitch_rad: number
    bank_rad: number
    yaw_rad: number
  }
  spd: {
    /** Indicated airspeed in m/s */
    ias_mps: number
    /** True airspeed in m/s */
    tas_mps?: number
    /** Vertical velocity in m/s (positive = climbing) */
    vvi_mps?: number
    mach: number
  }
  /** Magnetic heading in radians — LoGetMagneticYaw() */
  hdg_rad: number
  /** Aerodynamic data */
  aero?: {
    /** Angle of attack in radians */
    aoa_rad: number
    /** G-loads (x=lateral, y=vertical/normal, z=longitudinal) */
    g: { x: number; y: number; z: number }
    /** Angular velocity in rad/s */
    ang_vel: { x: number; y: number; z: number }
  }
  /** Fuel state as 0-1 fractions */
  fuel?: {
    internal: number
    external: number
  }
  /** Engine data (primary engine) */
  eng?: {
    /** RPM as percentage (0-100) */
    rpm_pct: number
    /** Fuel consumption rate */
    fuel_con: number
  }
}

/** Tactical data packet sent at 1 Hz with weapons, objects, and systems */
export interface TacticalPacket {
  type: 'tactical'
  t_model: number
  /** World objects (anti-cheat gated) */
  objects?: RadarContact[]
  /** Radar-tracked targets (anti-cheat gated) */
  targets?: RadarTarget[]
  /** Locked targets (anti-cheat gated) */
  locked?: RadarTarget[]
  /** Weapons loadout */
  weapons?: WeaponsState
  /** Countermeasures */
  countermeasures?: CountermeasuresState
  /** Navigation/mode info */
  nav?: NavigationState
  /** Active MCP warnings */
  mcp_warnings?: string[]
  /** Mechanization state */
  mech?: MechanizationState
  /** Server permission flags */
  permissions?: {
    objects: boolean
    sensors: boolean
  }
}

/** World object from LoGetWorldObjects */
export interface RadarContact {
  id: number
  name: string
  type: DcsType
  /** Coalition string */
  coal: string
  lat: number
  lon: number
  /** Altitude MSL in metres */
  alt: number
  /** Heading in radians */
  hdg: number
  flags: {
    radar: boolean
    human: boolean
    jam: boolean
  }
}

/** Radar target from LoGetTargetInformation / LoGetLockedTargetInformation */
export interface RadarTarget {
  id: number
  /** Distance in metres */
  dist: number
  /** Target heading in radians */
  course: number
  mach: number
  /** Tracking flags bitfield */
  flags: number
  /** Horizontal viewing angle in body axis (radians) */
  fim: number
  /** Vertical viewing angle in body axis (radians) */
  fin: number
  /** World velocity (m/s) */
  vel: { x: number; y: number; z: number }
  /** World position (DCS internal coords, metres) */
  pos: { x: number; y: number; z: number }
  jamming: boolean
}

/** DCS wsTypes classification tuple */
export interface DcsType {
  level1?: number
  level2?: number
  level3?: number
  level4?: number
}

/** Weapon station data */
export interface WeaponStation {
  idx: number
  name: string
  type: DcsType
  count: number
}

/** Weapons state from LoGetPayloadInfo + LoGetSnares */
export interface WeaponsState {
  current_station: number
  stations: WeaponStation[]
  gun_rounds: number
}

/** Countermeasures state from LoGetSnares */
export interface CountermeasuresState {
  chaff: number
  flare: number
}

/** Navigation info from LoGetNavigationInfo */
export interface NavigationState {
  master_mode: string
  sub_mode: string
  acs_mode: string
  autothrust: boolean
}

/** Mechanization state from LoGetMechInfo */
export interface MechanizationState {
  /** 0.0 = up, 1.0 = down */
  gear_status: number
  /** 0.0 - 1.0 */
  flaps_value: number
  /** 0.0 - 1.0 */
  speedbrakes: number
}

/** Radar target tracking flags (bitfield) */
export const TargetFlags = {
  RADAR_VIEW: 0x0002,
  EOS_VIEW: 0x0004,
  RADAR_LOCK: 0x0008,
  EOS_LOCK: 0x0010,
  RADAR_TRACK: 0x0020,
  EOS_TRACK: 0x0040,
  NET_HUMAN: 0x0200,
  AUTO_LOCK: 0x0400,
  LOCK_JAMMER: 0x0800,
} as const

/** Check if a target has a specific tracking flag */
export function hasTargetFlag(flags: number, flag: number): boolean {
  return (flags & flag) !== 0
}

/** Bridge heartbeat sent at 1 Hz on the same channel */
export interface HeartbeatPacket {
  type: 'heartbeat'
  dcsActive: boolean
  packetCount: number
  queueSize: number
}

/** Union of all broadcast message types */
export type BroadcastPayload = TelemetryPacket | HeartbeatPacket | TacticalPacket

/** Session status in the sessions table */
export type SessionStatus = 'active' | 'ended'

/** Row shape for the sessions table */
export interface Session {
  id: string
  user_id: string
  status: SessionStatus
  pairing_code: string | null
  pairing_expires_at: string | null
  bridge_claimed: boolean
  created_at: string
  ended_at: string | null
}
