# SkiJumpWeb — classic ski jumping for the browser

**[Play in your browser](https://wieslawsoltes.github.io/SkiJumpWeb/)** · [Standalone HTML](https://wieslawsoltes.github.io/SkiJumpWeb/SkiJumpWeb.html) · [Source ZIP](https://wieslawsoltes.github.io/SkiJumpWeb/downloads/SkiJumpWeb-source.zip) · [npm packages](https://wieslawsoltes.github.io/SkiJumpWeb/downloads/SkiJumpWeb-npm-packages.zip)

[![Build, test and package](https://github.com/wieslawsoltes/SkiJumpWeb/actions/workflows/ci.yml/badge.svg)](https://github.com/wieslawsoltes/SkiJumpWeb/actions/workflows/ci.yml) [![GitHub Pages](https://github.com/wieslawsoltes/SkiJumpWeb/actions/workflows/pages.yml/badge.svg)](https://github.com/wieslawsoltes/SkiJumpWeb/actions/workflows/pages.yml)

A playable, independent Deluxe Ski Jump 2–style recreation, implemented in HTML, JavaScript and WebGPU. Version **0.1.0**. Ten reusable MIT-licensed npm packages, with no external runtime assets or downloads.

**This is not a verified full-fidelity clone.** The 32 country/K-point roster entries match the publisher's public list. Hill geometry, physics, scenery, glyphs and sounds are newly authored approximations. Menus follow the original yellow-on-gray/pixel presentation, not a pixel-perfect reconstruction of every original screen. Original `.rpl` files, original saves and Mediamond online records are not supported. See [the fidelity matrix](docs/FIDELITY.md).

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

Replays can be stored locally, imported/exported as `.sjr.json`, scrubbed, looped and viewed at 0.25×–4× speed using four cameras. The library retains up to 20 saved replays. Records retain per-hill ghosts separately. Backup export includes settings, players, records, statistics and the cup save; export replays separately.

## Reusable npm SDK

| Package | Responsibility |
|---|---|
| `@wieslawsoltes/ski-core` | Fixed clock, deterministic RNG, events and math |
| `@wieslawsoltes/ski-hills` | Hill catalog and smooth arc-length profiles |
| `@wieslawsoltes/ski-physics` | Inrun, takeoff, flight, landing, scoring and CPU control |
| `@wieslawsoltes/ski-competition` | Individual/team cups and serialization |
| `@wieslawsoltes/ski-replay` | Recording, validation, seeking and interpolation |
| `@wieslawsoltes/ski-renderer` | WebGPU, WebGL2 and software rendering |
| `@wieslawsoltes/ski-audio` | Procedural Web Audio mixer and effects |
| `@wieslawsoltes/ski-input` | Mouse, keyboard, touch, gamepad and motion |
| `@wieslawsoltes/ski-storage` | Local persistence, records, ghosts and backups |
| `@wieslawsoltes/ski-ui` | Authored bitmap lettering and HUD |

Every package has an ESM entry point, TypeScript declarations, a README/example, license and explicit dependency metadata. The ten **`.tgz` tarballs are included under `artifacts/`**. They are **not already published to npm**.

```sh
npm test              # 64 deterministic Node tests; links workspace packages locally
npm run verify        # publication-file checks, syntax checks, tests and build
npm run pack:all      # regenerate ten npm tarballs
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

Publication is deliberately opt-in: review namespace ownership, versions, licenses and npm authentication, then run `node tools/publish.mjs --confirm`. Without `--confirm`, it publishes nothing. GitHub Actions verifies Node 20/22/24 and deploys GitHub Pages automatically on pushes to `main`. The Pages build also reruns the desktop/touch integration suite, generates the ten npm tarballs and publishes downloadable source/static/package archives. Registry publication remains opt-in; the Pages workflow never publishes to npm.

## Rendering and performance architecture

The preferred backend is actual WebGPU: batched static terrain/structures, a small dynamic skier/shadow buffer, flat-shaded low-resolution 3D, depth testing and a GPU compute snow system. Static geometry is uploaded when changing hills, not every frame. WebGL2 uses the same geometry; a lower-detail Canvas software rasterizer is the last fallback. Device loss can fall back to WebGL2.

Simulation is a bounded-catch-up **120 Hz CPU fixed step**, independent of display frame rate. It is intentionally not a GPU physics implementation. Menus render at a reduced cadence. Resolution choices are classic 320×200 in 8:5 landscape, sharp 640×400, or capped adaptive; portrait adapts the render surface and enlarges HUD lettering. Audio is synthesized after interaction and has a bounded voice budget.

These architectural choices reduce work; they are **not a guarantee of a particular frame rate on every mobile device**.

## Validation and limitations

**64 Node tests pass**, including every hill, deterministic inputs, extreme winds, scoring, team/individual qualification, a complete 32-hill cup, replay validation and storage failures. **33 Chromium integration checks pass** using desktop and mobile touch emulation: controls, rotation during flight, replay UI, audio lifecycle, WebGL2 and software fallback. Type declarations pass a strict TypeScript check. Test logs and screenshots are included in `artifacts/` and in the downloadable release. The first Pages run initializes generated distributions and captures in the repository; subsequent runs publish fresh captures in the release downloads and workflow artifacts without growing Git history on each build.

The test environment did not expose WebGPU to the offline browser document, so **the browser WebGPU backend was not executed here**. The shaders and host path were reviewed, but this is not a substitute for testing on a real adapter. Physical iOS/Android devices, Safari, gamepad hardware, motion permission prompts, PWA installation and real GPU device loss still need device validation. See [testing notes](docs/TESTING.md).

## Layout

`packages/` contains the reusable SDK; `app/` the game frontend; `tools/` the zero-dependency builder/server/packager; `tests/` the test suites; `docs/` the architecture, roster and fidelity notes; `dist/` the deployable game; `SkiJumpWeb.html` the standalone build.

Original reference: [Mediamond DSJ2](https://www.mediamond.fi/dsj2/), [gallery](https://www.mediamond.fi/dsj2/gallery/), [32-hill selector](https://www.mediamond.fi/dsj2/hillrecords/?act=Show&group=0&list=32). This implementation is independent and not endorsed by Mediamond.
