# RAF INTERCEPT v1.5.0

Military-style radar plotting interface for the RAF INTERCEPT training game.

## New in v1.5.0
- Much larger operational map / scale.
- Zoom in/out with mouse wheel, on-screen +/− controls and buttons.
- Pan the map by click-dragging on desktop/Chromebook and touch-dragging on supported tablets.
- Reset / auto-centre view.
- Dark military plotting-tool visual language inspired by the supplied radar references.
- Dense range rings, waypoints, airways and contact symbology.
- Contact selection with detailed information.
- Per-contact notes: click a contact, type a note, press Enter or ADD NOTE.
- QRA bases, Voyager, fighters and radar contacts remain visible as layers.
- Responsive tablet / Chromebook layout.
- 15-minute training mission timer and scoring hooks.
- Training assistance can be toggled.
- No advertising or ad SDKs included.

## Run

npm install
npm run dev

For Netlify: publish directory `dist`, build command `npm run build`.


## v1.5.0
- Larger UI fonts for Chromebook/tablet readability.
- RAF aircraft are blue square contacts.
- Hostile and unidentified aircraft are red square contacts.
- UK is shown as a distinct country, with Ireland separately outlined.


## v1.5.0 — Two-screen controller layout

The simulator now has two purpose-built views that share live state between browser tabs/windows:

- `?view=radar` — uncluttered radar/plotting display for Monitor 1.
- `?view=control` — aircraft selection, contact notes, QRA scramble, vector, AAR, RTB and declaration controls for Monitor 2.

Open the app normally and use **OPEN CONTROL TAB** / **OPEN RADAR TAB**. Put the two browser windows on separate monitors. The Control view owns the simulation clock; the Radar view is a passive shared display. State synchronises through `BroadcastChannel` and `localStorage`.

For Netlify, publish the Vite `dist` directory.

## v1.5.0 — Controller-first two-screen mode
- Default URL opens the Fighter Control screen.
- A dedicated **OPEN RADAR SCREEN** button opens the radar display in a second browser tab/window.
- Radar URL: `?view=radar`.
- Control and radar share simulation state using `BroadcastChannel` with `localStorage` fallback.
- Control screen is focused on fighter/Voyager instructions, QRA, contact selection, notes and NATO-style command output.
- Radar screen is intentionally uncluttered and map-focused.


## v1.5.0 — Accurate North Sea geography
- Radar display uses Natural Earth 10m Admin-0 country geometry rather than hand-drawn CSS silhouettes.
- UK, Ireland, Norway, Denmark, Netherlands, Germany, Belgium and France are rendered as separate country polygons.
- Geometry is projected into the North Sea operating area and remains compatible with zoom/pan.
- Data is loaded from the Natural Earth GeoJSON distribution at runtime; Natural Earth data is public domain.
- The app falls back to the existing dark tactical presentation while the coastline data loads.

Data source: Natural Earth 10m Admin-0 Countries.


## v1.5.0 — timing, bases and Voyager
- QRA bases positioned more accurately: RAF Lossiemouth and RAF Coningsby.
- Voyager starts on the ground at RAF Brize Norton.
- All aircraft start with 100% fuel before scramble.
- QRA scramble has a 3-minute delay.
- Airborne aircraft generate a controller call requesting instructions.
- Intercept calculations can take up to 60 minutes.
- Radar plotting area is vertically stretched by approximately 15%.
- Voyager can be scrambled from Brize Norton before AAR.


## v1.5.0 — fighter handling and reinforcement

- QRA scramble time is random between 3 and 5 minutes, using a triangular distribution centred on 4 minutes.
- Fighter instruction panel provides heading, speed and altitude controls.
- Climb time is modelled at approximately 3,200 ft/min for gameplay.
- Typhoon model uses a 4,500 kg internal-fuel baseline with speed-dependent burn.
- Hostile/unidentified aircraft are assigned plausible high-level altitudes (18,000–36,000 ft).
- Controller can request back-up aircraft to be crewed and made ready.
- Back-up preparation takes 15 minutes before the aircraft can be ordered to scramble.


## v1.5.0 — simpler aircraft control
- Quick-select buttons make RAF aircraft selection immediate.
- Fighter instructions are reduced to a single HDG / SPD / ALT row with one SEND button.
- 5-minute racetrack pattern can be ordered for Typhoon aircraft.
- 5-minute racetrack pattern can be ordered for Voyager once airborne.
- Aircraft selection/status strip shows airborne, ground and racetrack status.
