# Globoko improvement PRD

What still needs to improve in the live Earth, written from the app as it works on 20 Oct 2026.

A pin is the point on Earth where that body is straight overhead, not a picture of the body sitting on that country. Altitude and compass direction appear only after a place is set. Paths, when turned on, trace where that overhead point moves over the next day.

| | |
| --- | --- |
| Bodies | 9, updated every second while the sky is live |
| Path window | 24 hours, off until asked |
| Time | Live, or a chosen time. The slider starts at a day ago through two days ahead. A moon phase can reach about 50 days. |
| Zoom | Buttons and scroll. Original returns to the opening size without moving the place. |

## Already in the product

| Capability | State |
| --- | --- |
| Live Sun, Moon, and planets, with day and night lined up to the Sun | Shipped |
| Moon drawn to scale, with phase name and percent lit | Shipped |
| Next new moon, first quarter, full moon, and last quarter. A click moves the sky to that moment, or to moonrise at the chosen place if the Moon is still down. | Shipped |
| Place search, My location, and pin clicks recenter without zooming. Clicking the search box again returns to the saved place. | Shipped |
| Current time at the chosen place, shown in the header when that zone differs from this computer | Shipped |
| Altitude, azimuth, rise, and set once a place is set | Shipped |
| Paths off until asked. One line per body. Arrows only on the selected body. | Shipped |
| Time control for now, a few hours ahead, tonight, and tomorrow | Shipped |
| Zoom in, zoom out, and original size | Shipped |
| Layout from a wide screen down to a phone. On a narrow screen the list is a bottom sheet, and zoom, time, and the credit stay clear of each other. | Shipped |
| Terrain and names on the ground | Terrain only with an ion token. No map labels. |

## What needs to improve

### Make a pin mean straight overhead

**Problem.** The lede says pins mark where each body is straight overhead, but the map still looks like a location of the body itself. Inner planets cluster on the Sun near conjunction. That is the real sky, and nothing in the panel says so.

**Requirement.** Keep one sentence for the pin: this is where the body is at zenith right now. After a place is set, the list leads with altitude and compass direction, and the detail panel keeps the overhead coordinates as a second line. When two bodies are within a few degrees, say they share the same part of the sky instead of drawing them as one confused pin.

**Acceptance.**

- A first visit can tell that the pin is a zenith point, not the body sitting on that country.
- With a place set, each row shows altitude before the overhead coordinates.
- Venus near the Sun is described as sharing that part of the sky.

### Give rise and set the place’s own time

**Problem.** The header shows the current time at the chosen place. Rise, set, and the moon-phase times still use this computer’s zone. A Paris sunrise can still read as the previous evening in Pacific time, with only the zone abbreviation to say so.

**Requirement.** Rise and set, and the moon-phase rise and set lines, use the place’s local time and zone name, with this computer’s time beside them. A place in the same zone does not show the same time twice. The header clock stays as it is.

**Acceptance.**

- Paris sunrise reads as a morning hour in Paris, with the Pacific time still available.
- A place in the same zone as the computer does not repeat the time.

### Show the ground when the view comes in close

**Problem.** Imagery is Esri’s world mosaic on a smooth Earth. Terrain loads only when a Cesium ion token is set. There are no place names on the globe, so a zoomed city is a picture without a label.

**Requirement.** If terrain is configured, close zoom shows relief. If it is not, the interface says the Earth is smooth. Add a light set of country labels when the whole disk is visible and city labels when the view is close, without covering the pins.

**Acceptance.**

- Zooming in on mountains shows height, or the screen says terrain is off.
- City names appear at that scale and do not hide the selected pin.

### Picture how high the body is

**Problem.** Altitude, azimuth, rise, and set are a table. The globe shows the overhead point, which is a different question. Nothing draws the local sky.

**Requirement.** For the selected body at the chosen place, draw a simple horizon: the body, the compass direction, and whether it is up or down. Keep the numbers. Hide the graphic until a place is set.

**Acceptance.**

- The graphic and the altitude sentence agree for the Sun below the horizon and for the Moon above it.
- Clearing the place removes the graphic and asks for a place again.

### Open the same view from a link

**Problem.** Nothing in the address changes as you search, select, or turn paths on. A reload always starts on the Sun, at now, with paths off.

**Requirement.** Updating the view updates the query string. Opening that address restores body, place, time offset, and paths. A link with no query still opens the current default.

**Acceptance.**

- Copying the address after a Paris search and a Moon selection restores both.
- An address with no parameters matches a fresh visit.

### Keep the sky when the map or search fails

**Problem.** Place search uses Photon and imagery uses Esri. A network failure currently fails quietly or leaves an empty result list. The sky math does not need either service.

**Requirement.** If search fails, say so in the search box and keep the last place. If imagery fails, keep a plain Earth and the pins, and say that the photo layer did not load.

**Acceptance.**

- Blocking the search host still lets you pick a body and read its overhead point.
- The message goes away when the next search succeeds.

### Lock the sky answers with tests

**Problem.** The sky is computed in the browser on a one-second timer. The mistakes so far were labeling a gibbous Moon as quarter, drawing tracks that looked directionless, and formatting another city’s sunrise in the computer’s zone.

**Requirement.** Add tests for the phase name at the boundaries already used, for a Sun track that moves west and returns near the start after 24 hours, and for rise/set text that uses the place’s zone. Do not require a WebGL test for this cut.

**Acceptance.**

- The tests fail if a gibbous phase is named quarter.
- The tests fail if a 6-hour Sun sample moves east.
- The tests fail if a Paris sunrise is formatted only in the computer’s zone.

## Out of scope

Drawing the Sun and planets at true scale in the same view as a readable Earth. Their real distances would put them off a screen that still shows the ground.

Replacing the astronomy library, or copying Google’s imagery. Esri’s world mosaic stays the photo layer unless a later decision says otherwise.

A second product surface such as a full planetarium. The horizon graphic is a reading aid for the selected body, not a separate sky app.
