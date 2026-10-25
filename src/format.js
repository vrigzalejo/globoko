const COMPASS = [
  'north',
  'northeast',
  'east',
  'southeast',
  'south',
  'southwest',
  'west',
  'northwest',
];

export function compass(azimuth) {
  const index = Math.round(azimuth / 45) % 8;
  return COMPASS[index];
}

export function formatMagnitude(value) {
  if (value == null || Number.isNaN(value)) return '—';
  const digits = Math.abs(value).toFixed(1);
  if (value < 0) return `−${digits}`;
  if (value > 0) return `+${digits}`;
  return '0.0';
}

export function formatLatLon(lat, lon) {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}° ${ns}, ${Math.abs(lon).toFixed(2)}° ${ew}`;
}

export function formatRa(hours) {
  const whole = Math.floor(hours);
  const minutes = Math.floor((hours - whole) * 60);
  return `${whole}h ${String(minutes).padStart(2, '0')}m`;
}

export function formatDec(degrees) {
  const sign = degrees >= 0 ? '+' : '−';
  const absolute = Math.abs(degrees);
  const whole = Math.floor(absolute);
  const minutes = Math.floor((absolute - whole) * 60);
  return `${sign}${whole}° ${String(minutes).padStart(2, '0')}′`;
}

export function formatDistance(body) {
  if (body.distanceKm < 2_000_000) {
    return `${Math.round(body.distanceKm).toLocaleString()} km`;
  }
  if (body.distanceAu < 0.2) {
    return `${(body.distanceKm / 1_000_000).toFixed(2)} million km`;
  }
  return `${body.distanceAu.toFixed(3)} AU`;
}

export function formatLightTime(distanceKm) {
  const seconds = distanceKm / 299792.458;
  if (seconds < 90) return `${seconds.toFixed(1)} seconds`;
  if (seconds < 90 * 60) return `${(seconds / 60).toFixed(1)} minutes`;
  return `${(seconds / 3600).toFixed(1)} hours`;
}

export function formatAltitude(altitude, azimuth) {
  if (altitude == null || azimuth == null) return null;
  const direction = compass(azimuth);
  const degrees = Math.abs(altitude).toFixed(0);
  if (altitude >= 0) return `${degrees}° up · ${direction}`;
  return `${degrees}° below · ${direction}`;
}

export function formatAltitudeSentence(altitude, azimuth) {
  if (altitude == null || azimuth == null) return null;
  const direction = compass(azimuth);
  const degrees = Math.abs(altitude).toFixed(0);
  if (altitude >= 0) {
    return `${degrees}° above the horizon, toward the ${direction}`;
  }
  return `${degrees}° below the horizon, toward the ${direction}`;
}

export function moonPhaseName(degrees) {
  const d = ((degrees % 360) + 360) % 360;
  if (d < 8 || d >= 352) return 'New Moon';
  if (d < 82) return 'Waxing crescent';
  if (d < 98) return 'First quarter';
  if (d < 172) return 'Waxing gibbous';
  if (d < 188) return 'Full Moon';
  if (d < 262) return 'Waning gibbous';
  if (d < 278) return 'Last quarter';
  return 'Waning crescent';
}

function zoneOptions(timeZone) {
  return timeZone ? { timeZone } : {};
}

function formatHour(date, timeZone) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    ...zoneOptions(timeZone),
  }).format(date);
}

/** Calendar and clock parts for `date` in `timeZone`, or this device if omitted. */
export function wallTimeParts(date, timeZone) {
  const parts = {};
  for (const part of new Intl.DateTimeFormat('en-US', {
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    ...zoneOptions(timeZone),
  }).formatToParts(date)) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second || 0),
  };
}

/** Instant that shows as this wall clock in `timeZone`, or this device if omitted. */
export function dateFromWallTime(parts, timeZone) {
  const year = parts.year;
  const month = parts.month;
  const day = parts.day;
  const hour = parts.hour ?? 0;
  const minute = parts.minute ?? 0;
  const second = parts.second ?? 0;
  if (!timeZone) return new Date(year, month - 1, day, hour, minute, second, 0);
  const desired = Date.UTC(year, month - 1, day, hour, minute, second);
  let guess = desired;
  for (let step = 0; step < 4; step += 1) {
    const seen = wallTimeParts(new Date(guess), timeZone);
    const asUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute, seen.second);
    guess += desired - asUtc;
  }
  return new Date(guess);
}

export function fieldDate(date, timeZone) {
  const parts = wallTimeParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function fieldTime(date, timeZone) {
  const parts = wallTimeParts(date, timeZone);
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

function dayKey(date, timeZone) {
  const parts = wallTimeParts(date, timeZone);
  return Date.UTC(parts.year, parts.month - 1, parts.day);
}

/** How the Moon sits in the sky at a phase, from a chosen place. */
export function formatPhaseSight(phase, timeZone) {
  if (phase.altitude == null) return '';
  if (phase.name === 'New Moon') {
    return phase.up
      ? 'Up with the Sun, too close to see'
      : 'Below the horizon, too close to the Sun to see';
  }
  if (phase.up) {
    const height = `${Math.round(phase.altitude)}° up`;
    return phase.set ? `${height}, sets ${formatHour(phase.set, timeZone)}` : height;
  }
  if (phase.rise) {
    const until = phase.set ? `, up until ${formatHour(phase.set, timeZone)}` : '';
    return `Rises ${formatHour(phase.rise, timeZone)}${until}`;
  }
  return 'Below the horizon';
}

export function formatPhaseWhen(date, from = new Date(), timeZone) {
  const when = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    ...zoneOptions(timeZone),
  }).format(date);
  const days = Math.round((dayKey(date, timeZone) - dayKey(from, timeZone)) / 86_400_000);
  let relative = `in ${days} days`;
  if (days === 0) relative = 'today';
  else if (days === 1) relative = 'tomorrow';
  else if (days === -1) relative = 'yesterday';
  else if (days < -1) relative = `${Math.abs(days)} days ago`;
  return `${when} · ${relative}`;
}

export function formatWhen(date, timeZone) {
  if (!date) return 'None in the next 2 days';
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    ...zoneOptions(timeZone),
  }).format(date);
}

export function zonesMatch(timeZone, date = new Date()) {
  const stamp = (zone) => new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
  try {
    return stamp() === stamp(timeZone);
  } catch {
    return false;
  }
}

export function formatPlaceClock(date, timeZone, label) {
  const here = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(date);
  const there = new Intl.DateTimeFormat(undefined, {
    timeZone,
    month: 'short',
    day: 'numeric',
  }).format(date);
  const time = new Intl.DateTimeFormat(undefined, {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  }).format(date);
  return there === here ? `${label} · ${time}` : `${label} · ${there}, ${time}`;
}

export function formatClock(date, timeZone) {
  const local = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    ...(timeZone ? { timeZone, timeZoneName: 'short' } : {}),
  }).format(date);
  const utc = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'UTC',
    hourCycle: 'h23',
  }).format(date);
  return { local, utc: `${utc} UTC` };
}
