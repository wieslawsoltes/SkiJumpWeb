# Fidelity and implementation boundary

The request targets a full-fidelity DSJ2 recreation. **This release does not establish that level of parity.** It supplies an independently implemented, playable browser game and reusable SDK, with explicit boundaries rather than a claim of exact equivalence.

| Area | Implemented | Not established / not included |
|---|---|---|
| Hill roster | All 32 publisher-listed country/K-point entries, in listed order | Original per-hill meshes, exact curvature, dimensions and scenery placement |
| Visuals | Pixelated 3D, yellow bitmap labels, gray menus, wood ramps, forest/snow/mountains, low-poly skier | Per-pixel match, original fonts, original backgrounds/textures or identical animations |
| Input | Classic button chords plus keyboard/touch/tilt/gamepad adapters | Exact original sensitivity transfer function or device-specific parity |
| Physics | Deterministic inrun, timing-dependent impulse, lift/drag, body angle, wind, landing preparation and collisions | Recovered original constants, bit-identical trajectories, exact original exploits/records |
| Rules | Five judges, dropped extremes, distance/style totals, two-round cups and team rounds | Proof that every scoring threshold, tie detail and cup rule matches the DOS executable |
| Modes | Practice, World Cup, Team Cup, custom tours and up to 16 hot-seat humans | Network multiplayer, original service connectivity |
| Replays | Own validated numeric format, seeking, speed and cameras | `.rpl` import/export compatibility |
| Persistence | Local records, separate assisted records, players, saved cups and JSON backup | Original save format compatibility or server-verified world records |
| Sound | Synthesized wind/ski noise and action/result effects | Original recordings or perceptually identical audio |
| Platforms | Responsive layout and successful Chromium touch emulation | Physical-device certification or universal browser/GPU support |

## Reference evidence

Mediamond's overview describes 32 hills, practice/world/team modes, saved replays, records and up to 16 local players. Its gallery identifies the original 320×200 presentation. Its public hill-record selector supplies the roster used here.

- https://www.mediamond.fi/dsj2/
- https://www.mediamond.fi/dsj2/gallery/
- https://www.mediamond.fi/dsj2/hillrecords/?act=Show&group=0&list=32

No executable, DOS data, sound samples or original art are bundled. The public label/K-point list is not evidence that the newly authored slopes duplicate original geometry.

## Next work needed for genuine parity

Capture a reproducible reference corpus from an authorized original installation: every menu, every hill from multiple cameras, timed control traces, trajectories, judge outcomes and replay/save specimens. Fit measured profiles and input/physics constants against held-out trajectories rather than only visual impressions. Add screenshot/image-difference and control-replay regression tests with measurable acceptance tolerances. Separately validate browser WebGPU on physical adapters and touch/rotation/motion on real mobile hardware. Existing package boundaries allow those changes without rewriting the application shell.
