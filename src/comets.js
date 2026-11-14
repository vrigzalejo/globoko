/**
 * Periodic comets from Keplerian elements (JPL ecliptic J2000).
 * Magnitudes use the usual comet form m1 + 5 log Δ + k1 log r.
 */

const DEG = Math.PI / 180;
const EPS = 23.439281 * DEG; // mean obliquity J2000

/** @type {Record<string, {
 *   a: number, e: number, i: number, node: number, peri: number, m: number,
 *   n: number, epochJd: number, m1: number, k1: number, periodDays: number
 * }>} */
const ELEMENTS = {
  // 1P/Halley — JPL solution, epoch 2439875.5 TDB
  Halley: {
    a: 17.92863504856923,
    e: 0.9679359956953211,
    i: 162.1905300439129,
    node: 59.09894720612437,
    peri: 112.2414314637764,
    m: 274.3823371366792,
    n: 0.01298324443268444,
    epochJd: 2439875.5,
    m1: 4.0,
    k1: 10.0,
    periodDays: 27728.05,
  },
  // 2P/Encke — JPL K273/17, epoch 2460062.5 = 2023-Apr-28.0 TDB
  Encke: {
    a: 2.219242525702791,
    e: 0.8470279034259183,
    i: 11.342270038,
    node: 334.0454694778515,
    peri: 187.2630430521377,
    m: 307.0802917287554,
    n: 0.2981239900177668,
    epochJd: 2460062.5,
    m1: 9.8,
    k1: 10.0,
    periodDays: 1207.55,
  },
  // 67P/Churyumov–Gerasimenko — JPL K284/1, epoch 2457305.5 = 2015-Oct-10.0 TDB
  '67P': {
    a: 3.462249490129549,
    e: 0.6409081308996354,
    i: 7.040294937543767,
    node: 50.13557377155012,
    peri: 12.79824970228189,
    m: 8.859927425218402,
    n: 0.1529912291873851,
    epochJd: 2457305.5,
    m1: 11.0,
    k1: 10.0,
    periodDays: 2353.08,
  },
};

export const COMET_IDS = Object.keys(ELEMENTS);

export function cometPeriodDays(id) {
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
  const steps = e > 0.95 ? 24 : 14;
  for (let step = 0; step < steps; step += 1) {
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
export function cometHelioEqj(id, date) {
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

/** Approximate total magnitude m1 + 5 log Δ + k1 log r. */
export function cometMagnitude(id, helioAu, geoAu) {
  const el = ELEMENTS[id];
  if (!el) return null;
  return el.m1
    + 5 * Math.log10(Math.max(1e-6, geoAu))
    + el.k1 * Math.log10(Math.max(1e-6, helioAu));
}
