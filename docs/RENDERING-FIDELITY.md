# Rendering fidelity: 0.4.0

## What is measured, and what is not

The 32 country/K-point roster entries are retained. All 32 now use one classic
scene builder on WebGPU, WebGL2 and software, with full-detail topology, identical
camera parameters, deterministic weather and shared shading equations. Matching
these three backends is **not** matching the original DOS game.

The publisher's four raw 320x200 DSJ 2.10 gallery images were inspected:
https://www.mediamond.fi/dsj2/gallery/ (screenshot1.jpg through screenshot4.jpg).
The unmodified publisher demo and replay inputs were observed on the separate
`research/dsj210-fidelity` branch. Archive identity is documented in
REFERENCE-DSJ210.md. The source of replay inputs was:
https://www.mediamond.fi/dsj2/replays/.

Run 35829931801 attempted 14 public replay selections. Only Finland, Switzerland,
Czech Republic and Belarus produced observable hill scenes. The other selections
remained in the replay list; those are not counted as hill observations. No
registration/access restrictions were modified. Temporary original screenshots,
executables, replay files, bitmaps and sounds are not bundled in this release.

Observed inrun fascia colors: Finland ochre, Switzerland brown, Czech Republic
gray, Belarus teal. Five flat shade samples for each are represented as numerical
colors in HILL_VISUALS. These measurements do not establish the complete original
palette, material assignment, lighting equation or position of every polygon.
The other 28 hills' color assignments remain explicitly unverified. Every hill's
geometry, camera and original pixel equivalence remain unverified.

## Implemented renderer changes

Classic mode replaces generic mountain triangles, red poles, snow-cone trees,
flags, invented towers and spectator rows with broad layered inrun fascias,
faceted concrete supports, continuous landing walls, narrow green distance marks,
a red K line, and individually constructed branch-fan pines. Geometry is sampled
from the exact same HillProfile used by collision and scoring; renderer changes
do not silently change physics, existing scores or replay states.

The classic tracking camera now uses perspective rather than the previous
orthographic projection. Its focal length, offsets, terrain shapes, dimensions,
tree placement, colors on unobserved hills and atmospheric bands are reconstructed
parameters. They are not recovered original constants. Enhanced presentation
remains available and the SDK's default presentation remains enhanced.

The real articulated jumper geometry is projected along a light ray onto the
sampled landing surface using a bounded intersection solve. This replaces the
previous fixed oval shadow. Original light direction and shadow tone remain
reconstructed. The near-zero coplanar offsets are deliberate z-fighting guards.

A single compact shader source produces the WGSL and GLSL scene/sky/snow kernels.
Software implements the same scalar equations. All use a top-left pixel grid,
4x4 ordered dither and a reconstructed six-bit DAC quantization. This is not the
original 256-entry palette. WebGL2 now renders snow as instanced quads; WebGPU
uses compute plus instanced drawing. The 384 snow particles depend on replay time
and wind, not accumulated render delta time, so seeking/reverse playback has no
weather-history drift.

Software now performs homogeneous six-plane frustum clipping, perspective-correct
attribute interpolation, top-left edge coverage and per-fragment depth/fog. It
consumes the same full mesh as the hardware paths rather than a hidden reduced
scene. This is a correctness fallback, not a promise of 60 fps on mobile CPUs.

`captureFrame()` reads top-left RGBA8 on every backend, handles GPU row pitch and
BGRA swizzling, and owns its returned copy. Call immediately after render in the
same JavaScript task. GPU command submission and readback remain explicit;
readback is only used by diagnostics/tests, never in the normal frame loop.
`frameMilliseconds` measures CPU scene preparation/command submission, not GPU
execution time. Device/context-loss recovery retains the selected scene mode.

## Reproduction and acceptance

`npm test` includes every hill's deterministic finite topology, section bounds,
record-guide isolation, shadow/surface contact, shader generation, software fill,
depth and scratch reuse. The packaged consumer test imports the actual .tgz files,
including the renderer's new internal ESM modules and their declarations.

`python tests/browser_rendering.py` requires real WebGPU and WebGL2 contexts,
plus software. Each hill uses twelve identical fixtures on all three paths:
gate, board, flight, landing; snow/dusk/night flight; portrait and wide snow
surfaces; close, wide and chase cameras. Snow frames are repeated after seeking
to another timestamp and must be byte-identical on the same backend. Missing
simulation phases fail rather than substituting the gate. The report records all
384 comparisons and numeric image errors.
WebGPU/WebGL2 budgets: mean absolute RGB <= 0.15 byte and fraction of pixels with
any channel error > 8 <= 0.001. GPU/software budgets: mean <= 1.5 bytes and fraction
<= 0.01. These are stated regression budgets, not claims of bit-identical output.
The --software-offline option is narrower and never reports cross-backend success.
PNG captures and an all-hill contact sheet are generated from actual frames.

Original-game acceptance is separate: `tools/compare-reference.py` accepts an
external manifest with matching original/current native frames, known camera/state
and source provenance. It does not silently align, crop, resize or mask images.
With --require-all-hills it rejects missing or different frames across four phases
of all 32 hills (128 reference pairs). An empty manifest fails; self-consistent
backend tests never turn missing original references into a parity pass.

Example (reference images remain local and are not shipped in npm):

```json
{"format":"ski-reference-frames","version":1,"frames":[
  {"hill":"fin","phase":"gate","reference":"owned-reference/fin-gate.png",
   "actual":"rendered/fin-gate.png","poseVerified":true,
   "source":"DSJ 2.10, personally captured licensed copy; camera and state matched"}
]}
```

The original reference set is not complete. No all-level original pixel-parity
claim is made by this release. Hardware/driver differences and physical mobile
performance also require separate device validation.

## Finalization corrections

Inrun shoulders, stepped fascia joins, underside and end cross-sections now form
closed surfaces. Oblique/close cameras no longer look through missing strips.
Landing-wall paint is separate from inrun fascia colors, following the brighter
wall families visible in the public gameplay gallery. The family assignments and
RGB values are reconstructions, not newly verified original hill palettes.

Published render evidence is tied to the SHA-256 of the just-built app bundle.
The permanent Pages workflow reruns the entire image matrix and refuses stale,
software-only, partial, duplicate-hill or mismatched-bundle evidence. This is
strict internal-renderer regression, still not original-game parity certification.
