/**
 * Bright main-belt asteroids from Keplerian elements (JPL ecliptic J2000).
 * Epoch 2461200.5 = 2026-Jun-09.0 TDB.
 */

const DEG = Math.PI / 180;
const EPS = 23.439281 * DEG; // mean obliquity J2000

/** @type {Record<string, {
 *   a: number, e: number, i: number, node: number, peri: number, m: number,
 *   n: number, epochJd: number, h: number, g: number, periodDays: number
 * }>} */
const ELEMENTS = {
  Ceres: {
    a: 2.765552595034094,
    e: 0.07969229514816586,
    i: 10.58802780183462,
    node: 80.24862682043221,
    peri: 73.29421453021587,
    m: 274.4193463761342,
    n: 0.21430445064843,
    epochJd: 2461200.5,
    h: 3.34,
    g: 0.12,
    periodDays: 1679.85,
  },
  Vesta: {
    a: 2.361365965127599,
    e: 0.09020374382834395,
    i: 7.143925545058711,
    node: 103.701293265032,
    peri: 151.4686478221564,
    m: 81.19015607686903,
    n: 0.2716183613599909,
    epochJd: 2461200.5,
    h: 3.20,
    g: 0.32,
    periodDays: 1325.39,
  },
};

export const ASTEROID_IDS = Object.keys(ELEMENTS);

export function asteroidPeriodDays(id) {
  return ELEMENTS[id]?.periodDays ?? null;
}

function julianDate(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

function wrap360(degrees) {
  return ((degrees % 360) + 360) % 360;
}

function keplerE(meanAnomalyRad, e) {
  let E = e < 0.8 ? meanAnomalyRad : Math.PI;
  for (let step = 0; step < 12; step += 1) {
    const f = E - e * Math.sin(E) - meanAnomalyRad;
    const fp = 1 - e * Math.cos(E);
    E -= f / fp;
  }
  return E;
}

function eclipticToEqj(x, y, z) {
  const cos = Math.cos(EPS);
  const sin = Math.sin(EPS);
  return { x, y: y * cos - z * sin, z: y * sin + z * cos };
}

/** Heliocentric J2000 equatorial position in AU. */
export function asteroidHelioEqj(id, date) {
  const el = ELEMENTS[id];
  if (!el) return null;
  const days = julianDate(date) - el.epochJd;
  const M = wrap360(el.m + el.n * days) * DEG;
  const E = keplerE(M, el.e);
  const cosE = Math.cos(E);
  const sinE = Math.sin(E);
  const xv = el.a * (cosE - el.e);
  const yv = el.a * Math.sqrt(1 - el.e * el.e) * sinE;
  const v = Math.atan2(yv, xv);
  const r = Math.hypot(xv, yv);
  const node = el.node * DEG;
  const peri = el.peri * DEG;
  const inc = el.i * DEG;
  const cosO = Math.cos(node);
  const sinO = Math.sin(node);
  const cosw = Math.cos(peri);
  const sinw = Math.sin(peri);
  const cosi = Math.cos(inc);
  const sini = Math.sin(inc);
  const cosVw = Math.cos(v) * cosw - Math.sin(v) * sinw;
  const sinVw = Math.sin(v) * cosw + Math.cos(v) * sinw;
  const xe = r * (cosO * cosVw - sinO * sinVw * cosi);
  const ye = r * (sinO * cosVw + cosO * sinVw * cosi);
  const ze = r * (sinVw * sini);
  return eclipticToEqj(xe, ye, ze);
}

/** Approximate visual magnitude from H-G system. */
export function asteroidMagnitude(id, helioAu, geoAu, phaseAngleDeg) {
  const el = ELEMENTS[id];
  if (!el) return null;
  const phase = Math.max(0, Math.min(120, phaseAngleDeg)) * DEG;
  const tanHalf = Math.tan(phase / 2);
  const phi1 = Math.exp(-3.33 * tanHalf ** 0.63);
  const phi2 = Math.exp(-1.87 * tanHalf ** 1.22);
  const phaseFactor = (1 - el.g) * phi1 + el.g * phi2;
  return el.h + 5 * Math.log10(Math.max(1e-6, helioAu * geoAu)) - 2.5 * Math.log10(Math.max(1e-6, phaseFactor));
}
