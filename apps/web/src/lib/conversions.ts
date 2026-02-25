/** m/s → knots */
export function mpsToKnots(mps: number): number {
  return mps * 1.944
}

/** metres → feet */
export function metresToFeet(m: number): number {
  return m * 3.281
}

/** radians → degrees (0-360) */
export function radToDeg(rad: number): number {
  let deg = (rad * 57.2958) % 360
  if (deg < 0) deg += 360
  return deg
}

/** m/s → feet per minute (VVI) */
export function mpsToFpm(mps: number): number {
  return mps * 196.85
}

/** radians → degrees (signed, for AoA/pitch) */
export function radToDegSigned(rad: number): number {
  return rad * 57.2958
}

/** Format degrees as 3-digit heading string */
export function formatHeading(deg: number): string {
  return Math.round(deg).toString().padStart(3, '0')
}

/** Format decimal degrees to DMS (e.g., 36°24'12"N) */
export function latToDMS(lat: number): string {
  const abs = Math.abs(lat)
  const d = Math.floor(abs)
  const mf = (abs - d) * 60
  const m = Math.floor(mf)
  const s = Math.floor((mf - m) * 60)
  return `${d}°${m.toString().padStart(2, '0')}'${s.toString().padStart(2, '0')}"${lat >= 0 ? 'N' : 'S'}`
}

/** Format decimal degrees to DMS (e.g., 044°18'30"E) */
export function lonToDMS(lon: number): string {
  const abs = Math.abs(lon)
  const d = Math.floor(abs)
  const mf = (abs - d) * 60
  const m = Math.floor(mf)
  const s = Math.floor((mf - m) * 60)
  return `${d.toString().padStart(3, '0')}°${m.toString().padStart(2, '0')}'${s.toString().padStart(2, '0')}"${lon >= 0 ? 'E' : 'W'}`
}
