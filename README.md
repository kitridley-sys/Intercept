# RAF INTERCEPT v1.0.0

Military-style radar plotting interface for the RAF INTERCEPT training game.

## New in v1.0.0
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


## v1.0.0
- Larger UI fonts for Chromebook/tablet readability.
- RAF aircraft are blue square contacts.
- Hostile and unidentified aircraft are red square contacts.
- UK is shown as a distinct country, with Ireland separately outlined.


## v1.0.0 — Two-screen controller layout

The simulator now has two purpose-built views that share live state between browser tabs/windows:

- `?view=radar` — uncluttered radar/plotting display for Monitor 1.
- `?view=control` — aircraft selection, contact notes, QRA scramble, vector, AAR, RTB and declaration controls for Monitor 2.

Open the app normally and use **OPEN CONTROL TAB** / **OPEN RADAR TAB**. Put the two browser windows on separate monitors. The Control view owns the simulation clock; the Radar view is a passive shared display. State synchronises through `BroadcastChannel` and `localStorage`.

For Netlify, publish the Vite `dist` directory.
