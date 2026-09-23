# Fidelity and implementation boundary

The request targets a full-fidelity DSJ2 recreation. **This release does not establish that level of parity.** It supplies an independently implemented, playable browser game and reusable SDK, with explicit boundaries rather than a claim of exact equivalence.

| Area | Implemented | Not established / not included |
|---|---|---|
| Hill roster | All 32 publisher-listed country/K-point entries, in listed order | Original per-hill meshes, exact curvature, dimensions and scenery placement |
| Visuals | Measured compact HUD positions, observed main-menu ordering and eight-row record pages; authored 3D, glyphs and scenery | Per-pixel match, original fonts, original backgrounds/textures or identical animations |
| Input | Left-button start, rising two-button takeoff, independent timed landing feet; separate virtual touch buttons and accessible shortcuts | Exact original sensitivity transfer function or device-specific parity |
| Physics | Deterministic inrun, timing-dependent impulse, lift/drag, body angle, wind, landing preparation and collisions | Recovered original constants, bit-identical trajectories, exact original exploits/records |
| Rules | Documented 15/10-second start behavior, distance coefficients, first-four team awards; legacy/new profile separation | Proof that every scoring threshold, tie detail and cup rule matches the DOS executable |
| Modes | Practice/session statistics, World Cup, Team Cup, editable repeated-venue tours, start lists/history and up to 16 hot-seat humans | Network multiplayer, original service connectivity |
| Replays | Own validated numeric format, reverse playback, exact sample stepping, phase markers, bounded loops and cameras | `.rpl` import/export compatibility |
| Persistence | Local top-ten/personal records, separate assisted records, players, saved cups/tours, replay labels and JSON backup | Original save format compatibility or server-verified world records |
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

## 0.2.0 evidence classification

The publisher overview confirms the original's high-level hill count, practice/world/team modes, replays, web records and 16-player support. It does not specify every original UI command, tie-break, replay speed or editable-tour feature. The new schedule editor, history views, CSV output, bounded replay loops and session statistics are independently authored implementations/extensions; they are **not asserted to be documented DSJ2 features or pixel-identical replicas**. This version does not change hill profiles or physics constants, and the numeric replay/save schemas remain version 1.

Validation checks correctness of our implementation. The dedicated WebGPU test records whether an actual WebGPU adapter executed render and compute work; a SwiftShader adapter is not a hardware-performance or mobile-compatibility certification. No proprietary original assets or services are bundled or connected.

## 0.3.0 evidence classification

See [DSJ 2.10 reference register](REFERENCE-DSJ210.md) for publisher archive SHA-256,
manual line references, measured HUD/menu layouts, and all authored thresholds.
New rules have independent scores/ghosts and serialized cup state. Replay v2
retains start/stance state without dropping v1 compatibility. This release does
not establish original hill/aerodynamic/bitmap/audio/binary-format equivalence.


## 0.4.0 renderer scope

See [RENDERING-FIDELITY.md](RENDERING-FIDELITY.md). A shared renderer and all-32-hill backend tests do not establish original all-level visual identity. Four inrun color families were observed; original geometry/cameras and the other 28 color assignments remain unverified.
