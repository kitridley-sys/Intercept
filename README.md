# RAF INTERCEPT v2.3.1

## Radar display repaired

v2.2.2 accidentally removed the `RadarMap` component, which caused the radar URL to render a blank page. v2.2.3 restores the component.

The supplied radar artwork is bundled at `src/assets/radar-reference.png` and imported directly by React/Vite.

The radar display includes:
- Supplied UK/North Sea radar artwork as the base
- RAF blue-square live contacts
- Unknown/hostile red-square live contacts
- Heading bugs
- Ghost trails
- QRA markers
- Zoom and pan
- Separate fighter-control screen

Netlify:
Build command: `npm run build`
Publish directory: `dist`
