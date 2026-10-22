import 'cesium/Build/Cesium/Widgets/widgets.css';
import './style.css';
import tzlookup from 'tz-lookup';
import { createGlobe } from './globe.js';
import { currentPlan } from './plan.js';
import { readPlaces, rememberSavedPlace, removePlace, sameSpot, writePlaces } from './places.js';
import { BODIES, computeSky, computeTracks, moonPhaseViews, riseSet } from './sky.js';
import {
  formatAltitude,
  formatAltitudeSentence,
  formatClock,
  formatDec,
  formatPlaceClock,
  formatDistance,
  formatLatLon,
  formatLightTime,
  formatMagnitude,
  formatPhaseSight,
  formatPhaseWhen,
  formatRa,
  formatWhen,
  moonPhaseName,
  zonesMatch,
} from './format.js';

const FACTS = [
  ['distance', 'Distance'],
  ['light', 'Light time'],
  ['magnitude', 'Magnitude'],
  ['phase', 'Lit'],
  ['elongation', 'From the Sun'],
  ['constellation', 'Constellation'],
  ['ra', 'Right ascension'],
  ['dec', 'Declination'],
  ['rise', 'Rises'],
  ['set', 'Sets'],
  ['rings', 'Ring tilt'],
];

const list = document.getElementById('bodies');
const factRoot = document.getElementById('facts');
const factNodes = new Map();

for (const [key, label] of FACTS) {
  const wrap = document.createElement('div');
  wrap.dataset.fact = key;
  const dt = document.createElement('dt');
  dt.textContent = label;
  const dd = document.createElement('dd');
  dd.textContent = '—';
  wrap.append(dt, dd);
  factRoot.append(wrap);
  factNodes.set(key, { wrap, dd });
}

const rows = new Map();
for (const meta of BODIES) {
  const item = document.createElement('li');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'body';
  button.style.setProperty('--body', meta.color);
  button.innerHTML = `
    <span class="swatch"></span>
    <span>
      <span class="body-name">${meta.label}</span>
      <span class="body-where"></span>
      <span class="body-meta"></span>
    </span>
    <span class="body-mag"></span>
  `;
  button.addEventListener('click', () => select(meta.id, true));
  item.append(button);
  list.append(item);
  rows.set(meta.id, {
    button,
    where: button.querySelector('.body-where'),
    meta: button.querySelector('.body-meta'),
    mag: button.querySelector('.body-mag'),
  });
}

const globe = createGlobe(
  document.getElementById('cesiumContainer'),
  document.getElementById('credit'),
);

const clockLocal = document.getElementById('clock-local');
const clockUtc = document.getElementById('clock-utc');
const clockPlace = document.getElementById('clock-place');
const clockLive = document.getElementById('clock-live');
const liveBadge = document.getElementById('live-badge');
const liveLabel = document.getElementById('live-label');
const detailName = document.getElementById('detail-name');
const detailSky = document.getElementById('detail-sky');
const detailOverhead = document.getElementById('detail-overhead');
const placeLabel = document.getElementById('place-label');
const savePlaceButton = document.getElementById('save-place');
const clearPlace = document.getElementById('clear-place');
const savedList = document.getElementById('saved-places');
const savedNote = document.getElementById('saved-note');
const loader = document.getElementById('loader');
const panel = document.getElementById('panel');
const panelToggle = document.getElementById('panel-toggle');

let place = null;
let locateWatch = null;
let locateToken = 0;
let locateStatus = null;
let savedPlaces = readPlaces(localStorage);
let savedMarkupKey = '';
let storageError = false;
let bodies = [];
let selectedId = 'Sun';
let riseKey = '';
let riseInfo = { rise: null, set: null };
let revealed = false;
let viewed = null;

function reveal() {
  if (revealed) return;
  revealed = true;
  loader.classList.add('hide');
}

globe.viewer.scene.globe.tileLoadProgressEvent.addEventListener((remaining) => {
  if (remaining === 0) reveal();
});
setTimeout(reveal, 4000);

function skyDate() {
  return viewed ?? new Date();
}

function leadText(date) {
  const minutes = Math.round((date.getTime() - Date.now()) / 60000);
  const ahead = minutes >= 0;
  const abs = Math.abs(minutes);
  if (abs < 1) return 'Now';
  const hours = Math.floor(abs / 60);
  const rest = abs % 60;
  const way = ahead ? 'ahead' : 'ago';
  if (hours === 0) return `${rest}m ${way}`;
  if (rest === 0) return `${hours}h ${way}`;
  return `${hours}h ${rest}m ${way}`;
}

function renderClocks(date) {
  const clock = formatClock(date);
  clockLocal.textContent = clock.local;
  clockUtc.textContent = clock.utc;
  const traveling = viewed != null;
  clockLive.hidden = !traveling;
  liveBadge.classList.toggle('is-then', traveling);
  liveLabel.textContent = traveling ? 'Then' : 'Live';
  timeNow.disabled = !traveling;
  if (traveling) {
    clockLive.textContent = `Live ${formatClock(new Date()).local}`;
    timeLabel.textContent = leadText(viewed);
  } else {
    timeLabel.textContent = 'Now';
  }
  if (locateStatus) {
    clockPlace.hidden = false;
    clockPlace.textContent = locateStatus;
  } else {
    const zone = place?.timeZone;
    const now = new Date();
    const showPlace = Boolean(zone) && !zonesMatch(zone, now);
    clockPlace.hidden = !showPlace;
    if (showPlace) clockPlace.textContent = formatPlaceClock(now, zone, placeClockName(place.name));
  }
  fitPanel();
}

function fitPanel() {
  const bottom = document.getElementById('clock').getBoundingClientRect().bottom;
  document.documentElement.style.setProperty('--topbar-bottom', `${Math.ceil(bottom + 12)}px`);
}

window.addEventListener('resize', fitPanel);

function placeClockName(name) {
  if (!name || name === 'your location') return 'Your location';
  return name.split(',')[0];
}

function timeZoneAt(latitude, longitude) {
  try {
    return tzlookup(latitude, longitude);
  } catch {
    return null;
  }
}

function skyMoment(dayOffset, hour) {
  const target = new Date();
  target.setDate(target.getDate() + dayOffset);
  target.setHours(hour, 0, 0, 0);
  return target;
}

const TIME_FAR = 50 * 24 * 60;

function planBounds() {
  const plan = currentPlan();
  return { min: -plan.pastMinutes, max: plan.futureMinutes };
}

function jumpTo(date) {
  const minutes = Math.round((date.getTime() - Date.now()) / 60000);
  const bounds = planBounds();
  let min = bounds.min;
  let max = bounds.max;
  if (minutes > bounds.max) max = Math.min(TIME_FAR, Math.ceil(minutes / 60) * 60);
  if (minutes < bounds.min) min = Math.max(-TIME_FAR, Math.floor(minutes / 60) * 60);
  timeRange.min = String(min);
  timeRange.max = String(max);
  const clamped = Math.max(min, Math.min(max, minutes));
  timeRange.value = String(clamped);
  applyMinutes(clamped);
}

function applyMinutes(minutes, refreshPaths = true) {
  viewed = minutes === 0 ? null : new Date(Date.now() + minutes * 60_000);
  globe.setSkyTime(viewed);
  riseKey = '';
  if (refreshPaths) tracksAt = 0;
  tick();
}

function current() {
  return bodies.find((body) => body.id === selectedId) ?? null;
}

const narrow = window.matchMedia('(max-width: 959px)');

function collapseSheet() {
  if (!narrow.matches) return;
  panel.classList.remove('open');
  panelToggle.setAttribute('aria-expanded', 'false');
}

function select(id, fly) {
  selectedId = id;
  globe.select(id);
  for (const [key, row] of rows) {
    row.button.classList.toggle('selected', key === id);
  }
  const body = current();
  if (fly && body) {
    globe.centerOn(body.latitude, body.longitude);
    collapseSheet();
  }
  riseKey = '';
  renderDetail();
  scheduleRiseSet();
}

globe.whenSelect((id) => select(id, true));

function scheduleRiseSet() {
  const body = current();
  if (!place || !body) {
    riseInfo = { rise: null, set: null };
    renderDetail();
    return;
  }
  const bucket = Math.floor(skyDate().getTime() / 600000);
  const key = `${body.id}:${place.latitude.toFixed(3)}:${place.longitude.toFixed(3)}:${bucket}`;
  if (key === riseKey) return;
  riseKey = key;
  riseInfo = riseSet(body.id, place, skyDate());
  renderDetail();
}

function setFact(key, value) {
  const node = factNodes.get(key);
  const show = value != null && value !== '';
  node.wrap.hidden = !show;
  if (show) node.dd.textContent = value;
}

function renderDetail() {
  const body = current();
  if (!body) return;
  detailName.textContent = body.label;
  detailName.style.color = body.color;
  const sentence = formatAltitudeSentence(body.altitude, body.azimuth);
  detailSky.textContent = sentence ?? 'Set a place to see how high it is in the sky.';
  detailOverhead.textContent = `Straight up at ${formatLatLon(body.latitude, body.longitude)}`;

  const lit = body.phaseFraction == null ? null : `${Math.round(body.phaseFraction * 100)}%`;
  const phase = body.moonPhase == null ? lit : `${moonPhaseName(body.moonPhase)} · ${lit}`;
  const elongation = body.elongation == null
    ? null
    : `${body.elongation.toFixed(1)}° · ${body.visibility} sky`;

  setFact('distance', formatDistance(body));
  setFact('light', formatLightTime(body.distanceKm));
  setFact('magnitude', formatMagnitude(body.magnitude));
  setFact('phase', phase);
  setFact('elongation', elongation);
  setFact('constellation', body.constellation);
  setFact('ra', formatRa(body.raHours));
  setFact('dec', formatDec(body.decDeg));
  setFact('rise', place ? formatWhen(riseInfo.rise) : null);
  setFact('set', place ? formatWhen(riseInfo.set) : null);
  setFact('rings', body.ringTilt == null ? null : `${Math.abs(body.ringTilt).toFixed(1)}°`);

  placeLabel.textContent = locateStatus
    ?? (place
      ? `As seen from ${place.name}`
      : 'Set a place to see altitude, azimuth, rise, and set.');
  clearPlace.hidden = !place;
  renderSavedPlaces();
  renderPhases(body);
}

const phasesRoot = document.getElementById('phases');
const phaseList = document.getElementById('phase-list');
const phaseWhere = document.getElementById('phase-where');
const phaseHint = document.getElementById('phase-hint');
let phaseKey = '';

function renderPhases(body) {
  if (body.id !== 'Moon') {
    phasesRoot.hidden = true;
    return;
  }
  phasesRoot.hidden = false;
  phaseWhere.hidden = !place;
  phaseHint.hidden = Boolean(place);
  phaseWhere.textContent = place ? `Above the horizon from ${place.name}` : '';
  const when = skyDate();
  const placeKey = place ? `${place.latitude.toFixed(2)},${place.longitude.toFixed(2)}` : 'none';
  const bucket = Math.floor(when.getTime() / 600_000);
  const key = `${bucket}:${placeKey}`;
  if (key === phaseKey && phaseList.childElementCount) return;
  phaseKey = key;
  phaseList.replaceChildren();
  for (const phase of moonPhaseViews(when, place)) {
    const showing = Math.abs(phase.viewDate.getTime() - when.getTime()) < 2 * 60_000;
    const sight = formatPhaseSight(phase);
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.classList.toggle('is-current', showing);
    const name = document.createElement('strong');
    name.textContent = phase.name;
    const detail = document.createElement('small');
    const whenText = showing ? 'Showing this view' : formatPhaseWhen(phase.date);
    detail.textContent = sight ? `${whenText} · ${sight}` : whenText;
    button.append(name, detail);
    button.addEventListener('click', () => {
      jumpTo(phase.viewDate);
      collapseSheet();
    });
    item.append(button);
    phaseList.append(item);
  }
}

function locateMessage(error) {
  if (error?.code === 1) return 'Location was blocked. Search for a place instead.';
  if (error?.code === 3) return 'Location timed out. Try again.';
  if (error) return 'Location is unavailable. Search for a place instead.';
  return 'This browser cannot share your location.';
}

function showLocateStatus(message) {
  locateStatus = message;
  placeLabel.textContent = message;
  clockPlace.hidden = false;
  clockPlace.textContent = message;
  fitPanel();
}

function stopLocate() {
  locateToken += 1;
  if (locateWatch != null) {
    navigator.geolocation.clearWatch(locateWatch);
    locateWatch = null;
  }
}

function dismissLocate() {
  stopLocate();
  document.getElementById('locate').removeAttribute('aria-busy');
  locateStatus = null;
}

function locateMe() {
  const button = document.getElementById('locate');
  if (!navigator.geolocation) {
    showLocateStatus(locateMessage());
    return;
  }
  stopLocate();
  const token = locateToken;
  showLocateStatus('Finding your location…');
  button.setAttribute('aria-busy', 'true');
  locateWatch = navigator.geolocation.watchPosition(
    (position) => {
      if (token !== locateToken) return;
      stopLocate();
      button.removeAttribute('aria-busy');
      locateStatus = null;
      const { latitude, longitude } = position.coords;
      hideResults();
      searchInput.value = 'Your location';
      rememberPlace(latitude, longitude, 'Your location');
      usePlace(latitude, longitude, 'your location');
    },
    (error) => {
      if (token !== locateToken) return;
      stopLocate();
      button.removeAttribute('aria-busy');
      showLocateStatus(locateMessage(error));
    },
    { enableHighAccuracy: false, timeout: 30000, maximumAge: 300000 },
  );
}

function renderList() {
  for (const body of bodies) {
    const row = rows.get(body.id);
    const altitude = formatAltitude(body.altitude, body.azimuth);
    row.where.textContent = altitude ?? formatLatLon(body.latitude, body.longitude);
    row.meta.textContent = `${formatDistance(body)} · ${formatLightTime(body.distanceKm)} light`;
    row.mag.textContent = formatMagnitude(body.magnitude);
    row.button.classList.toggle('selected', body.id === selectedId);
  }
}

let tracksAt = 0;
let pathsOn = false;
const pathsButton = document.getElementById('paths');
const lede = document.getElementById('lede');

function refreshTracks() {
  const now = Date.now();
  if (now - tracksAt < 30_000) return;
  tracksAt = now;
  globe.setTracks(computeTracks(skyDate()));
}

pathsButton.addEventListener('click', () => {
  pathsOn = !pathsOn;
  pathsButton.setAttribute('aria-pressed', String(pathsOn));
  globe.setPathsVisible(pathsOn);
  lede.textContent = pathsOn
    ? 'Lines trace the next 24 hours. Arrows on the selected body show which way it goes.'
    : 'Pins mark where each body is straight overhead.';
  if (pathsOn) {
    tracksAt = 0;
    refreshTracks();
  }
});

function tick() {
  const date = skyDate();
  const sky = computeSky(date, place);
  bodies = globe.update(sky.bodies);
  if (pathsOn) refreshTracks();
  renderClocks(date);
  renderList();
  renderDetail();
  scheduleRiseSet();
}

function usePlace(latitude, longitude, name) {
  place = { latitude, longitude, height: 0, name, timeZone: timeZoneAt(latitude, longitude) };
  globe.setObserver(latitude, longitude, name);
  riseKey = '';
  globe.centerOn(latitude, longitude);
  collapseSheet();
  tick();
}

clearPlace.addEventListener('click', () => {
  dismissLocate();
  place = null;
  globe.clearObserver();
  riseKey = '';
  riseInfo = { rise: null, set: null };
  tick();
});

function renderSavedPlaces() {
  const plan = currentPlan();
  const here = place ? savedPlaces.find((entry) => sameSpot(entry, place)) : null;
  const markupKey = savedPlaces.map((entry) => `${entry.id}:${entry.name}`).join('|');
  if (markupKey !== savedMarkupKey) {
    savedMarkupKey = markupKey;
    savedList.replaceChildren();
    for (const entry of savedPlaces) {
      const item = document.createElement('li');
      item.dataset.id = entry.id;
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'saved-open';
      open.textContent = placeClockName(entry.name);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'saved-remove';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Remove ${placeClockName(entry.name)}`);
      item.append(open, remove);
      savedList.append(item);
    }
  }
  savedList.hidden = savedPlaces.length === 0;
  for (const item of savedList.children) {
    const entry = savedPlaces.find((candidate) => candidate.id === item.dataset.id);
    const open = item.querySelector('.saved-open');
    if (place && entry && sameSpot(entry, place)) open.setAttribute('aria-current', 'true');
    else open.removeAttribute('aria-current');
  }
  const full = Boolean(place) && !here && savedPlaces.length >= plan.savedPlaces;
  savePlaceButton.hidden = !place;
  savePlaceButton.disabled = Boolean(here) || full;
  savePlaceButton.textContent = here ? 'Saved' : 'Save';
  savePlaceButton.classList.toggle('is-saved', Boolean(here));
  if (storageError) {
    savedNote.hidden = false;
    savedNote.textContent = 'This browser could not store the place.';
    return;
  }
  savedNote.hidden = !full;
  if (full) savedNote.textContent = `You can keep ${plan.savedPlaces} places on this device.`;
}

function storeSavedPlaces(next) {
  if (!writePlaces(localStorage, next)) {
    storageError = true;
    renderSavedPlaces();
    return false;
  }
  storageError = false;
  savedPlaces = next;
  savedMarkupKey = '';
  return true;
}

savePlaceButton.addEventListener('click', () => {
  if (!place) return;
  const result = rememberSavedPlace(savedPlaces, place, currentPlan().savedPlaces);
  if (result.places === savedPlaces) {
    renderSavedPlaces();
    return;
  }
  if (storeSavedPlaces(result.places)) renderSavedPlaces();
});

savedList.addEventListener('click', (event) => {
  const item = event.target.closest('li');
  if (!item) return;
  const id = item.dataset.id;
  if (event.target.closest('.saved-remove')) {
    if (storeSavedPlaces(removePlace(savedPlaces, id))) renderSavedPlaces();
    return;
  }
  if (!event.target.closest('.saved-open')) return;
  const saved = savedPlaces.find((entry) => entry.id === id);
  if (!saved) return;
  searchInput.value = saved.name;
  rememberPlace(saved.latitude, saved.longitude, saved.name);
  usePlace(saved.latitude, saved.longitude, saved.name);
});

document.getElementById('zoom-in').addEventListener('click', () => globe.zoomIn());
document.getElementById('zoom-out').addEventListener('click', () => globe.zoomOut());
document.getElementById('zoom-original').addEventListener('click', () => globe.zoomOriginal());

const timeNow = document.getElementById('time-now');
const timeRange = document.getElementById('time-range');
const timeLabel = document.getElementById('time-label');
const openingBounds = planBounds();
timeRange.min = String(openingBounds.min);
timeRange.max = String(openingBounds.max);

timeNow.addEventListener('click', () => jumpTo(new Date()));
timeRange.addEventListener('input', () => applyMinutes(Number(timeRange.value), false));
timeRange.addEventListener('change', () => applyMinutes(Number(timeRange.value), true));
document.getElementById('time-plus').addEventListener('click', () => {
  jumpTo(new Date(Date.now() + 6 * 60 * 60 * 1000));
});
document.getElementById('time-tonight').addEventListener('click', () => {
  const tonight = skyMoment(0, 21);
  jumpTo(tonight.getTime() - Date.now() > 30 * 60 * 1000 ? tonight : skyMoment(1, 21));
});
document.getElementById('time-tomorrow').addEventListener('click', () => jumpTo(skyMoment(1, 8)));

document.getElementById('locate').addEventListener('click', locateMe);
document.getElementById('phase-locate').addEventListener('click', locateMe);

const searchForm = document.getElementById('search');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
let searchTimer = 0;
let searchAbort = null;
let chosenPlace = null;

function hideResults() {
  searchResults.hidden = true;
  searchResults.innerHTML = '';
}

function rememberPlace(latitude, longitude, label) {
  chosenPlace = { latitude, longitude, label };
}

function goToChosenPlace() {
  if (!chosenPlace) return false;
  if (searchInput.value.trim() !== chosenPlace.label) return false;
  hideResults();
  usePlace(chosenPlace.latitude, chosenPlace.longitude, chosenPlace.label);
  return true;
}

searchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  window.clearTimeout(searchTimer);
  if (goToChosenPlace()) return;
  const first = searchResults.querySelector('button');
  if (first && !searchResults.hidden) {
    first.click();
    return;
  }
  const query = searchInput.value.trim();
  if (query.length >= 2) searchPlaces(query, true);
});

function reopenSearch() {
  window.clearTimeout(searchTimer);
  const query = searchInput.value.trim();
  goToChosenPlace();
  if (query.length >= 2) searchPlaces(query);
}

searchInput.addEventListener('focus', reopenSearch);
searchInput.addEventListener('click', reopenSearch);

searchInput.addEventListener('input', () => {
  window.clearTimeout(searchTimer);
  hideResults();
  const query = searchInput.value.trim();
  if (query.length < 2) return;
  searchTimer = window.setTimeout(() => searchPlaces(query), 250);
});

async function searchPlaces(query, pickFirst = false) {
  searchAbort?.abort();
  const controller = new AbortController();
  searchAbort = controller;
  try {
    const response = await fetch(
      `https://photon.komoot.io/api/?limit=6&q=${encodeURIComponent(query)}`,
      { signal: controller.signal },
    );
    if (searchAbort !== controller) return;
    if (!response.ok) throw new Error('search failed');
    const data = await response.json();
    if (searchAbort !== controller) return;
    const features = data.features ?? [];
    searchResults.innerHTML = '';
    const seen = new Set();
    if (!features.length) {
      searchResults.hidden = true;
      return;
    }
    for (const feature of features) {
      const [longitude, latitude] = feature.geometry.coordinates;
      const props = feature.properties ?? {};
      const name = props.name || props.city || props.state || 'Place';
      const detail = [props.city, props.state, props.country]
        .filter((part, index, all) => part && part !== name && all.indexOf(part) === index)
        .slice(0, 2)
        .join(', ');
      const key = `${name}|${detail}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.innerHTML = `${name}${detail ? `<small>${detail}</small>` : ''}`;
      button.addEventListener('click', () => {
        dismissLocate();
        const label = detail ? `${name}, ${detail}` : name;
        searchInput.value = label;
        rememberPlace(latitude, longitude, label);
        hideResults();
        usePlace(latitude, longitude, label);
      });
      item.append(button);
      searchResults.append(item);
    }
    searchResults.hidden = false;
    if (pickFirst) searchResults.querySelector('button')?.click();
  } catch (error) {
    if (error.name !== 'AbortError') hideResults();
  }
}

document.addEventListener('click', (event) => {
  if (!searchForm.contains(event.target)) hideResults();
});

panelToggle.addEventListener('click', () => {
  const open = panel.classList.toggle('open');
  panelToggle.setAttribute('aria-expanded', String(open));
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') tick();
});

select('Sun', false);
tick();
window.setInterval(() => {
  if (viewed) {
    renderClocks(viewed);
    return;
  }
  tick();
}, 1000);
