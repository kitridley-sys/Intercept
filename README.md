# RAF INTERCEPT v2.2.1

## Radar display fix

The supplied radar reference image is now loaded as a **direct CSS background** on the radar viewport, with a second background layer inside the zoom/pan canvas. This avoids the previous image rendering issue.

The reference image is the sole geographic base. Live RAF/unknown contacts, heading bugs, trails and QRA markers are layered above it.

The controller interface remains on the separate Fighter Control screen.

Run:
`npm install`
`npm run dev`

Netlify:
Build command `npm run build`
Publish directory `dist`
