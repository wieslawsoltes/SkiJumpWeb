# Changelog

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
