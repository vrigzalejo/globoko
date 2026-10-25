import assert from 'node:assert/strict';
import test from 'node:test';
import {
  dateFromWallTime,
  fieldDate,
  fieldTime,
  formatClock,
  wallTimeParts,
} from './format.js';

test('wall time round-trips through Tokyo', () => {
  const zone = 'Asia/Tokyo';
  const instant = dateFromWallTime({
    year: 2026,
    month: 10,
    day: 24,
    hour: 21,
    minute: 30,
  }, zone);
  const parts = wallTimeParts(instant, zone);
  assert.equal(parts.year, 2026);
  assert.equal(parts.month, 10);
  assert.equal(parts.day, 24);
  assert.equal(parts.hour, 21);
  assert.equal(parts.minute, 30);
  assert.equal(fieldDate(instant, zone), '2026-10-24');
  assert.equal(fieldTime(instant, zone), '21:30');
});

test('the main clock can show a place timezone', () => {
  const instant = dateFromWallTime({
    year: 2026,
    month: 6,
    day: 15,
    hour: 9,
    minute: 5,
    second: 0,
  }, 'America/New_York');
  const clock = formatClock(instant, 'America/New_York');
  assert.match(clock.local, /9:05/);
  assert.match(clock.utc, /UTC$/);
});
