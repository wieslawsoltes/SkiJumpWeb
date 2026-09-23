# Validation and evidence

## Engine and packages

`npm run verify` checks publication manifests/files and JavaScript syntax, runs 159 deterministic Node tests, and builds the static and standalone game. `npm run pack:all` replaces stale SkiJumpWeb tarballs and packages all ten synchronized SDKs. No runtime package download is required.

```sh
npm run verify
npm run pack:all
node tools/verify-packages.mjs --types
```

The consumer verifier installs only the actual tarballs into a separate temporary directory with `--offline --ignore-scripts`. It rejects stale/missing versions and workspace symlinks, imports all ten packages, and optionally type-checks a strict TypeScript consumer (`tsc` must be installed, or set `TSC`). CI covers Node 20, 22 and 24.

## Offline browser workflows

Install Python Playwright and Chromium, then run:

```sh
python3 tests/browser_full.py
python3 tests/browser_features.py
python3 tests/browser_fidelity.py
```

`CHROMIUM` overrides `/usr/bin/chromium`. All three tests use the inline standalone HTML with `set_content`, without runtime network assets. They enable a debug handle in test memory only. There are 33 baseline, 36 v0.2 workflow and 35 v0.3 fidelity checks; reports and captures are written under `artifacts/`. The new checks cover full cup round transitions, saved and repeated-venue schedules, live/history/team screens, watched-CPU skip, practice statistics, record replays, signed playback and precise samples, plus portrait/landscape touch workflows.

**Local 0.2 validation:** all 100 Node tests, both browser suites and the isolated strict-TypeScript package consumer passed. This offline host selected Canvas software rendering, not WebGPU or WebGL2. Each browser JSON report records the selected backend; a passing fallback test must never be reported as WebGPU execution.

## Secure-origin WebGPU suite

```sh
python3 tests/browser_gpu.py --require-webgpu
```

This test serves an ESM/import-map harness at `/SkiJumpWeb/` on loopback on an ordinary developer/CI host. It records adapter identity, requires the renderer actually select WebGPU, renders all 32 hills in four weather modes (including compute snowfall), runs a complete simulation, resizes portrait/landscape, checks validation error scopes, destroys the device and verifies recovery/disposal. Without `--require-webgpu`, unavailable adapters are explicitly reported as skipped rather than passed. The Pages workflow requires execution. See `artifacts/browser-webgpu.json` for the actual result.

Headless launch configuration follows the browser vendor's documented WebGPU testing approach: https://developer.chrome.com/blog/supercharge-web-ai-testing . SwiftShader validates browser API/shader paths, not physical GPU speed or drivers.

## Deployment

The Pages pipeline gates deployment on tests, creates reproducible source/static/package archives, and verifies the public files against SHA-256, the expected source commit, complete package/source membership and project-relative PWA paths. Nine standard-library tests exercise the deployment verifier.

## Remaining device/fidelity acceptance

Real Apple/Android devices, Safari, tilt permission flows, gamepad hardware, installed PWA/offline navigation, sustained frame pacing and thermal behavior require device tests. Original DSJ2 reference captures, control traces, geometry/physics constants and binary replay/save fixtures remain separate fidelity work. Current tests establish behavior of this independent game, not equality to the original.

## 0.3 fidelity scope

The browser fidelity suite drives actual mouse and multi-contact touch events. It
checks menu order, paged records, sound setup, gate expiry, timed feet, HUD geometry
and both orientations. It does not compare original pixels or trajectories. The
WebGPU harness now runs the new rules profile for all hills and the complete-jump
render path. Local hosted navigation may be blocked by the execution environment;
the required GPU check then runs on GitHub Actions and records its actual adapter.
