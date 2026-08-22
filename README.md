# RAF INTERCEPT v2.1.1

A two-screen RAF air defence interception simulator.

## v2.1.1 clean rebuild

- Fighter Control is the default screen.
- Dedicated Radar Screen can be opened in a second tab/window.
- Shared state between controller and radar views.
- Large tactical North Sea plotting area with zoom/pan.
- RAF aircraft use blue square symbols.
- Hostile/unidentified aircraft use red square symbols.
- Realistic country outlines and distinct UK/Ireland geography.
- QRA bases: RAF Lossiemouth and RAF Coningsby.
- Voyager starts on the ground at RAF Brize Norton.
- Aircraft remain at 100% fuel before scramble.
- QRA scramble delay is random between 3 and 5 minutes.
- Airborne aircraft report to the controller and request instructions.
- Controller can issue heading, speed and altitude.
- Climb time is simulated.
- Intercepts can develop over up to 60 minutes.
- Typhoon fuel/burn model for gameplay.
- Voyager AAR and 5-minute racetrack option.
- Typhoon 5-minute racetrack option.
- Back-up aircraft can be requested and take 15 minutes to prepare.
- Contact notes and controller event log.
- No advertising or ad SDKs.

## Run locally

```bash
npm install
npm run dev
```

## Build for Netlify

```bash
npm run build
```

Publish directory: `dist`

## v2 design principle

Keep the controller interface simple: select an aircraft, issue the basic instruction, and monitor the result. The radar is a separate operational display rather than another collection of controls.


## v2.1.1
- Realistic widescreen radar visual based on the supplied reference image.
- Aircraft detail information is kept off the radar display.
- Radar is intended as the dedicated second-monitor display.
- Live application overlays remain above the radar background.


## v2.1.1 — radar tab fix
- Fixed the blank Radar Screen caused by invalid/leftover controller code in the radar component.
- Radar tab now renders a self-contained radar-only interface.
- Removed aircraft detail blocks from the radar display.
- The supplied realistic radar artwork is retained as the background.
