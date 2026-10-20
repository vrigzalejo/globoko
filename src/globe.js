import {
  ArcType,
  CallbackProperty,
  Cartesian2,
  Cartesian3,
  Cartographic,
  ClassificationType,
  Color,
  ColorMaterialProperty,
  Credit,
  DistanceDisplayCondition,
  Ellipsoid,
  HeightReference,
  HorizontalOrigin,
  ImageMaterialProperty,
  ImageryLayer,
  Ion,
  JulianDate,
  LabelStyle,
  Math as CesiumMath,
  NearFarScalar,
  PolylineGlowMaterialProperty,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Terrain,
  UrlTemplateImageryProvider,
  VerticalOrigin,
  Viewer,
  WebMercatorTilingScheme,
  defined,
} from 'cesium';
import { BODIES } from './sky.js';

const BEACON_M = 2_000_000;
const SKY_RADIUS_M = 8_000_000_000;
const HOME_RANGE_M = 22_000_000;
const ARROW_HOURS = [2, 4, 8, 12, 16, 20];

function makeOrb(cssColor) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(0.16, '#ffffff');
  gradient.addColorStop(0.34, cssColor);
  gradient.addColorStop(0.62, cssColor);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

function makeArrow() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.translate(32, 32);
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(-18, 16);
  ctx.lineTo(0, -18);
  ctx.lineTo(18, 16);
  ctx.stroke();
  return canvas;
}

const arrowImage = makeArrow();

const LABEL_OFFSET = {
  Sun: [0, -26],
  Moon: [22, -6],
  Mercury: [-24, 20],
  Venus: [26, 16],
  Mars: [-18, -22],
  Jupiter: [18, -24],
  Saturn: [-22, 12],
  Uranus: [24, 8],
  Neptune: [0, 24],
};

function labelOptions(text, offsetX = 0, offsetY = -16) {
  return {
    text,
    font: '600 13px Outfit, "Segoe UI", sans-serif',
    fillColor: Color.WHITE,
    outlineColor: Color.fromCssColorString('#061018'),
    outlineWidth: 4,
    style: LabelStyle.FILL_AND_OUTLINE,
    verticalOrigin: VerticalOrigin.CENTER,
    horizontalOrigin: HorizontalOrigin.CENTER,
    pixelOffset: new Cartesian2(offsetX, offsetY),
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
  };
}

export function createGlobe(container, creditContainer) {
  const imageryProvider = new UrlTemplateImageryProvider({
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    tilingScheme: new WebMercatorTilingScheme(),
    maximumLevel: 19,
    credit: new Credit(
      'Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community',
      true,
    ),
  });
  const imagery = new ImageryLayer(imageryProvider);
  imagery.brightness = 1.08;
  imagery.contrast = 1.06;
  imagery.saturation = 1.18;

  const viewer = new Viewer(container, {
    animation: false,
    timeline: false,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    fullscreenButton: false,
    infoBox: false,
    selectionIndicator: false,
    baseLayer: imagery,
    shouldAnimate: false,
    creditContainer,
    useBrowserRecommendedResolution: false,
    msaaSamples: 4,
  });

  const { scene } = viewer;
  scene.globe.enableLighting = true;
  scene.globe.dynamicAtmosphereLighting = true;
  scene.globe.dynamicAtmosphereLightingFromSun = true;
  scene.globe.showGroundAtmosphere = true;
  scene.globe.baseColor = Color.fromCssColorString('#071525');
  scene.globe.depthTestAgainstTerrain = true;
  scene.globe.maximumScreenSpaceError = 1.6;
  scene.sun.show = true;
  scene.moon.show = false;
  scene.backgroundColor = Color.fromCssColorString('#02040a');
  scene.fog.enabled = true;
  scene.pickTranslucentDepth = true;
  scene.screenSpaceCameraController.minimumZoomDistance = 40;
  scene.screenSpaceCameraController.maximumZoomDistance = 40_000_000_000;
  scene.highDynamicRange = false;

  const token = import.meta.env.VITE_CESIUM_ION_TOKEN;
  if (token) {
    Ion.defaultAccessToken = token;
    scene.setTerrain(Terrain.fromWorldTerrain({ requestVertexNormals: true }));
  }

  const ellipsoid = Ellipsoid.WGS84;
  const selected = { id: 'Sun' };
  const records = new Map();
  let homeLongitude = -30;
  let pathsVisible = false;

  for (const meta of BODIES) {
    const color = Color.fromCssColorString(meta.color);
    const ground = new Cartesian3();
    const top = new Cartesian3();
    const sky = new Cartesian3();
    const stem = [new Cartesian3(), new Cartesian3()];
    const direction = new Cartesian3();
    const surface = new Cartesian3();

    const [offsetX, offsetY] = LABEL_OFFSET[meta.id];
    const facing = new CallbackProperty(() => {
      const camera = viewer.camera.positionWC;
      const dx = camera.x - ground.x;
      const dy = camera.y - ground.y;
      const dz = camera.z - ground.z;
      return dx * direction.x + dy * direction.y + dz * direction.z > 0;
    }, false);

    const pin = viewer.entities.add({
      id: `pin-${meta.id}`,
      bodyId: meta.id,
      show: facing,
      position: new CallbackProperty(() => top, false),
      point: {
        pixelSize: new CallbackProperty(() => (selected.id === meta.id ? 16 : 10), false),
        color,
        outlineColor: Color.WHITE,
        outlineWidth: 2,
      },
      label: labelOptions(meta.label, offsetX, offsetY),
      polyline: {
        positions: new CallbackProperty(() => stem, false),
        width: new CallbackProperty(() => (selected.id === meta.id ? 14 : 9), false),
        material: new PolylineGlowMaterialProperty({
          glowPower: 0.16,
          color,
        }),
        arcType: ArcType.NONE,
      },
    });

    viewer.entities.add({
      id: `ground-${meta.id}`,
      bodyId: meta.id,
      show: facing,
      position: new CallbackProperty(() => ground, false),
      point: {
        pixelSize: 8,
        color,
        outlineColor: Color.WHITE,
        outlineWidth: 2,
        heightReference: HeightReference.CLAMP_TO_GROUND,
      },
      ellipse: {
        semiMajorAxis: new CallbackProperty(() => (selected.id === meta.id ? 220000 : 140000), false),
        semiMinorAxis: new CallbackProperty(() => (selected.id === meta.id ? 220000 : 140000), false),
        material: color.withAlpha(0.32),
        classificationType: ClassificationType.TERRAIN,
      },
    });

    let skyEntity = null;
    if (meta.id !== 'Moon') {
      skyEntity = viewer.entities.add({
        id: `sky-${meta.id}`,
        bodyId: meta.id,
        position: new CallbackProperty(() => sky, false),
        billboard: {
          image: makeOrb(meta.color),
          scale: meta.id === 'Sun' ? 0.72 : 0.42,
          verticalOrigin: VerticalOrigin.CENTER,
          horizontalOrigin: HorizontalOrigin.CENTER,
          scaleByDistance: new NearFarScalar(1.5e6, 1.1, 3e10, 0.4),
        },
      });
    }

    let moonEntity = null;
    if (meta.id === 'Moon') {
      moonEntity = viewer.entities.add({
        id: 'moon-sphere',
        bodyId: 'Moon',
        position: new CallbackProperty(() => sky, false),
        ellipsoid: {
          radii: new Cartesian3(1737400, 1737400, 1737400),
          material: new ImageMaterialProperty({ image: '/textures/moon.jpg' }),
          slicePartitions: 64,
          stackPartitions: 48,
        },
        billboard: {
          image: makeOrb(meta.color),
          scale: 0.5,
          verticalOrigin: VerticalOrigin.CENTER,
          horizontalOrigin: HorizontalOrigin.CENTER,
          distanceDisplayCondition: new DistanceDisplayCondition(8_000_000, 8e10),
        },
      });
    }

    const track = viewer.entities.add({
      id: `track-${meta.id}`,
      bodyId: meta.id,
      show: false,
      polyline: {
        positions: [],
        width: new CallbackProperty(() => (selected.id === meta.id ? 3 : 1.5), false),
        material: new ColorMaterialProperty(
          new CallbackProperty(
            () => color.withAlpha(selected.id === meta.id ? 0.95 : 0.45),
            false,
          ),
        ),
        arcType: ArcType.GEODESIC,
      },
    });

    const arrows = ARROW_HOURS.map((hour) => {
      const arrow = {
        hour,
        from: new Cartesian3(),
        to: new Cartesian3(),
        rotation: 0,
        ready: false,
        entity: null,
      };
      arrow.entity = viewer.entities.add({
        id: `ahead-${meta.id}-${hour}`,
        bodyId: meta.id,
        show: false,
        position: new CallbackProperty(() => arrow.from, false),
        billboard: {
          image: arrowImage,
          color,
          show: new CallbackProperty(() => selected.id === meta.id && arrowFacesCamera(arrow), false),
          scale: 0.36,
          rotation: new CallbackProperty(() => arrowRotation(arrow), false),
          verticalOrigin: VerticalOrigin.CENTER,
          horizontalOrigin: HorizontalOrigin.CENTER,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: `+${hour}h`,
          font: '600 12px Outfit, "Segoe UI", sans-serif',
          fillColor: Color.WHITE,
          outlineColor: Color.fromCssColorString('#061018'),
          outlineWidth: 3,
          style: LabelStyle.FILL_AND_OUTLINE,
          horizontalOrigin: HorizontalOrigin.LEFT,
          pixelOffset: new Cartesian2(12, 0),
          show: new CallbackProperty(() => selected.id === meta.id && arrowFacesCamera(arrow), false),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      return arrow;
    });

    records.set(meta.id, {
      ground,
      top,
      sky,
      stem,
      direction,
      surface,
      pin,
      skyEntity,
      moonEntity,
      track,
      arrows,
    });
  }

  const you = viewer.entities.add({
    id: 'observer',
    show: false,
    position: Cartesian3.fromDegrees(0, 0),
    point: {
      pixelSize: 11,
      color: Color.WHITE,
      outlineColor: Color.fromCssColorString('#3aa0ff'),
      outlineWidth: 3,
      heightReference: HeightReference.CLAMP_TO_GROUND,
    },
    label: {
      ...labelOptions('You'),
      fillColor: Color.fromCssColorString('#d7ecff'),
    },
  });

  let onSelect = () => {};
  const handler = new ScreenSpaceEventHandler(scene.canvas);
  handler.setInputAction((click) => {
    const picked = scene.pick(click.position);
    const id = picked && defined(picked.id) ? picked.id.bodyId : null;
    if (id) onSelect(id);
  }, ScreenSpaceEventType.LEFT_CLICK);
  handler.setInputAction((movement) => {
    const picked = scene.pick(movement.endPosition);
    const id = picked && defined(picked.id) ? picked.id.bodyId : null;
    scene.canvas.style.cursor = id ? 'pointer' : '';
  }, ScreenSpaceEventType.MOUSE_MOVE);
  const stopCenter = () => {
    centerFlight += 1;
    scene.screenSpaceCameraController.enableInputs = true;
  };
  handler.setInputAction(stopCenter, ScreenSpaceEventType.LEFT_DOWN);
  handler.setInputAction(stopCenter, ScreenSpaceEventType.WHEEL);
  handler.setInputAction(stopCenter, ScreenSpaceEventType.RIGHT_DOWN);
  handler.setInputAction(stopCenter, ScreenSpaceEventType.PINCH_START);

  let framed = false;
  let skyJulian = null;
  scene.preRender.addEventListener(() => {
    viewer.clock.currentTime = skyJulian
      ? JulianDate.clone(skyJulian, viewer.clock.currentTime)
      : JulianDate.now();
  });

  function setSkyTime(date) {
    skyJulian = date ? JulianDate.fromDate(date) : null;
  }

  function placeBody(record, body) {
    const ecef = record.sky;
    ecef.x = body.x;
    ecef.y = body.y;
    ecef.z = body.z;
    Cartesian3.normalize(ecef, record.direction);
    const hit = ellipsoid.scaleToGeodeticSurface(ecef, record.surface);
    if (!hit) return null;
    Cartesian3.clone(hit, record.ground);
    Cartesian3.multiplyByScalar(record.direction, BEACON_M, record.top);
    Cartesian3.add(record.ground, record.top, record.top);
    Cartesian3.clone(record.ground, record.stem[0]);
    Cartesian3.clone(record.top, record.stem[1]);
    if (body.id !== 'Moon') {
      Cartesian3.multiplyByScalar(record.direction, SKY_RADIUS_M, record.sky);
    }
    const cartographic = Cartographic.fromCartesian(record.ground);
    return {
      latitude: CesiumMath.toDegrees(cartographic.latitude),
      longitude: CesiumMath.toDegrees(cartographic.longitude),
    };
  }

  const trackScratch = new Cartesian3();
  const trackSurface = new Cartesian3();
  const trackRaised = new Cartesian3();

  function pointOnEarth(sample, result) {
    trackScratch.x = sample.x;
    trackScratch.y = sample.y;
    trackScratch.z = sample.z;
    const hit = ellipsoid.scaleToGeodeticSurface(trackScratch, trackSurface);
    if (!hit) return null;
    Cartesian3.normalize(hit, trackRaised);
    Cartesian3.multiplyByScalar(trackRaised, 55_000, trackRaised);
    return Cartesian3.add(hit, trackRaised, result);
  }

  function arrowFacesCamera(arrow) {
    const camera = viewer.camera.positionWC;
    const dx = camera.x - arrow.from.x;
    const dy = camera.y - arrow.from.y;
    const dz = camera.z - arrow.from.z;
    return dx * arrow.from.x + dy * arrow.from.y + dz * arrow.from.z > 0;
  }

  function arrowRotation(arrow) {
    const start = scene.cartesianToCanvasCoordinates(arrow.from);
    const end = scene.cartesianToCanvasCoordinates(arrow.to);
    if (!defined(start) || !defined(end)) return arrow.rotation;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    if (dx * dx + dy * dy < 4) return arrow.rotation;
    arrow.rotation = Math.atan2(-dx, -dy);
    return arrow.rotation;
  }

  function applyPathVisibility(record) {
    record.track.show = pathsVisible;
    for (const arrow of record.arrows) {
      arrow.entity.show = pathsVisible && arrow.ready;
    }
  }

  function setPathsVisible(visible) {
    pathsVisible = visible;
    for (const record of records.values()) applyPathVisibility(record);
  }

  function setTracks(tracks) {
    for (const track of tracks) {
      const record = records.get(track.id);
      const samples = [];
      for (const sample of track.samples) {
        const point = new Cartesian3();
        if (!pointOnEarth(sample, point)) continue;
        samples.push({ point, hours: sample.hours });
      }
      record.track.polyline.positions = samples.map((sample) => sample.point);
      for (const arrow of record.arrows) {
        let matchIndex = 0;
        for (let index = 1; index < samples.length; index += 1) {
          const current = Math.abs(samples[index].hours - arrow.hour);
          const best = Math.abs(samples[matchIndex].hours - arrow.hour);
          if (current < best) matchIndex = index;
        }
        const match = samples[matchIndex];
        const next = samples[Math.min(samples.length - 1, matchIndex + 3)];
        arrow.ready = Boolean(match && next && match !== next);
        if (arrow.ready) {
          Cartesian3.clone(match.point, arrow.from);
          Cartesian3.clone(next.point, arrow.to);
        }
      }
      applyPathVisibility(record);
    }
  }

  function update(bodies) {
    const located = [];
    for (const body of bodies) {
      const record = records.get(body.id);
      const spot = placeBody(record, body);
      if (!spot) continue;
      located.push({ ...body, latitude: spot.latitude, longitude: spot.longitude });
      if (body.id === 'Sun') homeLongitude = spot.longitude;
    }
    if (!framed) {
      framed = true;
      lookHome(true);
    }
    return located;
  }

  let centerFlight = 0;

  function cancelCenter() {
    centerFlight += 1;
  }

  function lookHome(instant) {
    cancelCenter();
    const longitude = ((homeLongitude + 68 + 540) % 360) - 180;
    const destination = Cartesian3.fromDegrees(longitude, 14, HOME_RANGE_M);
    const orientation = {
      heading: 0,
      pitch: CesiumMath.toRadians(-90),
      roll: 0,
    };
    if (instant) {
      viewer.camera.setView({ destination, orientation });
      return;
    }
    viewer.camera.flyTo({ destination, orientation, duration: 1.6 });
  }

  function centerOn(latitude, longitude) {
    const camera = viewer.camera;
    camera.cancelFlight();
    scene.screenSpaceCameraController.enableInputs = true;
    const start = camera.positionCartographic;
    const startLon = CesiumMath.toDegrees(start.longitude);
    const startLat = CesiumMath.toDegrees(start.latitude);
    const height = Math.max(start.height, 40);
    let deltaLon = longitude - startLon;
    if (deltaLon > 180) deltaLon -= 360;
    if (deltaLon < -180) deltaLon += 360;
    const deltaLat = latitude - startLat;
    const heading = Number.isFinite(camera.heading) ? camera.heading : 0;
    const flight = ++centerFlight;
    const started = performance.now();
    const duration = 1100;
    const pitch = CesiumMath.toRadians(-89.9);
    scene.screenSpaceCameraController.enableInputs = false;

    const placeCamera = (t) => {
      const eased = t * t * (3 - 2 * t);
      camera.setView({
        destination: Cartesian3.fromDegrees(
          startLon + deltaLon * eased,
          startLat + deltaLat * eased,
          height,
        ),
        orientation: { heading, pitch, roll: 0 },
      });
    };

    const frame = (now) => {
      if (flight !== centerFlight) return;
      const t = Math.min(1, (now - started) / duration);
      placeCamera(t);
      if (t < 1) requestAnimationFrame(frame);
      else scene.screenSpaceCameraController.enableInputs = true;
    };
    requestAnimationFrame(frame);
  }

  const MIN_HEIGHT_M = 40;
  const MAX_HEIGHT_M = 4_000_000_000;
  const ZOOM_STEP = 1.8;

  function flyHeight(nextHeight) {
    cancelCenter();
    const camera = viewer.camera;
    camera.cancelFlight();
    const start = camera.positionCartographic;
    const startHeight = Math.max(start.height, MIN_HEIGHT_M);
    const endHeight = Math.min(MAX_HEIGHT_M, Math.max(MIN_HEIGHT_M, nextHeight));
    const longitude = CesiumMath.toDegrees(start.longitude);
    const latitude = CesiumMath.toDegrees(start.latitude);
    const heading = Number.isFinite(camera.heading) ? camera.heading : 0;
    let pitch = camera.pitch;
    if (!Number.isFinite(pitch) || pitch < CesiumMath.toRadians(-89.5)) {
      pitch = CesiumMath.toRadians(-89.9);
    }
    const flight = ++centerFlight;
    const started = performance.now();
    const duration = 450;
    scene.screenSpaceCameraController.enableInputs = false;

    const frame = (now) => {
      if (flight !== centerFlight) return;
      const t = Math.min(1, (now - started) / duration);
      const eased = t * t * (3 - 2 * t);
      camera.setView({
        destination: Cartesian3.fromDegrees(
          longitude,
          latitude,
          startHeight + (endHeight - startHeight) * eased,
        ),
        orientation: { heading, pitch, roll: 0 },
      });
      if (t < 1) requestAnimationFrame(frame);
      else scene.screenSpaceCameraController.enableInputs = true;
    };
    requestAnimationFrame(frame);
  }

  function setObserver(latitude, longitude, name) {
    you.show = true;
    you.position = Cartesian3.fromDegrees(longitude, latitude, 0);
    you.label.text = name;
  }

  function clearObserver() {
    you.show = false;
  }

  function select(id) {
    selected.id = id;
  }

  return {
    viewer,
    update,
    setSkyTime,
    setTracks,
    setPathsVisible,
    centerOn,
    zoomIn: () => flyHeight(viewer.camera.positionCartographic.height / ZOOM_STEP),
    zoomOut: () => flyHeight(viewer.camera.positionCartographic.height * ZOOM_STEP),
    zoomOriginal: () => flyHeight(HOME_RANGE_M),
    setObserver,
    clearObserver,
    select,
    whenSelect(callback) {
      onSelect = callback;
    },
  };
}
