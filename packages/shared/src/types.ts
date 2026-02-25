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
  }
  att: {
    pitch_rad: number
    bank_rad: number
    yaw_rad: number
  }
  spd: {
    /** Indicated airspeed in m/s */
    ias_mps: number
    mach: number
  }
  /** Magnetic heading in radians — LoGetMagneticYaw() */
  hdg_rad: number
}

/** Bridge heartbeat sent at 1 Hz on the same channel */
export interface HeartbeatPacket {
  type: 'heartbeat'
  dcsActive: boolean
  packetCount: number
  queueSize: number
}

/** Union of all broadcast message types */
export type BroadcastPayload = TelemetryPacket | HeartbeatPacket

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
