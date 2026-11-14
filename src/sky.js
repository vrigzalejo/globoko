import {
  Body,
  Constellation,
  Elongation,
  Equator,
  EquatorFromVector,
  GeoVector,
  HelioVector,
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
import {
  ASTEROID_IDS,
  asteroidHelioEqj,
  asteroidMagnitude,
  asteroidPeriodDays,
} from './asteroids.js';
import {
  COMET_IDS,
  cometHelioEqj,
  cometMagnitude,
  cometPeriodDays,
} from './comets.js';
import { activeShowers } from './meteors.js';

/** IAU nominal astronomical unit, in meters. */
export const AU_METERS = 149597870700;

/**
 * One astronomical unit on the globe, in meters.
 * The Sun sits about here, and the outer planets land tens of times farther,
 * which is near enough that a zoom out can frame them.
 */
export const AU_DISPLAY_M = 8_000_000_000;

/** Group headers in the sky list. `kind` on each body picks the section. */
export const BODY_KINDS = [
  { id: 'star', label: 'Star', singular: 'Star' },
  { id: 'moon', label: 'Moon', singular: 'Moon' },
  { id: 'planet', label: 'Planets', singular: 'Planet' },
  { id: 'dwarf', label: 'Dwarf planets', singular: 'Dwarf planet' },
  { id: 'asteroid', label: 'Asteroids', singular: 'Asteroid' },
  { id: 'comet', label: 'Comets', singular: 'Comet' },
];

export const KIND_LABEL = Object.fromEntries(
  BODY_KINDS.map((kind) => [kind.id, kind.singular]),
);

const KEPLER_IDS = new Set([...ASTEROID_IDS, ...COMET_IDS]);

function keplerHelioEqj(id, date) {
  return asteroidHelioEqj(id, date) ?? cometHelioEqj(id, date);
}

function keplerMagnitude(id, helioAu, geoAu, phaseAngleDeg) {
  return asteroidMagnitude(id, helioAu, geoAu, phaseAngleDeg)
    ?? cometMagnitude(id, helioAu, geoAu);
}

function keplerPeriodDays(id) {
  return asteroidPeriodDays(id) ?? cometPeriodDays(id);
}

export const BODIES = [
  { id: 'Sun', label: 'Sun', color: '#ffb020', kind: 'star' },
  { id: 'Moon', label: 'Moon', color: '#d5dde8', kind: 'moon' },
  { id: 'Mercury', label: 'Mercury', color: '#c8b8a2', kind: 'planet' },
  { id: 'Venus', label: 'Venus', color: '#f0d7a2', kind: 'planet' },
  { id: 'Mars', label: 'Mars', color: '#e06a45', kind: 'planet' },
  { id: 'Jupiter', label: 'Jupiter', color: '#e2b48a', kind: 'planet' },
  { id: 'Saturn', label: 'Saturn', color: '#ecd59a', kind: 'planet' },
  { id: 'Uranus', label: 'Uranus', color: '#7fd4cb', kind: 'planet' },
  { id: 'Neptune', label: 'Neptune', color: '#6c9dff', kind: 'planet' },
  { id: 'Pluto', label: 'Pluto', color: '#d7b49a', kind: 'dwarf' },
  { id: 'Ceres', label: 'Ceres', color: '#b7c0cc', kind: 'dwarf' },
  { id: 'Vesta', label: 'Vesta', color: '#c9b89a', kind: 'asteroid' },
  { id: 'Halley', label: 'Halley', color: '#9ec8ff', kind: 'comet' },
  { id: 'Encke', label: 'Encke', color: '#b7dff0', kind: 'comet' },
  { id: '67P', label: '67P', color: '#c5d6e8', kind: 'comet' },
];

const ORBIT_DAYS = {
  Mercury: 87.969,
  Venus: 224.701,
  Earth: 365.256,
  Mars: 686.98,
  Jupiter: 4332.59,
  Saturn: 10759.22,
  Uranus: 30688.5,
  Neptune: 60182,
  Pluto: 90560,
  Ceres: keplerPeriodDays('Ceres'),
  Vesta: keplerPeriodDays('Vesta'),
  Halley: keplerPeriodDays('Halley'),
  Encke: keplerPeriodDays('Encke'),
  '67P': keplerPeriodDays('67P'),
};

const EARTH_ORBIT_COLOR = '#8eb4d4';

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
 * Geocentric EQJ vector → Earth-fixed meters and sky coordinates.
 * X points at longitude 0, Y at longitude 90° east, Z at the north pole.
 */
function fixedFromEqj(eqj, date) {
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
    eqj,
  };
}

/**
 * Geocentric apparent position, rotated into Earth-fixed coordinates.
 * Distance is true (meters), so the Moon can be drawn to scale.
 */
function earthFixedPosition(body, date) {
  return fixedFromEqj(GeoVector(body, date, true), date);
}

function keplerFixedPosition(id, date, earthHelio) {
  const helio = keplerHelioEqj(id, date);
  if (!helio) return null;
  const eqj = {
    x: helio.x - earthHelio.x,
    y: helio.y - earthHelio.y,
    z: helio.z - earthHelio.z,
  };
  const fixed = fixedFromEqj(eqj, date);
  const helioDist = Math.hypot(helio.x, helio.y, helio.z);
  const geoDist = fixed.distanceAu;
  const toSun = { x: -helio.x, y: -helio.y, z: -helio.z };
  const toEarth = {
    x: earthHelio.x - helio.x,
    y: earthHelio.y - helio.y,
    z: earthHelio.z - helio.z,
  };
  const cosPhase = (
    toSun.x * toEarth.x + toSun.y * toEarth.y + toSun.z * toEarth.z
  ) / ((helioDist * Math.hypot(toEarth.x, toEarth.y, toEarth.z)) || 1);
  const phaseAngle = Math.acos(Math.max(-1, Math.min(1, cosPhase))) * (180 / Math.PI);
  return {
    ...fixed,
    helio,
    helioDist,
    magnitude: keplerMagnitude(id, helioDist, geoDist, phaseAngle),
  };
}

/**
 * J2000 equatorial direction, in the same Earth-fixed frame as the planets.
 * `raHours` is right ascension in hours, `decDeg` is declination in degrees.
 */
export function fixedSky(raHours, decDeg, date, radius = 1) {
  const ra = raHours * (Math.PI / 12);
  const dec = decDeg * (Math.PI / 180);
  const cosDec = Math.cos(dec);
  const turned = eqjAuToDisplay(cosDec * Math.cos(ra), cosDec * Math.sin(ra), Math.sin(dec), date);
  const span = Math.hypot(turned.x, turned.y, turned.z) || 1;
  const scale = radius / span;
  return {
    x: turned.x * scale,
    y: turned.y * scale,
    z: turned.z * scale,
  };
}

function eqjAuToDisplay(x, y, z, date) {
  const eqd = RotateVector(Rotation_EQJ_EQD(date), { x, y, z });
  const gast = SiderealTime(date) * 15 * (Math.PI / 180);
  const cos = Math.cos(gast);
  const sin = Math.sin(gast);
  return {
    x: (eqd.x * cos + eqd.y * sin) * AU_DISPLAY_M,
    y: (-eqd.x * sin + eqd.y * cos) * AU_DISPLAY_M,
    z: eqd.z * AU_DISPLAY_M,
  };
}

const ECLIPTIC_NORTH_EQJ = { x: 0, y: -0.397776, z: 0.917482 };

/** Unit vector, in Earth-fixed coordinates, toward the north ecliptic pole. */
export function eclipticNorth(date) {
  const turned = eqjAuToDisplay(
    ECLIPTIC_NORTH_EQJ.x,
    ECLIPTIC_NORTH_EQJ.y,
    ECLIPTIC_NORTH_EQJ.z,
    date,
  );
  const span = Math.hypot(turned.x, turned.y, turned.z) || 1;
  return { x: turned.x / span, y: turned.y / span, z: turned.z / span };
}

function systemPlace(body, earthHelio, date, asteroidHelio = null) {
  if (body === Body.Moon) return null;
  const helio = asteroidHelio
    ?? (body === Body.Sun ? { x: 0, y: 0, z: 0 } : HelioVector(body, date));
  return eqjAuToDisplay(helio.x - earthHelio.x, helio.y - earthHelio.y, helio.z - earthHelio.z, date);
}

/**
 * Orbit rings in the same display frame as the planet markers.
 * Earth stays at the origin, so each ring is the planet's path around the Sun
 * as it stands right now.
 */
export function solarOrbits(date, count = 96) {
  const earth = HelioVector(Body.Earth, date);
  const when = new Date(date.getTime());
  return Object.entries(ORBIT_DAYS).map(([id, days]) => {
    if (!days) return null;
    const meta = BODIES.find((body) => body.id === id);
    const positions = [];
    const step = days * 86400000 / count;
    for (let i = 0; i <= count; i += 1) {
      when.setTime(date.getTime() + i * step);
      const helio = KEPLER_IDS.has(id)
        ? keplerHelioEqj(id, when)
        : HelioVector(Body[id], when);
      if (!helio) continue;
      const point = eqjAuToDisplay(helio.x - earth.x, helio.y - earth.y, helio.z - earth.z, date);
      const span = point.x * point.x + point.y * point.y + point.z * point.z;
      if (span < 1e12) continue;
      positions.push(point);
    }
    return { id, days, color: meta?.color ?? EARTH_ORBIT_COLOR, positions };
  }).filter(Boolean);
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
  const earthHelio = HelioVector(Body.Earth, date);

  const bodies = BODIES.map((meta) => {
    if (KEPLER_IDS.has(meta.id)) {
      const fixed = keplerFixedPosition(meta.id, date, earthHelio);
      const constellation = Constellation(fixed.j2000Ra, fixed.j2000Dec);
      let altitude = null;
      let azimuth = null;
      if (observer) {
        const horizontal = Horizon(date, observer, fixed.raHours, fixed.decDeg, 'normal');
        altitude = horizontal.altitude;
        azimuth = horizontal.azimuth;
      }
      const sunGeo = earthFixedPosition(Body.Sun, date);
      const elongation = Math.acos(Math.max(-1, Math.min(1, (
        fixed.eqj.x * sunGeo.eqj.x + fixed.eqj.y * sunGeo.eqj.y + fixed.eqj.z * sunGeo.eqj.z
      ) / ((fixed.distanceAu * sunGeo.distanceAu) || 1)))) * (180 / Math.PI);
      return {
        ...meta,
        radiusM: null,
        x: fixed.x,
        y: fixed.y,
        z: fixed.z,
        system: systemPlace(null, earthHelio, date, fixed.helio),
        raHours: fixed.raHours,
        decDeg: fixed.decDeg,
        distanceAu: fixed.distanceAu,
        distanceKm: fixed.distanceAu * (AU_METERS / 1000),
        constellation: constellation.name,
        magnitude: fixed.magnitude,
        phaseFraction: null,
        ringTilt: null,
        elongation,
        visibility: elongation < 20 ? 'day' : 'night',
        moonPhase: null,
        altitude,
        azimuth,
      };
    }

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
      system: systemPlace(body, earthHelio, date),
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

  return { date, bodies, showers: activeShowers(date) };
}

const TRACK_HOURS = 24;
const TRACK_STEP_MINUTES = 20;

/**
 * Overhead-point path for the next 24 hours, sampled every 20 minutes.
 * Longitude decreases westward as Earth turns.
 */
export function computeTracks(start = new Date()) {
  const steps = (TRACK_HOURS * 60) / TRACK_STEP_MINUTES;
  const dates = [];
  const earthHelios = [];
  for (let i = 0; i <= steps; i += 1) {
    const date = new Date(start.getTime() + i * TRACK_STEP_MINUTES * 60 * 1000);
    dates.push(date);
    earthHelios.push(HelioVector(Body.Earth, date));
  }
  return BODIES.map((meta) => {
    const samples = dates.map((date, index) => {
      if (KEPLER_IDS.has(meta.id)) {
        const fixed = keplerFixedPosition(meta.id, date, earthHelios[index]);
        return {
          x: fixed.x,
          y: fixed.y,
          z: fixed.z,
          display: systemPlace(null, earthHelios[index], date, fixed.helio),
          hours: (index * TRACK_STEP_MINUTES) / 60,
        };
      }
      const body = Body[meta.id];
      const fixed = earthFixedPosition(body, date);
      const display = systemPlace(body, earthHelios[index], date);
      return {
        x: fixed.x,
        y: fixed.y,
        z: fixed.z,
        display,
        hours: (index * TRACK_STEP_MINUTES) / 60,
      };
    });
    return { id: meta.id, samples };
  });
}

function keplerAltitude(id, place, date) {
  const earthHelio = HelioVector(Body.Earth, date);
  const fixed = keplerFixedPosition(id, date, earthHelio);
  const observer = new Observer(place.latitude, place.longitude, place.height || 0);
  return Horizon(date, observer, fixed.raHours, fixed.decDeg, 'normal').altitude;
}

function searchKeplerRiseSet(id, place, direction, start, days) {
  const stepMs = 20 * 60_000;
  const end = start.getTime() + days * 86400000;
  let prev = keplerAltitude(id, place, start);
  for (let time = start.getTime() + stepMs; time <= end; time += stepMs) {
    const date = new Date(time);
    const altitude = keplerAltitude(id, place, date);
    const crossed = direction > 0
      ? prev < 0 && altitude >= 0
      : prev >= 0 && altitude < 0;
    if (crossed) {
      let lo = time - stepMs;
      let hi = time;
      for (let i = 0; i < 18; i += 1) {
        const mid = new Date((lo + hi) / 2);
        const midAlt = keplerAltitude(id, place, mid);
        if ((direction > 0 && midAlt >= 0) || (direction < 0 && midAlt < 0)) hi = mid.getTime();
        else lo = mid.getTime();
      }
      return new Date((lo + hi) / 2);
    }
    prev = altitude;
  }
  return null;
}

export function riseSet(bodyId, place, date) {
  if (!place) return { rise: null, set: null };
  if (KEPLER_IDS.has(bodyId)) {
    return {
      rise: searchKeplerRiseSet(bodyId, place, +1, date, 2),
      set: searchKeplerRiseSet(bodyId, place, -1, date, 2),
    };
  }
  const observer = new Observer(place.latitude, place.longitude, place.height || 0);
  const body = Body[bodyId];
  const rise = SearchRiseSet(body, observer, +1, date, 2);
  const set = SearchRiseSet(body, observer, -1, date, 2);
  return {
    rise: rise ? rise.date : null,
    set: set ? set.date : null,
  };
}
