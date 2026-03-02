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

/** metres → nautical miles */
export function metresToNM(m: number): number {
  return m / 1852
}

/** nautical miles → metres */
export function nmToMetres(nm: number): number {
  return nm * 1852
}

/** Calculate bearing in degrees from point 1 to point 2 (all inputs in degrees) */
export function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = Math.PI / 180
  const dLon = (lon2 - lon1) * toRad
  const lat1R = lat1 * toRad
  const lat2R = lat2 * toRad
  const y = Math.sin(dLon) * Math.cos(lat2R)
  const x = Math.cos(lat1R) * Math.sin(lat2R) - Math.sin(lat1R) * Math.cos(lat2R) * Math.cos(dLon)
  let brg = Math.atan2(y, x) * (180 / Math.PI)
  if (brg < 0) brg += 360
  return brg
}

/** Calculate great-circle distance in NM between two lat/lon points (degrees) */
export function distanceNM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = Math.PI / 180
  const dLat = (lat2 - lat1) * toRad
  const dLon = (lon2 - lon1) * toRad
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return c * 3440.065 // Earth radius in NM
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
