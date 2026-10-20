import {
  Body,
  Constellation,
  Elongation,
  Equator,
  EquatorFromVector,
  GeoVector,
  Horizon,
  Illumination,
  MoonPhase,
  Observer,
  SearchMoonPhase,
  Rotation_EQJ_EQD,
  RotateVector,
  SearchRiseSet,
  SiderealTime,
} from 'astronomy-engine';

/** IAU nominal astronomical unit, in meters. */
export const AU_METERS = 149597870700;

/**
 * Bodies drawn on the globe, in the order they appear in the sky list.
 * Colors are used for pins, stems, and list swatches.
 */
export const BODIES = [
  { id: 'Sun', label: 'Sun', color: '#ffb020' },
  { id: 'Moon', label: 'Moon', color: '#d5dde8' },
  { id: 'Mercury', label: 'Mercury', color: '#c8b8a2' },
  { id: 'Venus', label: 'Venus', color: '#f0d7a2' },
  { id: 'Mars', label: 'Mars', color: '#e06a45' },
  { id: 'Jupiter', label: 'Jupiter', color: '#e2b48a' },
  { id: 'Saturn', label: 'Saturn', color: '#ecd59a' },
  { id: 'Uranus', label: 'Uranus', color: '#7fd4cb' },
  { id: 'Neptune', label: 'Neptune', color: '#6c9dff' },
];

const MOON_RADIUS_M = 1737400;

const MOON_PHASES = [
  { longitude: 0, name: 'New Moon' },
  { longitude: 90, name: 'First quarter' },
  { longitude: 180, name: 'Full Moon' },
  { longitude: 270, name: 'Last quarter' },
];

/** Next time each principal Moon phase occurs after `date`. */
export function nextMoonPhases(date) {
  const start = new Date(date.getTime() - 60_000);
  return MOON_PHASES
    .map((phase) => {
      const found = SearchMoonPhase(phase.longitude, start, 32);
      return found ? { name: phase.name, date: found.date } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.date - b.date);
}

function moonAltitude(observer, date) {
  const topo = Equator(Body.Moon, date, observer, true, true);
  return Horizon(date, observer, topo.ra, topo.dec, 'normal').altitude;
}

function describePhase(phase, place) {
  if (!place) return { ...phase, altitude: null, up: null, rise: null, set: null, viewDate: phase.date };
  const observer = new Observer(place.latitude, place.longitude, place.height || 0);
  const altitude = moonAltitude(observer, phase.date);
  const up = altitude >= 0;
  const riseEvent = SearchRiseSet(Body.Moon, observer, +1, phase.date, up ? -1.5 : 1.5);
  const rise = riseEvent ? riseEvent.date : null;
  const setStart = up ? phase.date : (rise ?? phase.date);
  const setEvent = SearchRiseSet(Body.Moon, observer, -1, setStart, up ? 1.5 : 2);
  const set = setEvent ? setEvent.date : null;
  const viewDate = phase.name === 'New Moon' || up ? phase.date : (rise ?? phase.date);
  return { ...phase, altitude, up, rise, set, viewDate };
}

/**
 * Upcoming Moon phases as seen from a place: whether the Moon is up
 * at that moment, and the rise and set that bracket the view.
 * A phase stays in the list through moonset, so opening its rise
 * does not skip ahead to the next cycle.
 */
export function moonPhaseViews(date, place) {
  const lookback = new Date(date.getTime() - 20 * 60 * 60 * 1000);
  const stillUp = (phase) => (phase.set ?? phase.viewDate).getTime() >= date.getTime() - 2 * 60_000;
  const current = nextMoonPhases(lookback)
    .map((phase) => describePhase(phase, place))
    .filter(stillUp);
  if (current.length >= 4) return current.slice(0, 4);
  const seen = new Set(current.map((phase) => phase.name));
  const later = nextMoonPhases(date)
    .map((phase) => describePhase(phase, place))
    .filter((phase) => !seen.has(phase.name));
  return [...current, ...later].sort((a, b) => a.date - b.date).slice(0, 4);
}

function wrap180(degrees) {
  return ((degrees + 180) % 360 + 360) % 360 - 180;
}

/**
 * Geocentric apparent position, rotated into Earth-fixed coordinates.
 * X points at longitude 0, Y at longitude 90° east, Z at the north pole.
 * Distance is true (meters), so the Moon can be drawn to scale.
 */
function earthFixedPosition(body, date) {
  const eqj = GeoVector(body, date, true);
  const eqd = RotateVector(Rotation_EQJ_EQD(date), eqj);
  const gast = SiderealTime(date) * 15 * (Math.PI / 180);
  const cos = Math.cos(gast);
  const sin = Math.sin(gast);
  const x = (eqd.x * cos + eqd.y * sin) * AU_METERS;
  const y = (-eqd.x * sin + eqd.y * cos) * AU_METERS;
  const z = eqd.z * AU_METERS;
  const equ = EquatorFromVector(eqd);
  const j2000 = EquatorFromVector(eqj);
  return {
    x,
    y,
    z,
    raHours: equ.ra,
    decDeg: equ.dec,
    j2000Ra: j2000.ra,
    j2000Dec: j2000.dec,
    distanceAu: Math.hypot(eqd.x, eqd.y, eqd.z),
  };
}

function optional(fn) {
  try {
    return fn();
  } catch {
    return null;
  }
}

/**
 * @param {Date} date
 * @param {{ latitude: number, longitude: number, height: number } | null} place
 */
export function computeSky(date, place) {
  const observer = place
    ? new Observer(place.latitude, place.longitude, place.height || 0)
    : null;

  const bodies = BODIES.map((meta) => {
    const body = Body[meta.id];
    const fixed = earthFixedPosition(body, date);
    const constellation = Constellation(fixed.j2000Ra, fixed.j2000Dec);
    const illumination = optional(() => Illumination(body, date));
    const elongation = meta.id === 'Sun' ? null : optional(() => Elongation(body, date));
    let altitude = null;
    let azimuth = null;
    if (observer) {
      const topo = Equator(body, date, observer, true, true);
      const horizontal = Horizon(date, observer, topo.ra, topo.dec, 'normal');
      altitude = horizontal.altitude;
      azimuth = horizontal.azimuth;
    }

    return {
      ...meta,
      radiusM: meta.id === 'Moon' ? MOON_RADIUS_M : null,
      x: fixed.x,
      y: fixed.y,
      z: fixed.z,
      raHours: fixed.raHours,
      decDeg: fixed.decDeg,
      distanceAu: fixed.distanceAu,
      distanceKm: fixed.distanceAu * (AU_METERS / 1000),
      constellation: constellation.name,
      magnitude: illumination ? illumination.mag : null,
      phaseFraction: illumination ? illumination.phase_fraction : null,
      ringTilt: illumination ? illumination.ring_tilt ?? null : null,
      elongation: elongation ? elongation.elongation : null,
      visibility: elongation ? elongation.visibility : null,
      moonPhase: meta.id === 'Moon' ? MoonPhase(date) : null,
      altitude,
      azimuth,
    };
  });

  return { date, bodies };
}

const TRACK_HOURS = 24;
const TRACK_STEP_MINUTES = 20;

/**
 * Overhead-point path for the next 24 hours, sampled every 20 minutes.
 * Longitude decreases westward as Earth turns.
 */
export function computeTracks(start = new Date()) {
  const steps = (TRACK_HOURS * 60) / TRACK_STEP_MINUTES;
  return BODIES.map((meta) => {
    const body = Body[meta.id];
    const samples = [];
    for (let i = 0; i <= steps; i += 1) {
      const date = new Date(start.getTime() + i * TRACK_STEP_MINUTES * 60 * 1000);
      const fixed = earthFixedPosition(body, date);
      samples.push({
        x: fixed.x,
        y: fixed.y,
        z: fixed.z,
        hours: (i * TRACK_STEP_MINUTES) / 60,
      });
    }
    return { id: meta.id, samples };
  });
}

export function riseSet(bodyId, place, date) {
  if (!place) return { rise: null, set: null };
  const observer = new Observer(place.latitude, place.longitude, place.height || 0);
  const body = Body[bodyId];
  const rise = SearchRiseSet(body, observer, +1, date, 2);
  const set = SearchRiseSet(body, observer, -1, date, 2);
  return {
    rise: rise ? rise.date : null,
    set: set ? set.date : null,
  };
}
