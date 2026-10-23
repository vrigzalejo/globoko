import {
  ArcType,
  CallbackProperty,
  Cartesian2,
  Cartesian3,
  Color,
  ColorMaterialProperty,
  HorizontalOrigin,
  LabelStyle,
  NearFarScalar,
  PointPrimitiveCollection,
  VerticalOrigin,
  defined,
} from 'cesium';
import { FIGURES, GALAXIES, galacticToEquatorial, milkyWayBands } from './figures.js';
import { fixedSky } from './sky.js';

const SKY_RADIUS_M = 6e12;
const LINE = Color.fromCssColorString('#d5dde8');
const BAND = Color.fromCssColorString('#d9d0ff');

function starSize(magnitude) {
  return Math.max(1.6, Math.min(4.4, 3.2 - magnitude * 0.55));
}

function galaxyImage() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 72;
  const ctx = canvas.getContext('2d');
  ctx.translate(64, 36);
  ctx.rotate(-0.5);
  const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 52);
  glow.addColorStop(0, 'rgba(255,255,255,0.95)');
  glow.addColorStop(0.28, 'rgba(214,226,255,0.75)');
  glow.addColorStop(1, 'rgba(180,198,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(0, 0, 52, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  return canvas;
}

let drawRadius = 1;

function writeSky(position, ra, dec, date) {
  const point = fixedSky(ra, dec, date, drawRadius);
  position.x = point.x;
  position.y = point.y;
  position.z = point.z;
}

export function createCelestialLayer(viewer) {
  const { scene } = viewer;
  if (scene.skyBox) scene.skyBox.show = false;

  let fade = 0;
  const points = scene.primitives.add(new PointPrimitiveCollection());
  points.show = false;
  const image = galaxyImage();
  const labelFont = '600 11px Outfit, "Segoe UI", sans-serif';
  const outline = Color.fromCssColorString('#061018');

  const figures = FIGURES.map((figure) => {
    const stars = figure.stars.map(([ra, dec, magnitude]) => {
      const position = new Cartesian3();
      const point = points.add({
        position,
        pixelSize: starSize(magnitude ?? 3),
        color: Color.WHITE,
      });
      return { ra, dec, magnitude: magnitude ?? 6, position, point };
    });
    const strokes = figure.strokes.map((indexes, index) => {
      const positions = indexes.map((starIndex) => stars[starIndex].position);
      const entity = viewer.entities.add({
        id: `constellation-${figure.name}-${index}`,
        show: false,
        polyline: {
          positions: new CallbackProperty(() => positions, false),
          width: 1.25,
          arcType: ArcType.NONE,
          material: new ColorMaterialProperty(new CallbackProperty(
            () => LINE.withAlpha(0.55 * fade),
            false,
          )),
        },
      });
      return { positions, entity };
    });
    const labelAt = new Cartesian3();
    const names = { on: false };
    const entity = viewer.entities.add({
      id: `constellation-name-${figure.name}`,
      show: false,
      position: new CallbackProperty(() => labelAt, false),
      label: {
        text: figure.label ?? figure.name,
        font: labelFont,
        fillColor: LINE,
        outlineColor: outline,
        outlineWidth: 3,
        style: LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: VerticalOrigin.CENTER,
        horizontalOrigin: HorizontalOrigin.CENTER,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        show: new CallbackProperty(() => names.on, false),
      },
    });
    return { figure, stars, strokes, labelAt, entity, names };
  });

  const bands = milkyWayBands().map((band) => {
    const positions = band.samples.map(() => new Cartesian3());
    const entity = viewer.entities.add({
      id: `milky-way-${band.latitude}`,
      show: false,
      polyline: {
        positions: new CallbackProperty(() => positions, false),
        width: band.width,
        arcType: ArcType.NONE,
        material: new ColorMaterialProperty(new CallbackProperty(
          () => BAND.withAlpha(band.alpha * fade),
          false,
        )),
      },
    });
    return { band, positions, entity };
  });

  const milkyAt = new Cartesian3();
  const milkyOffset = new Cartesian2(0, -14);
  let milkyOn = false;
  const milkyLabel = viewer.entities.add({
    id: 'milky-way-name',
    show: false,
    position: new CallbackProperty(() => milkyAt, false),
    label: {
      text: 'Milky Way',
      font: labelFont,
      fillColor: BAND,
      outlineColor: outline,
      outlineWidth: 3,
      style: LabelStyle.FILL_AND_OUTLINE,
      pixelOffset: milkyOffset,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      show: new CallbackProperty(() => milkyOn, false),
    },
  });

  const galaxies = GALAXIES.map((galaxy) => {
    const position = new Cartesian3();
    const marker = { named: false };
    const offset = new Cartesian2(0, -18);
    const entity = viewer.entities.add({
      id: `galaxy-${galaxy.name}`,
      show: false,
      position: new CallbackProperty(() => position, false),
      billboard: {
        image,
        scale: 0.72,
        scaleByDistance: new NearFarScalar(1e11, 1.15, SKY_RADIUS_M, 0.85),
        show: new CallbackProperty(() => fade > 0.2, false),
      },
      label: {
        text: galaxy.name,
        font: labelFont,
        fillColor: Color.fromCssColorString('#e7eeff'),
        outlineColor: outline,
        outlineWidth: 3,
        style: LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: offset,
        verticalOrigin: VerticalOrigin.BOTTOM,
        horizontalOrigin: HorizontalOrigin.CENTER,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        show: new CallbackProperty(() => marker.named, false),
      },
    });
    return { galaxy, position, entity, marker, offset };
  });

  const ellipsoid = scene.globe.ellipsoid;
  const ray = new Cartesian3();
  let groundOn = false;
  const GROUND_LIFT_M = 70_000;

  function dropOnEarth(target) {
    const hit = ellipsoid.scaleToGeodeticSurface(ray, target);
    if (!hit) return false;
    Cartesian3.normalize(target, ray);
    Cartesian3.multiplyByScalar(ray, GROUND_LIFT_M, ray);
    Cartesian3.add(target, ray, target);
    return true;
  }

  function groundLabel(id, text, at, flag, fill) {
    return viewer.entities.add({
      id,
      position: new CallbackProperty(() => at, false),
      point: {
        pixelSize: fill === BAND ? 8 : 5,
        color: fill,
        outlineColor: outline,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        show: new CallbackProperty(() => flag.on, false),
      },
      label: {
        text,
        font: labelFont,
        fillColor: fill,
        outlineColor: outline,
        outlineWidth: 3,
        style: LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cartesian2(0, -12),
        verticalOrigin: VerticalOrigin.BOTTOM,
        horizontalOrigin: HorizontalOrigin.CENTER,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        show: new CallbackProperty(() => flag.on, false),
      },
    });
  }

  for (const figure of figures) {
    figure.groundAt = new Cartesian3();
    figure.ground = { on: false };
    figure.bright = Math.min(...figure.stars.map((star) => star.magnitude));
    groundLabel(
      `overhead-${figure.figure.name}`,
      figure.figure.label ?? figure.figure.name,
      figure.groundAt,
      figure.ground,
      LINE,
    );
  }

  for (const galaxy of galaxies) {
    galaxy.groundAt = new Cartesian3();
    galaxy.ground = { on: false };
    groundLabel(
      `overhead-${galaxy.galaxy.name}`,
      galaxy.galaxy.name,
      galaxy.groundAt,
      galaxy.ground,
      BAND,
    );
  }

  const milkyGroundAt = new Cartesian3();
  const milkyGround = { on: false };
  groundLabel('overhead-milky-way', 'Milky Way', milkyGroundAt, milkyGround, BAND);
  const equator = bands.find((belt) => belt.band.latitude === 0);
  const milkyGroundLine = equator.band.samples.map(() => new Cartesian3());
  const milkyGroundEntity = viewer.entities.add({
    id: 'overhead-milky-way-line',
    show: false,
    polyline: {
      positions: new CallbackProperty(() => milkyGroundLine, false),
      width: 2,
      arcType: ArcType.NONE,
      material: new ColorMaterialProperty(BAND.withAlpha(0.45)),
    },
  });

  function canvasPoint(position) {
    try {
      return scene.cartesianToCanvasCoordinates(position);
    } catch {
      return undefined;
    }
  }

  function onScreen(position) {
    return defined(canvasPoint(position));
  }

  function shiftLabel(position, offset, lift) {
    offset.x = 0;
    offset.y = -lift;
    const point = canvasPoint(position);
    if (!defined(point)) return;
    const canvas = scene.canvas;
    const cx = (canvas.clientWidth || 1) / 2;
    const cy = (canvas.clientHeight || 1) / 2;
    const dx = point.x - cx;
    const dy = point.y - cy;
    const dist = Math.hypot(dx, dy) || 1;
    const push = Math.max(0, 168 - dist);
    offset.x = (dx / dist) * push;
    offset.y = (dy / dist) * push - lift;
  }

  function figureReadable(stars) {
    if (stars.length < 2) return onScreen(stars[0].position);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let seen = 0;
    for (const star of stars) {
      const point = scene.cartesianToCanvasCoordinates(star.position);
      if (!defined(point)) continue;
      seen += 1;
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
    if (seen < 2) return false;
    const span = Math.hypot(maxX - minX, maxY - minY);
    const limit = Math.min(scene.canvas.clientWidth || 1, scene.canvas.clientHeight || 1);
    return span > 72 && span < limit * 0.85;
  }

  let when = new Date();

  function place(date) {
    when = date ? new Date(date.getTime()) : new Date();
    drawRadius = fade > 0.08 ? SKY_RADIUS_M : 1;
    for (const figure of figures) {
      let x = 0;
      let y = 0;
      let z = 0;
      for (const star of figure.stars) {
        writeSky(star.position, star.ra, star.dec, when);
        star.point.position = star.position;
        x += star.position.x;
        y += star.position.y;
        z += star.position.z;
      }
      const span = Math.hypot(x, y, z) || 1;
      const scale = drawRadius / span;
      figure.labelAt.x = x * scale;
      figure.labelAt.y = y * scale;
      figure.labelAt.z = z * scale;
    }
    for (const belt of bands) {
      belt.band.samples.forEach((sample, index) => {
        writeSky(belt.positions[index], sample.ra, sample.dec, when);
      });
    }
    const center = galacticToEquatorial(0, 0);
    writeSky(milkyAt, center.ra, center.dec, when);
    for (const galaxy of galaxies) {
      writeSky(galaxy.position, galaxy.galaxy.ra, galaxy.galaxy.dec, when);
    }
    for (const figure of figures) {
      ray.x = 0;
      ray.y = 0;
      ray.z = 0;
      for (const star of figure.stars) {
        const point = fixedSky(star.ra, star.dec, when, 1);
        ray.x += point.x;
        ray.y += point.y;
        ray.z += point.z;
      }
      dropOnEarth(figure.groundAt);
    }
    for (const galaxy of galaxies) {
      const point = fixedSky(galaxy.galaxy.ra, galaxy.galaxy.dec, when, 1);
      ray.x = point.x;
      ray.y = point.y;
      ray.z = point.z;
      dropOnEarth(galaxy.groundAt);
    }
    const heart = fixedSky(center.ra, center.dec, when, 1);
    ray.x = heart.x;
    ray.y = heart.y;
    ray.z = heart.z;
    dropOnEarth(milkyGroundAt);
    equator.band.samples.forEach((sample, index) => {
      const point = fixedSky(sample.ra, sample.dec, when, 1);
      ray.x = point.x;
      ray.y = point.y;
      ray.z = point.z;
      dropOnEarth(milkyGroundLine[index]);
    });
  }

  function faces(position) {
    const camera = viewer.camera.positionWC;
    return (camera.x - position.x) * position.x
      + (camera.y - position.y) * position.y
      + (camera.z - position.z) * position.z > 0;
  }

  function refreshGround() {
    const onGround = groundOn && fade < 0.18;
    milkyGroundEntity.show = onGround;
    for (const figure of figures) figure.ground.on = false;
    for (const galaxy of galaxies) galaxy.ground.on = false;
    milkyGround.on = false;
    if (!onGround) return;
    const candidates = [];
    for (const galaxy of galaxies) {
      if (faces(galaxy.groundAt)) candidates.push({ rank: 0, at: galaxy.groundAt, flag: galaxy.ground });
    }
    if (faces(milkyGroundAt)) candidates.push({ rank: 1, at: milkyGroundAt, flag: milkyGround });
    for (const figure of figures) {
      if (faces(figure.groundAt)) {
        candidates.push({ rank: 2 + figure.bright, at: figure.groundAt, flag: figure.ground });
      }
    }
    candidates.sort((a, b) => a.rank - b.rank);
    const kept = [];
    for (const item of candidates) {
      const point = canvasPoint(item.at);
      if (!defined(point)) continue;
      const clear = kept.every((other) => Math.hypot(point.x - other.x, point.y - other.y) > 46);
      if (!clear) continue;
      item.flag.on = true;
      kept.push(point);
    }
  }

  let painted = -1;
  function setFade(value) {
    const wasVisible = fade > 0.08;
    fade = value;
    const visible = value > 0.08;
    if (wasVisible !== visible) place(when);
    if (points.show !== visible || Math.abs(value - painted) >= 0.04) {
      painted = value;
      points.show = visible;
      const color = Color.WHITE.withAlpha(Math.min(0.95, 0.2 + value));
      for (const figure of figures) {
        for (const star of figure.stars) star.point.color = color;
        for (const stroke of figure.strokes) stroke.entity.show = visible;
        figure.entity.show = visible;
      }
      for (const belt of bands) belt.entity.show = visible;
      milkyLabel.show = visible;
      for (const galaxy of galaxies) galaxy.entity.show = visible;
    }
    const name = visible && fade > 0.35;
    milkyOn = name && onScreen(milkyAt);
    if (milkyOn) shiftLabel(milkyAt, milkyOffset, 14);
    for (const galaxy of galaxies) {
      galaxy.marker.named = name && onScreen(galaxy.position);
      if (galaxy.marker.named) shiftLabel(galaxy.position, galaxy.offset, 18);
    }
    for (const figure of figures) figure.names.on = name && figureReadable(figure.stars);
    refreshGround();
  }

  function setGround(on) {
    groundOn = Boolean(on);
    refreshGround();
    scene.requestRender();
  }

  place(when);
  setFade(0);

  return { place, setFade, setGround };
}
