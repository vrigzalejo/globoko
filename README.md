# Globoko

A live 3D Earth that shows where the Sun, Moon, and planets are straight overhead right now.

Each pin is the point on the ground where that body is at zenith. Day and night on the globe follow the Sun. Pick a place to see how high a body is, which way to look, and when it rises and sets.

## Run it

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5173/.

```bash
npm run build
npm run preview
```

## Using it

- Drag to turn the Earth. Scroll, or use **+** and **−**, to zoom. **Original** restores the opening size and leaves the place you are looking at.
- Search for a place, or choose **My location**. The view recenters at the current zoom. Click the search box again to return to that place.
- The header clock is this computer’s time. When the place is in another zone, a second line shows the current time there.
- Select a body in the list or click its pin. **Paths** draws where each overhead point moves over the next 24 hours. Arrows appear only on the selected body.
- **Now**, **+6h**, **Tonight**, **Tomorrow**, and the slider move the sky off the present. **Now** returns to the live clock.
- With the Moon selected, **When to see the Moon** lists the next new moon, quarters, and full moon. A click moves the sky to that moment. From a chosen place, a phase that is still below the horizon jumps to moonrise there.

Imagery is Esri’s world mosaic on a smooth Earth. To load Cesium world terrain, set `VITE_CESIUM_ION_TOKEN` in `.env.local`.

## Continuous integration

Every pull request runs `npm ci` and `npm run build`. A push to `main` publishes the site with GitHub Pages.

In the repository settings, set Pages to deploy from GitHub Actions. The site is then at https://vrigzalejo.github.io/globoko/.

Positions come from [astronomy-engine](https://github.com/cosinekitty/astronomy). The globe is [Cesium](https://cesium.com/). Place search uses the [Photon](https://photon.komoot.io/) API.
