# SkiJumpWeb — classic ski jumping for the browser

**[Play in your browser](https://wieslawsoltes.github.io/SkiJumpWeb/)** · [Standalone HTML](https://wieslawsoltes.github.io/SkiJumpWeb/SkiJumpWeb.html) · [Source ZIP](https://wieslawsoltes.github.io/SkiJumpWeb/downloads/SkiJumpWeb-source.zip) · [npm packages](https://wieslawsoltes.github.io/SkiJumpWeb/downloads/SkiJumpWeb-npm-packages.zip)

[![Build, test and package](https://github.com/wieslawsoltes/SkiJumpWeb/actions/workflows/ci.yml/badge.svg)](https://github.com/wieslawsoltes/SkiJumpWeb/actions/workflows/ci.yml) [![GitHub Pages](https://github.com/wieslawsoltes/SkiJumpWeb/actions/workflows/pages.yml/badge.svg)](https://github.com/wieslawsoltes/SkiJumpWeb/actions/workflows/pages.yml)

A playable, independent Deluxe Ski Jump 2–style recreation, implemented in HTML, JavaScript and WebGPU. Version **0.2.0**. Ten reusable MIT-licensed npm packages, with no external runtime assets or downloads.

**This is not a verified full-fidelity clone.** The 32 country/K-point roster entries match the publisher's public list. Hill geometry, physics, scenery, glyphs and sounds are newly authored approximations. Menus follow the original yellow-on-gray/pixel presentation, not a pixel-perfect reconstruction of every original screen. Original `.rpl` files, original saves and Mediamond online records are not supported. See [the fidelity matrix](docs/FIDELITY.md).

## New in 0.2.0

The tour editor preserves preset ordering and supports up to 64 events, repeated hills, reordering, duplication, deterministic shuffling, JSON import/export and 20 locally saved named tours. World/team cups now include a bibbed start list, previous-round results, live standings, round transitions, event history, four-athlete team breakdowns and CSV export. Watched CPU jumps can be skipped with Space or the touch-friendly SKIP button; the current simulation finishes and submits once.

Practice has a last-50-attempt session table, landing rate/mean distance and deterministic SAME WIND retries. Records include a top-ten display per hill, up to 64 retained personal bests, aggregate personal distances and direct playback of the overall-record ghost. Replay entries can be renamed independently of their recorded player identity.

Replay controls add reverse playback, exact recorded-frame stepping, phase markers and adjustable flight-only/full-range loops. Left/Right steps samples; Home/End seeks bounds; T seeks the first flight sample; L seeks the landing transition. The FLIGHT marker is not a reconstructed original takeoff-button timestamp. Classic mouse commands react only to new primary/secondary presses, never releases or the middle button.

These are working features of this independent implementation. Their presence is not evidence of exact original-menu, physics, hill-geometry or binary-format equivalence. See [CHANGELOG](CHANGELOG.md) and [fidelity boundaries](docs/FIDELITY.md).

## Play immediately

Open **`SkiJumpWeb.html`** in a browser. It contains the entire game: no server, installation, font download, texture download or audio download is needed. Local-storage availability depends on the browser's file/private-mode policies; the game remains playable in memory if storage is denied.

For a normal hosted origin and the preferred WebGPU environment:

```sh
npm run build
npm start
```

Open **http://localhost:4173**. No `npm install` is needed for these commands. To open the hosted game on a phone with WebGPU, deploy `dist/` over HTTPS. A plain HTTP LAN address uses the available fallback rather than promising WebGPU access. The app supports portrait and landscape, including rotation during an active jump.

The build also emits a service worker and manifest. After a successful hosted visit and cache installation, the static game can be opened offline. Installation/fullscreen behavior depends on the browser and device.

## Play controls

| Action | Keyboard / mouse | Touch |
|---|---|---|
| Start | Space or click | START |
| Take off at the lip | Space; modern left click; classic both mouse buttons | JUMP; classic two-thumb chord |
| Balance | Gently move mouse down to lean forward, up to raise the nose; arrow keys | Drag vertically; optional permission-gated tilt |
| Telemark landing | Z or left click shortly before touchdown | TELEMARK |
| Safer parallel landing | X; modern right click; classic both buttons | TWO FEET |
| Pause / camera / practice retry | P or Escape / C / R | Toolbar / pause menu |
| Mute / fullscreen | M / F | Options / toolbar |

A gamepad uses the left stick for balance, A for start/takeoff/telemark, B for parallel landing and Start for pause. Optional motion controls and fullscreen require browser support; they are not prerequisites for play.

Take off close to the lip, make small balance corrections, and prepare the landing roughly a quarter-second before contact. Early landing preparation reduces lift. Missing a landing command, hard impact or severe imbalance causes a fall. Flight assistance is optional and **practice-only**; assisted records are kept separately.

## Implemented game features

All **32 hills**, from England K50 to Slovenia K250, are selectable immediately. Each has its own K-point, authored inrun/landing profile, scenery seed and environment category. Practice supports hill/player selection, adjustable wind and starting gate, same-seed retry, takeoff/flight guides and a personal-best ghost.

World Cup supports custom multi-hill tours, 1–16 local human players, CPU opponents up to a 64-jumper total field, two rounds, a top-30 final with ties, reverse final order and accumulated cup standings. Team Cup has four-athlete teams, CPU-filled teams, four groups per round and an eight-team final with ties. An interrupted cup is saved locally; unfinished jumps restart from the gate on resumption rather than restoring a mid-air frame.

Results include distance, five judge marks with highest/lowest discarded, distance/style points, takeoff quality, wind and landing status. Local records exclude falls. Save files and cup results can be exported. Player names, countries, teams and suit/helmet/ski colors are editable.

Replays can be stored locally, imported/exported as `.sjr.json`, scrubbed, looped and viewed at ±0.25×–4× speed using four cameras. The library retains up to 20 saved replays. Records retain per-hill ghosts separately. Backup export includes settings, players, records, personal leaderboards, named tours, statistics and the cup save; export replays separately.

## Reusable npm SDK

| Package | Responsibility |
|---|---|
| `@wieslawsoltes/ski-core` | Fixed clock, deterministic RNG, events and math |
| `@wieslawsoltes/ski-hills` | Hill catalog and smooth arc-length profiles |
| `@wieslawsoltes/ski-physics` | Inrun, takeoff, flight, landing, scoring and CPU control |
| `@wieslawsoltes/ski-competition` | Individual/team cups, ordered tours and serialization |
| `@wieslawsoltes/ski-replay` | Recording, validation, seeking, exact samples and interpolation |
| `@wieslawsoltes/ski-renderer` | WebGPU, WebGL2 and software rendering |
| `@wieslawsoltes/ski-audio` | Procedural Web Audio mixer and effects |
| `@wieslawsoltes/ski-input` | Mouse, keyboard, touch, gamepad and motion |
| `@wieslawsoltes/ski-storage` | Local persistence, records, tours, ghosts and backups |
| `@wieslawsoltes/ski-ui` | Authored bitmap lettering and HUD |

Every package has an ESM entry point, TypeScript declarations, a README/example, license and explicit dependency metadata. All ten packages and their internal dependencies use **0.2.0**. The ten **`.tgz` tarballs are included under `artifacts/`**. They are **not already published to npm**.

```sh
npm test                          # 100 deterministic Node tests; links workspace packages locally
npm run verify                    # publication-file checks, syntax checks, tests and build
npm run pack:all                   # regenerate ten npm tarballs, removing stale versions
node tools/verify-packages.mjs     # install/import tarballs in an isolated offline consumer
node tools/verify-packages.mjs --types  # also run strict TypeScript checking; tsc must be installed
```

To consume the SDK without publishing it, install all ten tarballs together in another project:

```sh
npm install /absolute/path/to/SkiJumpWeb/artifacts/*.tgz
```

A minimal headless engine example:

```js
import { JumpSimulation, CPUController, FIXED_DT } from '@wieslawsoltes/ski-physics';

const sim = new JumpSimulation('fin', { seed: 42 });
const cpu = new CPUController(42, 0.9);
while (sim.state.phase !== 'finished') {
  cpu.update(sim, FIXED_DT);
  sim.step(FIXED_DT);
}
console.log(sim.result);
```

Publication is deliberately opt-in: review namespace ownership, versions, licenses and npm authentication, then run `node tools/publish.mjs --confirm`. Without `--confirm`, it publishes nothing. GitHub Actions validates Node 20/22/24, independently installed npm tarballs, browser workflows and a dedicated secure-origin WebGPU suite. Pushes to `main` redeploy the game and checksum-verified downloads to GitHub Pages. npm registry publication remains opt-in; packing and deploying the game do not publish packages to npm.

## Rendering and performance architecture

The preferred backend is actual WebGPU: batched static terrain/structures, a small dynamic skier/shadow buffer, flat-shaded low-resolution 3D, depth testing and a GPU compute snow system. Static geometry is uploaded when changing hills, not every frame. Dynamic, uniform and weather upload arrays are reused. This is not a claim of an allocation-free render loop. WebGL2 uses the same geometry; a lower-detail Canvas software rasterizer is the last fallback. Device-loss recovery releases stale GPU resources and selects a usable fallback.

Simulation is a bounded-catch-up **120 Hz CPU fixed step**, independent of display frame rate. It is intentionally not a GPU physics implementation. Menus render at a reduced cadence. Resolution choices are classic 320×200 in 8:5 landscape, sharp 640×400, or capped adaptive; portrait adapts the render surface and enlarges HUD lettering. Audio is synthesized after interaction and has a bounded voice budget.

These architectural choices reduce work; they are **not a guarantee of a particular frame rate on every mobile device**.

## Validation and limitations

**100 Node tests pass**, including every hill, deterministic inputs, extreme winds, scoring, team/individual qualification, complete 32- and 64-event cups, replay validation and storage failures. **33 baseline and 36 additional Chromium workflow checks pass** using desktop and mobile touch emulation. The additional suite exercises ordered tours, cup state transitions, CPU skipping, event/team drilldowns, practice statistics, record ghosts and replay frame controls. All ten packed SDKs install and import in an isolated offline consumer, with strict TypeScript declarations checked against that consumer.

**Hosted WebGPU validation passed on Chromium using Google's SwiftShader adapter.** The suite executed actual WebGPU rendering and compute across all 32 hills in four weather modes, rendered a complete jump through landing, resized portrait/landscape surfaces, checked validation error scopes, deliberately destroyed the device, and recovered to WebGL2. The Pages workflow now requires this suite to pass rather than accepting an unavailable adapter as a successful GPU test. See [the recorded GPU report](artifacts/browser-webgpu.json), [release evidence](artifacts/release.json) and [testing notes](docs/TESTING.md). Subsequent Pages runs place fresh reports in downloadable source and workflow artifacts without committing generated captures on every build.

SwiftShader validates browser API/shader behavior, **not physical GPU performance or drivers**. The local offline host used Canvas software rendering; hosted baseline checks used WebGL2. Backend identities are recorded in the reports. Physical iOS/Android devices, Safari, gamepad hardware, motion permission prompts, installed-PWA behavior and real hardware device loss still need device validation. No test here establishes original DSJ2 pixel, physics, hill-geometry or binary-format equivalence.

## Layout

`packages/` contains the reusable SDK; `app/` the game frontend; `tools/` the zero-dependency builder/server/packager; `tests/` the test suites; `docs/` the architecture, roster and fidelity notes; `dist/` the deployable game; `SkiJumpWeb.html` the standalone build.

Original reference: [Mediamond DSJ2](https://www.mediamond.fi/dsj2/), [gallery](https://www.mediamond.fi/dsj2/gallery/), [32-hill selector](https://www.mediamond.fi/dsj2/hillrecords/?act=Show&group=0&list=32). This implementation is independent and not endorsed by Mediamond.
