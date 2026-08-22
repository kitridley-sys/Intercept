# RAF INTERCEPT v2.2.0

## Radar rebuild

The radar screen has been rebuilt around the supplied radar reference image.

The reference image is now the **sole geographic/radar base layer**. The application does not draw an additional map, coastline, grid or artificial geography over it.

Live application elements are rendered above the image:
- RAF blue-square aircraft
- Unknown/hostile red-square aircraft
- Ghost trails
- Heading bugs
- QRA base markers
- Zoom and pan controls

The aircraft instruction/detail interface remains on the separate Fighter Control screen.

### Run
npm install
npm run dev

### Netlify
Build command: `npm run build`
Publish directory: `dist`
