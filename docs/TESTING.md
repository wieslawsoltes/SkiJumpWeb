# Validation

Run `npm run verify` for publication-file checks, JavaScript syntax checks, 64 deterministic Node tests and a fresh static/standalone build. Run `npm run pack:all` for the ten npm artifacts. The source test runner needs only Node 20+; it creates local workspace symlinks rather than downloading dependencies.

A strict declaration check can be run with an installed TypeScript compiler:

```sh
tsc --noEmit --strict --module nodenext --moduleResolution nodenext --target es2022 packages/*/index.d.ts
```

## Browser integration

`tests/browser_full.py` is optional and requires Python Playwright and an installed Chromium executable. `CHROMIUM` overrides `/usr/bin/chromium`. For a Linux host without a graphical display, start Xvfb and use its DISPLAY. The test uses the offline standalone HTML with `set_content`, not an external service. It temporarily enables the application's debug handle in test memory only.

```sh
npm run build
DISPLAY=:99 python tests/browser_full.py
```

It verifies 33 interactions/checks: startup, all hills, keyboard and touch takeoff, mouse/touch balance, pause/resume, landing/results, replay save/play/seek/speed, players, setup, audio lifecycle, rotation, WebGL2 errors and software fallback. It saves screenshots and JSON/text reports under `artifacts/`.

**Observed here:** 64/64 Node tests and 33/33 browser checks passed; no browser JavaScript or renderer console errors; strict declarations passed. WebGL2 ran on Chromium's software graphics environment, not representative phone hardware. Screenshots were inspected at desktop, portrait and landscape sizes. All ten npm tarballs were also installed together offline into a separate consumer project; all ten packages imported successfully, and the independently installed physics package completed a successful CPU jump. See `artifacts/package-install.txt`.

**Not exercised:** the browser WebGPU path, physical GPUs/device loss, Safari, physical iOS/Android touch/tilt, gamepad hardware, PWA installation and service-worker offline navigation. The offline browser document did not expose WebGPU, so a successful fallback test must not be reported as a successful WebGPU test. GPU shader source and host API use were reviewed, including vector/scalar arithmetic, uniform layouts and integer draw counts; adapter execution remains required.

Recommended device acceptance: Chrome/Edge WebGPU desktop, Safari on Apple hardware, Android portrait/landscape with a thermal/performance soak, denied local-storage/motion permissions, tab background/foreground, GPU loss, installed-app launch and offline reload. Compare original-game reference images and input traces separately for fidelity; current tests validate this implementation, not equality to DSJ2.
