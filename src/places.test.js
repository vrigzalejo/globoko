import assert from 'node:assert/strict';
import test from 'node:test';
import { PLANS, currentPlan, planById } from './plan.js';
import {
  PLACES_KEY,
  readPlaces,
  rememberSavedPlace,
  removePlace,
  writePlaces,
} from './places.js';

function memory() {
  const data = new Map();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
  };
}

test('the app follows the free plan until billing exists', () => {
  assert.equal(currentPlan().id, 'free');
  assert.equal(currentPlan().savedPlaces, 3);
  assert.equal(currentPlan().pastMinutes, 24 * 60);
  assert.equal(currentPlan().futureMinutes, 2 * 24 * 60);
  assert.ok(PLANS.plus.savedPlaces > PLANS.free.savedPlaces);
  assert.ok(PLANS.plus.futureMinutes > PLANS.free.futureMinutes);
  assert.equal(planById('missing').id, 'free');
});

test('a place is kept on this device and a repeat visit does not take another slot', () => {
  const storage = memory();
  const limit = currentPlan().savedPlaces;
  let places = readPlaces(storage);
  const first = rememberSavedPlace(places, {
    name: 'your location',
    latitude: 48.85,
    longitude: 2.35,
    timeZone: 'Europe/Paris',
  }, limit);
  assert.equal(first.status, 'added');
  places = first.places;
  const again = rememberSavedPlace(places, {
    name: 'Paris, France',
    latitude: 48.86,
    longitude: 2.35,
    timeZone: 'Europe/Paris',
  }, limit);
  assert.equal(again.status, 'kept');
  assert.equal(again.places.length, 1);
  assert.equal(again.place.name, 'Paris, France');
  const located = rememberSavedPlace(again.places, {
    name: 'your location',
    latitude: 48.85,
    longitude: 2.34,
    timeZone: 'Europe/Paris',
  }, limit);
  assert.equal(located.status, 'kept');
  assert.equal(located.place.name, 'Paris, France');
  assert.equal(writePlaces(storage, again.places), true);
  const stored = readPlaces(storage);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].id, again.place.id);
  assert.equal(JSON.parse(storage.getItem(PLACES_KEY)).version, 1);
});

test('the free limit refuses another place and keeps the ones already stored', () => {
  let places = [];
  const limit = PLANS.free.savedPlaces;
  for (let index = 0; index < limit; index += 1) {
    const result = rememberSavedPlace(places, {
      name: `Place ${index}`,
      latitude: index,
      longitude: 10,
      timeZone: null,
    }, limit);
    assert.equal(result.status, 'added');
    places = result.places;
  }
  const refused = rememberSavedPlace(places, {
    name: 'One more',
    latitude: 40,
    longitude: 10,
    timeZone: null,
  }, limit);
  assert.equal(refused.status, 'full');
  assert.equal(refused.places.length, limit);
  assert.equal(refused.places, places);
});

test('removing a place frees its slot', () => {
  const added = rememberSavedPlace([], {
    name: 'Tokyo, Japan',
    latitude: 35.68,
    longitude: 139.76,
    timeZone: 'Asia/Tokyo',
  }, 3);
  assert.deepEqual(removePlace(added.places, added.place.id), []);
});

test('broken storage is an empty list', () => {
  const storage = {
    getItem() {
      return '{';
    },
  };
  assert.deepEqual(readPlaces(storage), []);
});
