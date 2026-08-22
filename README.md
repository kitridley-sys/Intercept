# RAF INTERCEPT v2.2.2

## Radar image fix

The approved radar artwork is now bundled directly into the React/Vite application via an import from `src/assets/radar-reference.png`.

This removes the previous `/assets/...` runtime path dependency, which could result in the radar image not appearing after deployment.

The radar image is the sole base display. Live symbols are overlaid on top:
- RAF blue squares
- Unknown/hostile red squares
- Heading bugs
- Ghost trails
- QRA markers

Aircraft detail text is deliberately omitted from the radar display; details remain on Fighter Control.

Build:
`npm run build`

Netlify publish directory:
`dist`
