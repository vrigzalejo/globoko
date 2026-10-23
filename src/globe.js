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
  PolylineDashMaterialProperty,
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
import { AU_DISPLAY_M, BODIES, eclipticNorth } from './sky.js';

const BEACON_M = 2_000_000;
const HOME_RANGE_M = 22_000_000;
const ORBIT_HEIGHT_M = 80_000_000;
const SYSTEM_LIMIT_M = 2_500_000_000_000;
const EARTH_RADIUS_M = 6_378_137;
const FRAME_AU = [2.2, 11, 40];
const ARROW_HOURS = [2, 4, 8, 12, 16, 20];

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function clipDisc(ctx, size) {
  const radius = size / 2 - 1;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, radius, 0, Math.PI * 2);
  ctx.clip();
  return radius;
}

function sphereLight(ctx, size) {
  const center = size / 2;
  const light = ctx.createRadialGradient(center * 0.7, center * 0.66, size * 0.04, center, center, center);
  light.addColorStop(0, 'rgba(255,255,255,0.42)');
  light.addColorStop(0.42, 'rgba(255,255,255,0)');
  light.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, size, size);
}

function makeSun() {
  const size = 128;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const center = size / 2;
  ctx.save();
  const radius = clipDisc(ctx, size);
  const glow = ctx.createRadialGradient(center * 0.92, center * 0.9, radius * 0.05, center, center, radius);
  glow.addColorStop(0, '#fffdf8');
  glow.addColorStop(0.42, '#ffe7a8');
  glow.addColorStop(0.72, '#ffb030');
  glow.addColorStop(1, '#e15a10');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();
  return canvas;
}

function makePlanet(paint) {
  const size = 96;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.save();
  clipDisc(ctx, size);
  paint(ctx, size);
  sphereLight(ctx, size);
  ctx.restore();
  return canvas;
}

function makeMercury() {
  return makePlanet((ctx, size) => {
    const wash = ctx.createRadialGradient(34, 32, 4, 48, 48, 52);
    wash.addColorStop(0, '#d2cbc4');
    wash.addColorStop(1, '#7a736c');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, size, size);
  });
}

function makeVenus() {
  return makePlanet((ctx, size) => {
    const wash = ctx.createRadialGradient(34, 30, 4, 48, 48, 52);
    wash.addColorStop(0, '#fff6df');
    wash.addColorStop(0.55, '#f0d7a4');
    wash.addColorStop(1, '#c9a15a');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, size, size);
  });
}

function makeEarth() {
  return makePlanet((ctx, size) => {
    const center = size / 2;
    const ocean = ctx.createRadialGradient(center * 0.72, center * 0.68, 4, center, center, center);
    ocean.addColorStop(0, '#b7e0f4');
    ocean.addColorStop(0.4, '#3c90c2');
    ocean.addColorStop(0.78, '#1a5f96');
    ocean.addColorStop(1, '#0c3a5c');
    ctx.fillStyle = ocean;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#4f8f52';
    ctx.beginPath();
    ctx.ellipse(31, 40, 8, 12, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(27, 60, 5, 8, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d2b07a';
    ctx.beginPath();
    ctx.ellipse(60, 48, 7, 10, 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4f8f52';
    ctx.beginPath();
    ctx.ellipse(64, 34, 6, 4, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(48, 14, 16, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

function makeMars() {
  return makePlanet((ctx, size) => {
    const wash = ctx.createRadialGradient(34, 32, 4, 48, 48, 52);
    wash.addColorStop(0, '#e07a48');
    wash.addColorStop(1, '#8d3418');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.ellipse(48, 18, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

function makeJupiter() {
  return makePlanet((ctx, size) => {
    const bands = ['#f4e7cf', '#d7b07a', '#f7efe2', '#c98458', '#f3e2c4', '#e7c89a', '#b87a48', '#edd9b4'];
    bands.forEach((band, index) => {
      ctx.fillStyle = band;
      ctx.fillRect(0, (size / bands.length) * index, size, size / bands.length + 1);
    });
    ctx.fillStyle = '#d4533c';
    ctx.beginPath();
    ctx.ellipse(62, 58, 10, 6, 0.2, 0, Math.PI * 2);
    ctx.fill();
  });
}

function makeSaturn() {
  const canvas = makeCanvas(192, 104);
  const ctx = canvas.getContext('2d');
  const drawRings = (front) => {
    ctx.save();
    ctx.translate(96, 52);
    ctx.rotate(-0.45);
    ctx.beginPath();
    ctx.ellipse(0, 0, 84, 16, 0, front ? 0.15 : Math.PI + 0.15, front ? Math.PI - 0.15 : Math.PI * 2 - 0.15);
    ctx.strokeStyle = front ? 'rgba(236, 220, 184, 0.95)' : 'rgba(214, 196, 158, 0.8)';
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(120, 96, 64, 0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  };
  drawRings(false);
  ctx.save();
  ctx.beginPath();
  ctx.arc(96, 52, 26, 0, Math.PI * 2);
  ctx.clip();
  const wash = ctx.createLinearGradient(70, 30, 122, 78);
  wash.addColorStop(0, '#f3e2b0');
  wash.addColorStop(0.5, '#e7c98a');
  wash.addColorStop(1, '#c49a58');
  ctx.fillStyle = wash;
  ctx.fillRect(60, 20, 72, 68);
  ctx.fillStyle = 'rgba(180, 140, 70, 0.45)';
  ctx.fillRect(60, 46, 72, 6);
  ctx.fillRect(60, 60, 72, 4);
  const light = ctx.createRadialGradient(86, 42, 2, 96, 52, 28);
  light.addColorStop(0, 'rgba(255,255,255,0.45)');
  light.addColorStop(0.5, 'rgba(255,255,255,0)');
  light.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = light;
  ctx.fillRect(68, 24, 56, 56);
  ctx.restore();
  drawRings(true);
  return canvas;
}

function makeUranus() {
  return makePlanet((ctx, size) => {
    const wash = ctx.createRadialGradient(36, 34, 4, 48, 48, 48);
    wash.addColorStop(0, '#e7fffb');
    wash.addColorStop(1, '#7ecfc4');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, size, size);
  });
}

function makeNeptune() {
  return makePlanet((ctx, size) => {
    const wash = ctx.createRadialGradient(36, 34, 4, 48, 48, 50);
    wash.addColorStop(0, '#8eb6ff');
    wash.addColorStop(1, '#1e4fbe');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(0, 40, size, 7);
  });
}

function makePluto() {
  return makePlanet((ctx, size) => {
    ctx.fillStyle = '#c2a48c';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#f3efe8';
    ctx.beginPath();
    ctx.moveTo(48, 28);
    ctx.bezierCurveTo(36, 40, 34, 58, 48, 70);
    ctx.bezierCurveTo(62, 58, 70, 40, 48, 28);
    ctx.fill();
  });
}

function makeMoon() {
  return makePlanet((ctx, size) => {
    const center = size / 2;
    const wash = ctx.createRadialGradient(center * 0.7, center * 0.66, 2, center, center, center);
    wash.addColorStop(0, '#f6f3ee');
    wash.addColorStop(0.55, '#cfc8be');
    wash.addColorStop(1, '#8d8680');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(108, 102, 94, 0.5)';
    ctx.beginPath();
    ctx.ellipse(34, 58, 11, 7, 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(56, 42, 8, 5, -0.35, 0, Math.PI * 2);
    ctx.fill();
  });
}

const PLANET_IMAGE = {
  Sun: makeSun(),
  Mercury: makeMercury(),
  Venus: makeVenus(),
  Earth: makeEarth(),
  Mars: makeMars(),
  Jupiter: makeJupiter(),
  Saturn: makeSaturn(),
  Uranus: makeUranus(),
  Neptune: makeNeptune(),
  Pluto: makePluto(),
  Moon: makeMoon(),
};

const PLANET_SCALE = {
  Sun: 0.18,
  Mercury: 0.055,
  Venus: 0.075,
  Earth: 0.1,
  Mars: 0.065,
  Jupiter: 0.16,
  Saturn: 0.22,
  Uranus: 0.08,
  Neptune: 0.08,
  Pluto: 0.05,
  Moon: 0.055,
};

const BODY_DISTANCE_SCALE = new NearFarScalar(50_000_000_000, 1, 1_200_000_000_000, 0.62);

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
  Pluto: [-16, 26],
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

const phoneMedia = window.matchMedia('(max-width: 959px)');

function onPhone() {
  return phoneMedia.matches;
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
    contextOptions: onPhone()
      ? { webgl: { powerPreference: 'high-performance' } }
      : undefined,
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
  scene.screenSpaceCameraController.maximumZoomDistance = ORBIT_HEIGHT_M;
  scene.highDynamicRange = false;

  if (onPhone()) scene.cameraEventWaitTime = 120;

  let phoneMoving = false;

  function applyPhoneQuality() {
    const dpr = window.devicePixelRatio || 1;
    const coarse = viewer.camera.positionCartographic.height >= ORBIT_HEIGHT_M;
    const light = onPhone() && (phoneMoving || coarse);
    const scale = light ? Math.min(1, 1 / dpr) : 1;
    if (viewer.resolutionScale !== scale) viewer.resolutionScale = scale;
    scene.globe.loadingDescendantLimit = light ? 1 : 20;
    scene.globe.preloadAncestors = !light;
    scene.globe.preloadSiblings = !light;
    const error = coarse ? 8 : 1.6;
    if (scene.globe.maximumScreenSpaceError !== error) scene.globe.maximumScreenSpaceError = error;
  }

  applyPhoneQuality();
  phoneMedia.addEventListener('change', () => applyPhoneQuality());
  viewer.camera.moveStart.addEventListener(() => {
    phoneMoving = true;
    applyPhoneQuality();
  });
  viewer.camera.moveEnd.addEventListener(() => {
    phoneMoving = false;
    applyPhoneQuality();
  });

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
  let poleLock = false;

  function cameraDistance() {
    return Cartesian3.magnitude(viewer.camera.positionWC);
  }

  function smoothstep(edge0, edge1, value) {
    const span = edge1 - edge0;
    if (span <= 0) return value >= edge1 ? 1 : 0;
    const t = CesiumMath.clamp((value - edge0) / span, 0, 1);
    return t * t * (3 - 2 * t);
  }

  function systemGraphics() {
    return cameraDistance() >= frameDistance(0) * 0.42;
  }

  function pairDistance() {
    const moon = records.get('Moon');
    const range = moon ? Cartesian3.magnitude(moon.sky) : 0;
    const span = Math.max(range, 250_000_000) * 1.9;
    return span / Math.tan(viewLimit());
  }

  function inPair() {
    if (systemGraphics()) return false;
    return cameraDistance() >= pairDistance() * 0.62;
  }

  function earthScreenPixels() {
    const distance = Math.max(cameraDistance(), 1);
    const frustum = viewer.camera.frustum;
    const fovy = frustum.fovy || CesiumMath.toRadians(60);
    const canvasHeight = scene.canvas.clientHeight || 1;
    const angular = 2 * Math.atan(EARTH_RADIUS_M / distance);
    return (angular / fovy) * canvasHeight;
  }

  function systemView() {
    if ((scene.canvas.clientHeight || 0) < 2) return false;
    return earthScreenPixels() < 220;
  }

  function pairPresence() {
    const distance = cameraDistance();
    const pair = pairDistance();
    const arrive = smoothstep(pair * 0.5, pair * 0.9, distance);
    const leave = 1 - smoothstep(pair * 1.15, frameDistance(0) * 0.7, distance);
    return arrive * leave;
  }

  function systemFade() {
    const pair = pairDistance();
    return smoothstep(pair * 1.2, frameDistance(0) * 0.9, cameraDistance());
  }

  function showEarthMoonLabel() {
    return earthTint.alpha > 0.55 || systemFade() > 0.45;
  }

  function showPlanetLabel() {
    return systemFade() > 0.45;
  }

  const earthTint = new Color(1, 1, 1, 0);

  function syncEarthDisc() {
    const pixels = earthScreenPixels();
    const distance = cameraDistance();
    const pair = pairDistance();
    const system = frameDistance(0);
    let held = 36;
    if (distance >= system) held = 9 * Math.max(0.55, system / distance);
    else if (distance > pair) held = 36 + (9 - 36) * smoothstep(pair, system, distance);
    earthTint.alpha = CesiumMath.clamp((held + 8 - pixels) / 12, 0, 1);
  }

  const nameOffset = new Map();
  const nameWidth = {
    Sun: 28,
    Moon: 40,
    Mercury: 58,
    Venus: 42,
    Earth: 40,
    Mars: 36,
    Jupiter: 54,
    Saturn: 50,
    Uranus: 50,
    Neptune: 58,
    Pluto: 38,
  };

  function nameSlot(id) {
    let slot = nameOffset.get(id);
    if (!slot) {
      slot = new Cartesian2(0, -16);
      nameOffset.set(id, slot);
    }
    return slot;
  }

  function systemLabel(id, text, visible = systemGraphics) {
    const slot = nameSlot(id);
    return {
      ...labelOptions(text, 0, -16),
      font: '600 12px Outfit, "Segoe UI", sans-serif',
      show: new CallbackProperty(() => visible(), false),
      scaleByDistance: new NearFarScalar(ORBIT_HEIGHT_M, 1, SYSTEM_LIMIT_M, 0.7),
      pixelOffset: new CallbackProperty(() => slot, false),
    };
  }

  const nearLabel = (text, offsetX, offsetY) => ({
    ...labelOptions(text, offsetX, offsetY),
    show: new CallbackProperty(() => !systemView(), false),
  });

  for (const meta of BODIES) {
    const color = Color.fromCssColorString(meta.color);
    const ground = new Cartesian3();
    const top = new Cartesian3();
    const sky = new Cartesian3();
    const stem = [new Cartesian3(), new Cartesian3()];
    const direction = new Cartesian3();
    const surface = new Cartesian3();

    const [offsetX, offsetY] = LABEL_OFFSET[meta.id];
    const earthMarker = () => new CallbackProperty(() => {
      if (systemView()) return false;
      const camera = viewer.camera.positionWC;
      const dx = camera.x - ground.x;
      const dy = camera.y - ground.y;
      const dz = camera.z - ground.z;
      return dx * direction.x + dy * direction.y + dz * direction.z > 0;
    }, false);

    const pin = viewer.entities.add({
      id: `pin-${meta.id}`,
      bodyId: meta.id,
      position: new CallbackProperty(() => top, false),
      point: {
        show: earthMarker(),
        pixelSize: new CallbackProperty(() => (selected.id === meta.id ? 16 : 10), false),
        color,
        outlineColor: Color.WHITE,
        outlineWidth: 2,
      },
      label: nearLabel(meta.label, offsetX, offsetY),
      polyline: {
        show: earthMarker(),
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
      position: new CallbackProperty(() => ground, false),
      point: {
        show: earthMarker(),
        pixelSize: 8,
        color,
        outlineColor: Color.WHITE,
        outlineWidth: 2,
        heightReference: HeightReference.CLAMP_TO_GROUND,
      },
      ellipse: {
        show: earthMarker(),
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
          image: PLANET_IMAGE[meta.id],
          scale: new CallbackProperty(() => PLANET_SCALE[meta.id] * Math.max(systemFade(), 0.001), false),
          scaleByDistance: BODY_DISTANCE_SCALE,
          verticalOrigin: VerticalOrigin.CENTER,
          horizontalOrigin: HorizontalOrigin.CENTER,
          show: new CallbackProperty(() => systemFade() > 0.04, false),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: systemLabel(meta.id, meta.label, showPlanetLabel),
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
        label: systemLabel('Moon', 'Moon', showEarthMoonLabel),
      });
    }

    const track = viewer.entities.add({
      id: `track-${meta.id}`,
      bodyId: meta.id,
      show: false,
      polyline: {
        positions: [],
        width: new CallbackProperty(() => (selected.id === meta.id ? 3 : 1.5), false),
        material: new PolylineDashMaterialProperty({
          color: new CallbackProperty(
            () => color.withAlpha(selected.id === meta.id ? 0.95 : 0.55),
            false,
          ),
          dashLength: 24,
        }),
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
          show: new CallbackProperty(
            () => pathsOnGlobe() && selected.id === meta.id && arrowFacesCamera(arrow),
            false,
          ),
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
          show: new CallbackProperty(
            () => pathsOnGlobe() && selected.id === meta.id && arrowFacesCamera(arrow),
            false,
          ),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      return arrow;
    });

    const skyPositions = [];
    const skyHidden = [new Cartesian3(), new Cartesian3(1, 0, 0)];
    const skyArrows = meta.id === 'Moon' ? [] : ARROW_HOURS.map((hour) => ({
      hour,
      from: new Cartesian3(),
      to: new Cartesian3(),
      rotation: 0,
      ready: false,
      offset: new Cartesian2(22, 0),
    }));
    const skyPathOn = () => (
      pathsVisible
      && systemFade() > 0.2
      && skyPositions.length > 2
      && pathScreenRadius(skyPositions) > 36
    );
    const skyHoursOn = () => skyPathOn() && selected.id === meta.id && pathScreenRadius(skyPositions) > 72;
    if (meta.id !== 'Moon') {
      viewer.entities.add({
        id: `sky-path-${meta.id}`,
        polyline: {
          positions: new CallbackProperty(
            () => (skyPositions.length > 2 ? skyPositions : skyHidden),
            false,
          ),
          width: new CallbackProperty(() => (selected.id === meta.id ? 2 : 1.5), false),
          material: new PolylineDashMaterialProperty({
            color: new CallbackProperty(
              () => color.withAlpha((selected.id === meta.id ? 0.9 : 0.55) * systemFade()),
              false,
            ),
            dashLength: 28,
          }),
          arcType: ArcType.NONE,
          show: new CallbackProperty(skyPathOn, false),
        },
      });
      const skyCaptionAt = new Cartesian3();
      const skyCaptionOffset = new Cartesian2(0, -16);
      viewer.entities.add({
        id: `sky-caption-${meta.id}`,
        position: new CallbackProperty(() => {
          if (skyPositions.length > 1) {
            const index = Math.round((skyPositions.length - 1) * 0.25);
            Cartesian3.clone(skyPositions[index], skyCaptionAt);
          }
          return skyCaptionAt;
        }, false),
        label: {
          text: `${meta.label} · next 24 hours`,
          font: '600 11px Outfit, "Segoe UI", sans-serif',
          fillColor: Color.WHITE,
          outlineColor: Color.fromCssColorString('#061018'),
          outlineWidth: 3,
          style: LabelStyle.FILL_AND_OUTLINE,
          horizontalOrigin: HorizontalOrigin.CENTER,
          verticalOrigin: VerticalOrigin.CENTER,
          pixelOffset: new CallbackProperty(
            () => radialLabelOffset(skyCaptionAt, 16, skyCaptionOffset),
            false,
          ),
          show: new CallbackProperty(
            () => skyPathOn() && pathScreenRadius(skyPositions) > 78,
            false,
          ),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      for (const arrow of skyArrows) {
        viewer.entities.add({
          id: `sky-ahead-${meta.id}-${arrow.hour}`,
          position: new CallbackProperty(() => arrow.from, false),
          billboard: {
            image: arrowImage,
            color,
            scale: 0.36,
            rotation: new CallbackProperty(() => arrowRotation(arrow), false),
            show: new CallbackProperty(
              () => arrow.ready && (skyHoursOn() || (skyPathOn() && selected.id !== meta.id && arrow.hour === 8)),
              false,
            ),
            verticalOrigin: VerticalOrigin.CENTER,
            horizontalOrigin: HorizontalOrigin.CENTER,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: {
            text: `+${arrow.hour}h`,
            font: '600 12px Outfit, "Segoe UI", sans-serif',
            fillColor: Color.WHITE,
            outlineColor: Color.fromCssColorString('#061018'),
            outlineWidth: 3,
            style: LabelStyle.FILL_AND_OUTLINE,
            horizontalOrigin: HorizontalOrigin.CENTER,
            verticalOrigin: VerticalOrigin.CENTER,
            pixelOffset: new CallbackProperty(() => skyLabelOffset(arrow), false),
            show: new CallbackProperty(() => skyHoursOn() && arrow.ready, false),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });
      }
    }

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
      skyPositions,
      skyArrows,
    });
  }

  const earthMark = new Cartesian3(0, 0, 1);
  viewer.entities.add({
    id: 'earth-name',
    position: earthMark,
    label: systemLabel('Earth', 'Earth', showEarthMoonLabel),
  });

  const moonDayPath = [];
  const moonPathHidden = [new Cartesian3(), new Cartesian3(1, 0, 0)];
  const moonPathArrows = ARROW_HOURS.map((hour) => ({
    hour,
    from: new Cartesian3(),
    to: new Cartesian3(),
    rotation: 0,
    ready: false,
  }));
  const moonPathColor = Color.fromCssColorString('#d5dde8');
  const moonPathOn = () => pathsVisible && pairPresence() > 0.2 && moonDayPath.length > 2;
  viewer.entities.add({
    id: 'moon-day-path',
    polyline: {
      positions: new CallbackProperty(
        () => (moonDayPath.length > 2 ? moonDayPath : moonPathHidden),
        false,
      ),
      width: 2,
      material: new PolylineDashMaterialProperty({
        color: new CallbackProperty(() => moonPathColor.withAlpha(0.9 * pairPresence()), false),
        dashLength: 28,
      }),
      arcType: ArcType.NONE,
      show: new CallbackProperty(moonPathOn, false),
    },
  });
  for (const arrow of moonPathArrows) {
    viewer.entities.add({
      id: `moon-day-arrow-${arrow.hour}`,
      position: new CallbackProperty(() => arrow.from, false),
      billboard: {
        image: arrowImage,
        color: moonPathColor,
        scale: 0.36,
        rotation: new CallbackProperty(() => arrowRotation(arrow), false),
        show: new CallbackProperty(() => moonPathOn() && arrow.ready, false),
        verticalOrigin: VerticalOrigin.CENTER,
        horizontalOrigin: HorizontalOrigin.CENTER,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: `+${arrow.hour}h`,
        font: '600 12px Outfit, "Segoe UI", sans-serif',
        fillColor: Color.WHITE,
        outlineColor: Color.fromCssColorString('#061018'),
        outlineWidth: 3,
        style: LabelStyle.FILL_AND_OUTLINE,
        horizontalOrigin: HorizontalOrigin.LEFT,
        pixelOffset: new Cartesian2(12, 0),
        show: new CallbackProperty(() => moonPathOn() && arrow.ready, false),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
  }

  let observerOn = false;
  const youVisible = new CallbackProperty(() => observerOn && !systemView(), false);
  const you = viewer.entities.add({
    id: 'observer',
    position: Cartesian3.fromDegrees(0, 0),
    point: {
      show: youVisible,
      pixelSize: 11,
      color: Color.WHITE,
      outlineColor: Color.fromCssColorString('#3aa0ff'),
      outlineWidth: 3,
      heightReference: HeightReference.CLAMP_TO_GROUND,
    },
    label: {
      ...labelOptions('You'),
      fillColor: Color.fromCssColorString('#d7ecff'),
      show: new CallbackProperty(() => observerOn && !systemView(), false),
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
    if (placing) return;
    centerFlight += 1;
    phoneMoving = false;
    applyPhoneQuality();
    scene.screenSpaceCameraController.enableInputs = true;
  };
  handler.setInputAction(stopCenter, ScreenSpaceEventType.LEFT_DOWN);
  handler.setInputAction(stopCenter, ScreenSpaceEventType.WHEEL);
  handler.setInputAction(stopCenter, ScreenSpaceEventType.RIGHT_DOWN);
  handler.setInputAction(stopCenter, ScreenSpaceEventType.PINCH_START);

  let framed = false;
  let skyJulian = null;
  const orbitEntities = new Map();
  const orbitSpans = new Map();
  let orbitsFar = true;
  let orbitsDrawn = false;
  let coarseOn = false;
  let orbitsShown = false;

  const globeNear = viewer.camera.frustum.near;
  const globeFar = viewer.camera.frustum.far;

  function syncOrbits() {
    const distance = cameraDistance();
    const pixels = earthScreenPixels();
    const chrome = (scene.canvas.clientHeight || 0) >= 2 && pixels >= 36;
    const far = distance > 800_000_000;
    const coarse = distance >= ORBIT_HEIGHT_M;
    const draw = systemFade() > 0.04;
    const error = coarse ? 8 : 1.6;
    if (scene.globe.maximumScreenSpaceError !== error) scene.globe.maximumScreenSpaceError = error;
    if (chrome === orbitsFar && far === orbitsDrawn && coarse === coarseOn && draw === orbitsShown) return;
    const changed = chrome !== orbitsFar || far !== orbitsDrawn || coarse !== coarseOn;
    orbitsFar = chrome;
    orbitsDrawn = far;
    coarseOn = coarse;
    orbitsShown = draw;
    scene.fog.enabled = chrome;
    scene.sun.show = true;
    scene.globe.showGroundAtmosphere = chrome;
    if (scene.skyAtmosphere) scene.skyAtmosphere.show = chrome;
    viewer.camera.frustum.near = far ? 1_000 : globeNear;
    viewer.camera.frustum.far = far ? 20_000_000_000_000 : globeFar;
    for (const entity of orbitEntities.values()) entity.show = draw;
    if (changed) applyPhoneQuality();
  }

  scene.preRender.addEventListener(() => {
    viewer.clock.currentTime = skyJulian
      ? JulianDate.clone(skyJulian, viewer.clock.currentTime)
      : JulianDate.now();
    syncOrbits();
    syncEarthDisc();
    placeNames();
    if (pathsVisible) {
      for (const record of records.values()) applyPathVisibility(record);
    }
  });

  const nameCanvas = [new Cartesian2(), new Cartesian2(), new Cartesian2()];
  const moonProbe = new Cartesian3();

  function readCanvas(position, scratch) {
    const point = scene.cartesianToCanvasCoordinates(position, scratch);
    if (!defined(point)) return null;
    return { x: point.x, y: point.y };
  }

  function placeNames() {
    syncEarthDisc();
    if (earthTint.alpha < 0.2 && systemFade() < 0.2) return;
    const sun = records.get('Sun');
    const moon = records.get('Moon');
    if (!sun || !moon) return;
    const earthPt = readCanvas(earthMark, nameCanvas[0]);
    const sunPt = readCanvas(sun.sky, nameCanvas[1]);
    const moonPt = readCanvas(moon.sky, nameCanvas[2]);
    if (!earthPt || (!sunPt && earthTint.alpha < 0.4 && systemFade() < 0.2)) return;

    let mdx = moonPt ? moonPt.x - earthPt.x : 0;
    let mdy = moonPt ? moonPt.y - earthPt.y : 0;
    let mspan = Math.hypot(mdx, mdy);
    const beside = mspan < 18;
    if (beside) {
      const range = Cartesian3.magnitude(moon.sky) || 1;
      moonProbe.x = earthMark.x + (moon.sky.x / range) * 8e8;
      moonProbe.y = earthMark.y + (moon.sky.y / range) * 8e8;
      moonProbe.z = earthMark.z + (moon.sky.z / range) * 8e8;
      const nudged = readCanvas(moonProbe, nameCanvas[2]);
      if (nudged) {
        mdx = nudged.x - earthPt.x;
        mdy = nudged.y - earthPt.y;
        mspan = Math.hypot(mdx, mdy);
      }
    }
    if (mspan < 1) {
      mdx = 0.9;
      mdy = 0.4;
      mspan = Math.hypot(mdx, mdy);
    }
    mdx /= mspan;
    mdy /= mspan;

    const items = [];
    const push = (id, screen, dirX, dirY, gap) => {
      const span = Math.hypot(dirX, dirY) || 1;
      const offset = nameSlot(id);
      offset.x = (dirX / span) * gap;
      offset.y = (dirY / span) * gap;
      items.push({
        x: screen.x + offset.x,
        y: screen.y + offset.y,
        w: nameWidth[id] || 44,
        offset,
        homeX: offset.x,
        homeY: offset.y,
      });
    };

    if (sunPt) push('Sun', sunPt, 0, -1, 16);
    push('Earth', earthPt, 0, -1, 14 + 14 * pairPresence());
    if (beside) push('Moon', earthPt, mdx, mdy, 28);
    else if (moonPt) {
      const ax = sunPt ? sunPt.x : earthPt.x;
      const ay = sunPt ? sunPt.y : earthPt.y;
      push('Moon', moonPt, moonPt.x - ax, moonPt.y - ay, 16);
    }

    for (const meta of BODIES) {
      if (!sunPt || meta.id === 'Sun' || meta.id === 'Moon') continue;
      const record = records.get(meta.id);
      if (!record) continue;
      const point = readCanvas(record.sky, nameCanvas[2]);
      if (!point) continue;
      const dx = point.x - sunPt.x;
      const dy = point.y - sunPt.y;
      const nearSun = Math.hypot(dx, dy) < 28;
      push(meta.id, point, dx || 1, dy || -1, nearSun ? 24 : 16);
    }

    for (let pass = 0; pass < 4; pass += 1) {
      for (let i = 0; i < items.length; i += 1) {
        for (let j = i + 1; j < items.length; j += 1) {
          const a = items[i];
          const b = items[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const overlapX = (a.w + b.w) / 2 + 4 - Math.abs(dx);
          const overlapY = 14 - Math.abs(dy);
          if (overlapX <= 0 || overlapY <= 0) continue;
          const len = Math.hypot(dx, dy) || 1;
          const pushBy = Math.min(overlapX, overlapY) / 2 + 1;
          const px = (dx / len) * pushBy;
          const py = (dy / len) * pushBy;
          a.x -= px;
          a.y -= py;
          b.x += px;
          b.y += py;
          a.offset.x -= px;
          a.offset.y -= py;
          b.offset.x += px;
          b.offset.y += py;
        }
      }
    }
    for (const item of items) {
      const driftX = item.offset.x - item.homeX;
      const driftY = item.offset.y - item.homeY;
      const drift = Math.hypot(driftX, driftY);
      if (drift <= 12) continue;
      const scale = 12 / drift;
      item.offset.x = item.homeX + driftX * scale;
      item.offset.y = item.homeY + driftY * scale;
    }
  }

  const ORBIT_SHIFT = {
    Mercury: 0,
    Venus: 0.13,
    Earth: 0.24,
    Mars: 0.62,
    Jupiter: 0.08,
    Saturn: 0.2,
    Uranus: 0.3,
    Neptune: 0.42,
    Pluto: 0.5,
  };
  const orbitMarks = new Map();
  const orbitOffsets = new Map();

  function orbitPeriod(days) {
    if (days < 500) return `${Math.round(days)} days`;
    const years = days / 365.256;
    const rounded = years < 10 ? years.toFixed(1) : String(Math.round(years));
    return `${rounded} years`;
  }

  function orbitVisible(id) {
    const span = orbitSpans.get(id) || 0;
    return systemFade() > 0.04 && span > 0 && span <= visibleRadius();
  }

  function orbitScreenRadius(id) {
    const span = orbitSpans.get(id) || 0;
    const world = visibleRadius();
    if (world <= 0) return 0;
    const canvas = Math.min(scene.canvas.clientWidth || 1, scene.canvas.clientHeight || 1);
    return (span / world) * (canvas / 2);
  }

  function radialLabelOffset(point, reachPx, result) {
    const screen = scene.cartesianToCanvasCoordinates(point);
    const earth = scene.cartesianToCanvasCoordinates(Cartesian3.ZERO);
    if (!defined(screen) || !defined(earth)) return result;
    const dx = screen.x - earth.x;
    const dy = screen.y - earth.y;
    const len = Math.hypot(dx, dy) || 1;
    result.x = (dx / len) * reachPx;
    result.y = (dy / len) * reachPx;
    return result;
  }

  function orbitReach(positions) {
    let reach = 0;
    for (const point of positions) {
      const span = Math.hypot(point.x, point.y, point.z);
      if (span > reach) reach = span;
    }
    return reach;
  }

  function visibleRadius() {
    const frustum = viewer.camera.frustum;
    const fovy = frustum.fovy || CesiumMath.toRadians(60);
    const width = scene.canvas.clientWidth || 1;
    const height = scene.canvas.clientHeight || 1;
    const halfY = fovy / 2;
    const halfX = Math.atan(Math.tan(halfY) * (width / height));
    return cameraDistance() * Math.tan(Math.min(halfX, halfY)) * 0.8;
  }

  function setOrbits(orbits) {
    for (const orbit of orbits) {
      const positions = orbit.positions.map((point) => new Cartesian3(point.x, point.y, point.z));
      const span = orbitReach(positions);
      let mark = orbitMarks.get(orbit.id);
      if (!mark) {
        mark = new Cartesian3();
        orbitMarks.set(orbit.id, mark);
      }
      if (positions.length > 1) {
        let farthest = 0;
        let index = 0;
        for (let i = 0; i < positions.length; i += 1) {
          const point = positions[i];
          const reach = point.x * point.x + point.y * point.y + point.z * point.z;
          if (reach > farthest) {
            farthest = reach;
            index = i;
          }
        }
        const shift = Math.round((ORBIT_SHIFT[orbit.id] ?? 0) * (positions.length - 1));
        Cartesian3.clone(positions[(index + shift) % positions.length], mark);
      }
      let offset = orbitOffsets.get(orbit.id);
      if (!offset) {
        offset = new Cartesian2(0, -16);
        orbitOffsets.set(orbit.id, offset);
      }
      let entity = orbitEntities.get(orbit.id);
      if (!entity) {
        const name = BODIES.find((body) => body.id === orbit.id)?.label ?? orbit.id;
        entity = viewer.entities.add({
          id: `orbit-${orbit.id}`,
          show: orbitsShown,
          position: new CallbackProperty(() => orbitMarks.get(orbit.id), false),
          label: {
            text: `${name} · ${orbitPeriod(orbit.days)}`,
            font: '600 11px Outfit, "Segoe UI", sans-serif',
            fillColor: Color.WHITE,
            outlineColor: Color.fromCssColorString('#061018'),
            outlineWidth: 3,
            style: LabelStyle.FILL_AND_OUTLINE,
            horizontalOrigin: HorizontalOrigin.CENTER,
            verticalOrigin: VerticalOrigin.CENTER,
            pixelOffset: new CallbackProperty(
              () => radialLabelOffset(orbitMarks.get(orbit.id), 14, offset),
              false,
            ),
            show: new CallbackProperty(
              () => orbitVisible(orbit.id) && orbitScreenRadius(orbit.id) > 70,
              false,
            ),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          polyline: {
            positions,
            width: 1,
            material: new ColorMaterialProperty(
              new CallbackProperty(() => {
                const tint = Color.fromCssColorString(orbit.color);
                return tint.withAlpha(0.2 * systemFade());
              }, false),
            ),
            arcType: ArcType.NONE,
            show: new CallbackProperty(() => orbitVisible(orbit.id), false),
          },
        });
        orbitEntities.set(orbit.id, entity);
      } else {
        entity.polyline.positions = positions;
      }
      orbitSpans.set(orbit.id, span);
    }
  }

  let skyWhen = new Date();

  function setSkyTime(date) {
    skyWhen = date ? new Date(date.getTime()) : new Date();
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
    if (body.system) {
      record.sky.x = body.system.x;
      record.sky.y = body.system.y;
      record.sky.z = body.system.z;
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

  function pathScreenRadius(positions) {
    const earth = scene.cartesianToCanvasCoordinates(Cartesian3.ZERO);
    if (!defined(earth) || positions.length < 2) return Number.POSITIVE_INFINITY;
    let reach = 0;
    const step = Math.max(1, Math.floor(positions.length / 12));
    for (let i = 0; i < positions.length; i += step) {
      const point = scene.cartesianToCanvasCoordinates(positions[i]);
      if (!defined(point)) continue;
      const span = Math.hypot(point.x - earth.x, point.y - earth.y);
      if (span > reach) reach = span;
    }
    return reach;
  }

  function skyLabelOffset(arrow) {
    const point = scene.cartesianToCanvasCoordinates(arrow.from);
    const earth = scene.cartesianToCanvasCoordinates(Cartesian3.ZERO);
    if (!defined(point) || !defined(earth)) return arrow.offset;
    const dx = point.x - earth.x;
    const dy = point.y - earth.y;
    const len = Math.hypot(dx, dy) || 1;
    arrow.offset.x = (dx / len) * 22;
    arrow.offset.y = (dy / len) * 22;
    return arrow.offset;
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

  function pathsOnGlobe() {
    return pathsVisible && !systemView();
  }

  function applyPathVisibility(record) {
    const show = pathsOnGlobe();
    record.track.show = show;
    for (const arrow of record.arrows) {
      arrow.entity.show = show && arrow.ready;
    }
  }

  function setPathsVisible(visible) {
    pathsVisible = visible;
    for (const record of records.values()) applyPathVisibility(record);
  }

  function placeAhead(samples, positions, arrows, pointAt) {
    positions.length = 0;
    for (const sample of samples) {
      const point = pointAt(sample);
      if (point) positions.push(point);
    }
    if (samples.length < 2 || positions.length < 2) {
      for (const arrow of arrows) arrow.ready = false;
      return;
    }
    const stepHours = samples[1].hours - samples[0].hours || 1;
    for (const arrow of arrows) {
      const index = Math.round(arrow.hour / stepHours);
      const next = Math.min(positions.length - 1, index + 3);
      arrow.ready = index > 0 && next > index && next < positions.length;
      if (arrow.ready) {
        Cartesian3.clone(positions[index], arrow.from);
        Cartesian3.clone(positions[next], arrow.to);
      }
    }
  }

  function setMoonDayPath(samples) {
    placeAhead(samples, moonDayPath, moonPathArrows, (sample) => new Cartesian3(sample.x, sample.y, sample.z));
  }

  function setTracks(tracks) {
    for (const track of tracks) {
      const record = records.get(track.id);
      if (track.id === 'Moon') setMoonDayPath(track.samples);
      else placeAhead(track.samples, record.skyPositions, record.skyArrows, (sample) => {
        if (!sample.display) return null;
        return new Cartesian3(sample.display.x, sample.display.y, sample.display.z);
      });
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
    scene.requestRender();
    return located;
  }

  let centerFlight = 0;
  let placing = false;
  let groundLon = -30;
  let groundLat = 14;
  let leftHeight = HOME_RANGE_M;
  const flightFrom = new Cartesian3();
  const flightTo = new Cartesian3();
  const flightDest = new Cartesian3();
  const flightDir = new Cartesian3();
  const flightUp = new Cartesian3();
  const zoomDirFrom = new Cartesian3();
  const zoomDirTo = new Cartesian3();
  const zoomScratch = new Cartesian3();

  function cancelCenter() {
    centerFlight += 1;
  }

  function lookTowardEarth(destination) {
    Cartesian3.negate(destination, flightDir);
    Cartesian3.normalize(flightDir, flightDir);
    const dot = Cartesian3.dot(Cartesian3.UNIT_Z, flightDir);
    Cartesian3.multiplyByScalar(flightDir, dot, flightUp);
    Cartesian3.subtract(Cartesian3.UNIT_Z, flightUp, flightUp);
    if (Cartesian3.magnitudeSquared(flightUp) < 1e-8) Cartesian3.clone(Cartesian3.UNIT_X, flightUp);
    else Cartesian3.normalize(flightUp, flightUp);
  }

  function flyCamera(from, to, duration, faceEarth, nadirPitch) {
    cancelCenter();
    placing = true;
    phoneMoving = true;
    applyPhoneQuality();
    const flight = ++centerFlight;
    const started = performance.now();
    Cartesian3.clone(from, flightFrom);
    Cartesian3.clone(to, flightTo);
    const startMag = Cartesian3.magnitude(flightFrom);
    const endMag = Cartesian3.magnitude(flightTo);
    const zoomingOut = endMag > startMag;
    const logZoom = faceEarth && startMag > 1 && endMag > 1 && Math.max(endMag / startMag, startMag / endMag) > 2.5;
    if (logZoom) {
      Cartesian3.normalize(flightFrom, zoomDirFrom);
      Cartesian3.normalize(flightTo, zoomDirTo);
    }
    scene.screenSpaceCameraController.enableInputs = false;

    const placeZoom = (radiusT, turnT) => {
      if (!logZoom) {
        Cartesian3.lerp(flightFrom, flightTo, radiusT, flightDest);
        return;
      }
      const radius = startMag * (endMag / startMag) ** radiusT;
      const dot = CesiumMath.clamp(Cartesian3.dot(zoomDirFrom, zoomDirTo), -1, 1);
      const omega = Math.acos(dot);
      if (omega < 1e-3) {
        Cartesian3.multiplyByScalar(zoomDirTo, radius, flightDest);
        return;
      }
      const sinOmega = Math.sin(omega);
      const weightFrom = Math.sin((1 - turnT) * omega) / sinOmega;
      const weightTo = Math.sin(turnT * omega) / sinOmega;
      Cartesian3.multiplyByScalar(zoomDirFrom, weightFrom, flightDest);
      Cartesian3.multiplyByScalar(zoomDirTo, weightTo, zoomScratch);
      Cartesian3.add(flightDest, zoomScratch, flightDest);
      Cartesian3.normalize(flightDest, flightDest);
      Cartesian3.multiplyByScalar(flightDest, radius, flightDest);
    };

    const frame = (now) => {
      if (flight !== centerFlight) return;
      const t = Math.min(1, (now - started) / duration);
      const eased = logZoom ? t : t * t * (3 - 2 * t);
      const turn = logZoom ? smoothstep(zoomingOut ? 0.42 : 0, zoomingOut ? 1 : 0.55, t) : eased;
      placeZoom(eased, turn);
      if (nadirPitch && t === 1) {
        viewer.camera.setView({
          destination: flightDest,
          orientation: { heading: 0, pitch: CesiumMath.toRadians(-89.9), roll: 0 },
        });
      } else if (faceEarth) {
        lookTowardEarth(flightDest);
        viewer.camera.setView({
          destination: flightDest,
          orientation: { direction: flightDir, up: flightUp },
        });
      } else {
        const pitch = viewer.camera.pitch;
        const heading = Number.isFinite(viewer.camera.heading) ? viewer.camera.heading : 0;
        viewer.camera.setView({
          destination: flightDest,
          orientation: {
            heading,
            pitch: Number.isFinite(pitch) ? pitch : CesiumMath.toRadians(-89.9),
            roll: 0,
          },
        });
      }
      scene.requestRender();
      if (t < 1) requestAnimationFrame(frame);
      else {
        placing = false;
        phoneMoving = false;
        applyPhoneQuality();
        scene.screenSpaceCameraController.enableInputs = true;
        finishMouseZoom();
      }
    };
    requestAnimationFrame(frame);
  }

  function flightDuration(startHeight, endHeight) {
    const steps = Math.abs(Math.log(Math.max(endHeight, 1) / Math.max(startHeight, 1)) / Math.log(1.8));
    return Math.min(1800, Math.max(450, 280 * steps));
  }

  function viewLimit() {
    const frustum = viewer.camera.frustum;
    const fovy = frustum.fovy || CesiumMath.toRadians(60);
    const width = scene.canvas.clientWidth || 1;
    const height = scene.canvas.clientHeight || 1;
    const halfY = fovy / 2;
    const halfX = Math.atan(Math.tan(halfY) * (width / height));
    return Math.max(0.12, Math.min(halfX, halfY) * 0.5);
  }

  function frameDistance(index) {
    return (FRAME_AU[index] * AU_DISPLAY_M) / Math.tan(viewLimit());
  }

  function setZoomCeiling(system) {
    scene.screenSpaceCameraController.maximumZoomDistance = system
      ? frameDistance(FRAME_AU.length - 1)
      : ORBIT_HEIGHT_M;
  }

  function poleDestination(distance, result) {
    const pole = eclipticNorth(skyWhen);
    return Cartesian3.multiplyByScalar(
      new Cartesian3(pole.x, pole.y, pole.z),
      distance + EARTH_RADIUS_M,
      result,
    );
  }

  function flyToPair() {
    const camera = viewer.camera;
    camera.cancelFlight();
    poleLock = true;
    setZoomCeiling(true);
    const distance = pairDistance();
    poleDestination(distance, flightTo);
    const start = Math.max(Cartesian3.magnitude(camera.positionWC), 1);
    flyCamera(camera.positionWC, flightTo, flightDuration(start, distance), true, false);
  }

  function flyToFrame(index) {
    const camera = viewer.camera;
    camera.cancelFlight();
    poleLock = true;
    setZoomCeiling(true);
    const distance = frameDistance(index);
    poleDestination(distance, flightTo);
    const start = Math.max(Cartesian3.magnitude(camera.positionWC), 1);
    flyCamera(camera.positionWC, flightTo, flightDuration(start, distance), true, false);
  }

  function frameIndex(height) {
    let index = 0;
    for (let i = 0; i < FRAME_AU.length; i += 1) {
      if (height >= frameDistance(i) * 0.85) index = i;
    }
    return index;
  }

  function flyHeight(nextHeight, keepGround = false) {
    const camera = viewer.camera;
    camera.cancelFlight();
    const startHeight = Math.max(camera.positionCartographic.height, MIN_HEIGHT_M);
    const endHeight = Math.min(MAX_HEIGHT_M, Math.max(MIN_HEIGHT_M, nextHeight));
    if (!keepGround && !poleLock && startHeight < ORBIT_HEIGHT_M) {
      const here = camera.positionCartographic;
      groundLon = CesiumMath.toDegrees(here.longitude);
      groundLat = CesiumMath.toDegrees(here.latitude);
    }
    if (endHeight >= ORBIT_HEIGHT_M) {
      flyToPair();
      return;
    }
    leftHeight = endHeight;
    const leavingSystem = poleLock || startHeight >= ORBIT_HEIGHT_M;
    poleLock = false;
    setZoomCeiling(false);
    Cartesian3.fromDegrees(groundLon, groundLat, endHeight, Ellipsoid.WGS84, flightTo);
    const duration = flightDuration(Math.max(startHeight, 1), Math.max(endHeight, 1));
    flyCamera(camera.positionWC, flightTo, duration, leavingSystem, leavingSystem);
  }

  function finishMouseZoom() {
    if (placing) return;
    const height = viewer.camera.positionCartographic.height;
    const distance = Cartesian3.magnitude(viewer.camera.positionWC);
    const pair = pairDistance();
    if (!poleLock && height >= ORBIT_HEIGHT_M * 0.98) flyToPair();
    else if (poleLock && distance < pair * 0.5) flyHeight(leftHeight, true);
    else if (poleLock && distance < frameDistance(0) * 0.42 && distance > pair * 1.35) flyToPair();
  }

  viewer.camera.moveEnd.addEventListener(finishMouseZoom);

  function originalView() {
    return {
      longitude: ((homeLongitude + 68 + 540) % 360) - 180,
      latitude: 14,
    };
  }

  function lookHome(instant) {
    cancelCenter();
    placing = false;
    poleLock = false;
    leftHeight = HOME_RANGE_M;
    setZoomCeiling(false);
    const { longitude, latitude } = originalView();
    groundLon = longitude;
    groundLat = latitude;
    const destination = Cartesian3.fromDegrees(longitude, latitude, HOME_RANGE_M);
    const orientation = {
      heading: 0,
      pitch: CesiumMath.toRadians(-90),
      roll: 0,
    };
    if (instant) {
      viewer.camera.setView({ destination, orientation });
      scene.requestRender();
      return;
    }
    viewer.camera.flyTo({ destination, orientation, duration: 1.6 });
  }

  function centerOn(latitude, longitude) {
    groundLon = longitude;
    groundLat = latitude;
    if (poleLock || viewer.camera.positionCartographic.height >= ORBIT_HEIGHT_M) {
      flyHeight(Math.min(leftHeight, HOME_RANGE_M), true);
      return;
    }
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
    const destination = new Cartesian3();
    scene.screenSpaceCameraController.enableInputs = false;

    const placeCamera = (t) => {
      const eased = t * t * (3 - 2 * t);
      Cartesian3.fromDegrees(
        startLon + deltaLon * eased,
        startLat + deltaLat * eased,
        height,
        Ellipsoid.WGS84,
        destination,
      );
      camera.setView({
        destination,
        orientation: { heading, pitch, roll: 0 },
      });
      scene.requestRender();
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
  const MAX_HEIGHT_M = SYSTEM_LIMIT_M;

  const EARTH_ZOOM = 1.8;

  function zoomIn() {
    const height = viewer.camera.positionCartographic.height;
    if (!poleLock) {
      flyHeight(height / EARTH_ZOOM);
      return;
    }
    const distance = Cartesian3.magnitude(viewer.camera.positionWC);
    if (distance < frameDistance(0) * 0.85) {
      flyHeight(leftHeight, true);
      return;
    }
    const index = frameIndex(height);
    if (index === 0) flyToPair();
    else flyToFrame(index - 1);
  }

  function zoomOut() {
    const height = viewer.camera.positionCartographic.height;
    if (!poleLock) {
      const next = height * EARTH_ZOOM;
      if (next >= ORBIT_HEIGHT_M) flyToPair();
      else flyHeight(next);
      return;
    }
    const distance = Cartesian3.magnitude(viewer.camera.positionWC);
    if (distance < frameDistance(0) * 0.85) {
      flyToFrame(0);
      return;
    }
    const index = frameIndex(height);
    if (index < FRAME_AU.length - 1) flyToFrame(index + 1);
  }

  function setObserver(latitude, longitude, name) {
    observerOn = true;
    you.position = Cartesian3.fromDegrees(longitude, latitude, 0);
    you.label.text = name;
  }

  function clearObserver() {
    observerOn = false;
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
    zoomIn,
    zoomOut,
    zoomOriginal: () => flyHeight(HOME_RANGE_M),
    setObserver,
    clearObserver,
    select,
    setOrbits,
    moving: () => phoneMoving,
    inSystem: () => systemFade() > 0.2,
    whenSelect(callback) {
      onSelect = callback;
    },
  };
}
