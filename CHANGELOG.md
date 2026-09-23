# Changelog

## 0.4.0 — 2026-09-23

- Add shared full-detail classic hill scenes for all 32 entries, continuous walls, layered fascias, faceted supports, branch pines, distance markings and projected skier shadows.
- Match directly observed inrun color families for Finland, Switzerland, Czech Republic and Belarus; keep unobserved assignments and original geometry/camera parity explicit.
- Add perspective tracking and homogeneous clipping/perspective interpolation/depth in the software fallback.
- Generate WGSL/GLSL shading from one source, add WebGL2 snow, and make particles deterministic under seeking/reverse playback.
- Add top-left RGBA capture, backend-consistency diagnostics and all-32-hill image regression; keep original-frame acceptance separate.
- Package renderer submodules as real ESM; preserve enhanced presentation, physics, saved scores and existing replay schemas.


## 0.3.0 — 2026-09-23

### Documented DSJ 2.10 behavior

- Add a 15-second green start window, blinking onset at ten seconds remaining,
  evolving pre-start wind, zero-point disqualification and a replayable gate clock.
- Correct small/large/flying distance coefficients to the documented 2.0/1.8/1.2
  in a separate profile; retain old scores and SDK defaults. Hill-class boundaries
  remain inferred, not recovered original constants.
- Add independent timed left/right landing deployment, either-order telemark,
  simultaneous parallel landing and visual stance width. Numerical tolerance and
  stance/style response are explicitly authored.
- Correct the documented first-four team-cup awards to 200/160/120/100.

### Presentation and controls

- Rebuild the sparse 320×200 gameplay HUD with the 13-pixel status band, red wind
  arrow, unsigned wind magnitude, start lamps and right-side judge plaques.
- Reproduce observed main-menu ordering, compact row rhythm and cyan focus;
  provide functioning Sound Setup and a browser-safe save/quit flow.
- Add eight-row/four-page records navigation and confirmed board-scoped reset;
  keep web-specific backup/personal-total controls in an extension panel.
- Add separate touch LEFT/RIGHT pads for original two-button sequencing in both
  orientations; retain accessible single-action keyboard/gamepad/touch shortcuts.
- Fix canceled pointerdown suppressing compatibility mouse events, and clear
  stale button state when starting another jump.

### Compatibility and evidence

- Partition records and ghosts by rules and assistance; old settings/backups and
  cups retain legacy rules. New installs default to the compact documented profile.
- Add replay schema v2 for gate/foot/stance/DSQ state while retaining v1 playback;
  interpolate cyclic wind angles on the shortest arc.
- Synchronize all ten packages at 0.3.0 with new declarations and consumer checks.
- Add 59 Node regressions and 35 browser fidelity checks, plus existing browser
  workflows and required secure-origin WebGPU validation.
- Record primary-source provenance and every still-authored mapping/tolerance in
  `docs/REFERENCE-DSJ210.md`. No original code, bitmap or sound assets are bundled.

## 0.2.0 — 2026-09-23

### Gameplay and UI

- Preserve intended preset/tour order; edit/repeat/reorder up to 64 hill events. Import/export and save 20 named tours.
- Add cup start lists, live results, explicit round transitions, event history, team-athlete detail and escaped CSV output.
- Skip the currently watched CPU simulation exactly once; preserve pause and touch controls.
- Add practice session statistics and SAME WIND deterministic retries.
- Add per-hill top-ten views, up to 64 retained personal bests and aggregate totals, with overall-record ghost playback.
- Add editable replay labels, signed playback speeds, exact sample stepping, phase markers and flight/full-range loops.

### Correctness and SDK

- Mouse button releases/middle clicks no longer generate jumping/landing commands; clear stale capture/gamepad state.
- Reject malformed tour/save/queue inputs and validate backups before writes. Clear unrelated cup state when importing a backup without a cup.
- Reuse render upload arrays and clean up GPU resources during device-loss fallback. Reject nonfinite audio volume and prevent reopening disposed mixers.
- Ship matching ESM declarations for new APIs in `competition`, `replay` and `storage`. All ten packages move to 0.2.0; schemas and physics version remain compatible.
- Add 36 engine regressions, 36 browser workflow checks, secure-origin WebGPU validation and isolated offline package/type verification.

This is an independent recreation and feature expansion, not a claim of exact DSJ2 assets, UI, physics, geometry, networking or binary-format compatibility.
