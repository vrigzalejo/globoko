/** Stored shape an account can sync later. Version 1: id, name, latitude, longitude, timeZone. */
export const PLACES_KEY = 'globoko.places';
const SAME_PLACE_DEGREES = 0.05;

export function sameSpot(a, b) {
  return Math.abs(a.latitude - b.latitude) < SAME_PLACE_DEGREES
    && Math.abs(a.longitude - b.longitude) < SAME_PLACE_DEGREES;
}

function cleanPlace(value) {
  if (!value || typeof value !== 'object') return null;
  const { id, name, latitude, longitude, timeZone } = value;
  if (typeof id !== 'string' || id.length === 0 || id.length > 80) return null;
  if (typeof name !== 'string' || name.trim() === '' || name.length > 200) return null;
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  if (timeZone != null && (typeof timeZone !== 'string' || timeZone.length > 80)) return null;
  return {
    id,
    name: name.trim(),
    latitude,
    longitude,
    timeZone: timeZone ?? null,
  };
}

export function readPlaces(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(PLACES_KEY) ?? 'null');
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.places)) return [];
    const places = [];
    for (const entry of parsed.places) {
      const place = cleanPlace(entry);
      if (!place || places.some((kept) => kept.id === place.id)) continue;
      places.push(place);
      if (places.length >= 100) break;
    }
    return places;
  } catch {
    return [];
  }
}

export function writePlaces(storage, places) {
  try {
    storage.setItem(PLACES_KEY, JSON.stringify({ version: 1, places }));
    return true;
  } catch {
    return false;
  }
}

function preferName(current, next) {
  if (!next) return current;
  if (!current || current === 'your location') return next;
  if (next === 'your location') return current;
  return next.length >= current.length ? next : current;
}

/**
 * Adds a place until `limit`. The same spot updates its name and does not take
 * another slot. `full` leaves the list unchanged.
 */
export function rememberSavedPlace(places, draft, limit) {
  const candidate = cleanPlace({
    id: draft.id ?? 'draft',
    name: draft.name,
    latitude: draft.latitude,
    longitude: draft.longitude,
    timeZone: draft.timeZone ?? null,
  });
  if (!candidate) return { places, place: null, status: 'invalid' };

  const existing = places.find((place) => sameSpot(place, candidate));
  if (existing) {
    const name = preferName(existing.name, candidate.name);
    const timeZone = candidate.timeZone ?? existing.timeZone;
    if (name === existing.name && timeZone === existing.timeZone) {
      return { places, place: existing, status: 'kept' };
    }
    const place = { ...existing, name, timeZone };
    return {
      places: places.map((entry) => (entry.id === existing.id ? place : entry)),
      place,
      status: 'kept',
    };
  }

  if (places.length >= limit) return { places, place: null, status: 'full' };

  const place = {
    id: crypto.randomUUID(),
    name: candidate.name,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    timeZone: candidate.timeZone,
  };
  return { places: [...places, place], place, status: 'added' };
}

export function removePlace(places, id) {
  return places.filter((place) => place.id !== id);
}
