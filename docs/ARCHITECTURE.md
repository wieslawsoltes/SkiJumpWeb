# Architecture and algorithms

## Dependency direction

`core → hills → physics → competition/replay`, with `storage` consuming replay and hill identifiers. Renderer and input/audio/UI adapters are separately instantiable. The application composes all ten packages; no package imports the application. Core simulation and competition execute without a DOM.

## Coordinates and terrain

Metres are the world unit. X points down the hill, Y up and Z laterally. The takeoff lip is (0,0,0). An authored straight inrun joins a quadratic transition with continuous derivative. The landing profile is parameterized by slope arc length. A piecewise smooth angular function is integrated at 0.35 m samples; interpolation maps distance to world position, while binary search maps X back to slope height and measured distance. K-point stripes therefore use measured slope distance rather than horizontal distance.

The public roster supplies only country/K-point labels. Angles, lengths and integration functions are authored approximations.

## Simulation

A phase state machine controls gate → inrun → flight → runout → finished. The application advances it at 1/120 s with a bounded catch-up clock; paused/hidden tabs do not accumulate unbounded missed simulation time.

Inrun acceleration combines the tangent component of gravity, sliding friction and quadratic resistance. Takeoff quality is a Gaussian of command position relative to the lip; it scales the vertical impulse. Flight computes relative air velocity, a damped body-pitch response, angle-of-attack efficiency, perpendicular lift and drag. Human lean input and optional practice assistance affect body attitude. Landing deployment changes pitch, lift and drag before contact.

Ground contact uses a swept segment and 14-step bisection, reducing whole-frame quantization of distance. Contact-normal speed, preparation lead time, imbalance and over-distance affect whether a requested telemark/parallel landing succeeds. Five deterministic half-point judge marks are generated, extremes discarded, and distance/style totals calculated. These rules are implemented game mechanics, not verified recovered original constants.

A seeded, absolute-time wind function is independent of how often UI code samples it. Cup competitors on a given hill/round use the same seed. CPU competitors issue commands to the same simulation rather than receiving randomly generated result distances.

## Competition and persistence

Individual cups maintain a first-round queue, a top-30-with-ties final and reversed score order. Team events build four slot groups and advance the best eight teams with ties. Submitting a result is a turn transition; completing a second round records the event and updates season points exactly once. A serialized cup stores the queue, turn, scores, roster and event position.

Local storage is wrapped with guarded reads and quota-safe writes plus an in-memory copy. Records and ghosts are keyed by hill and assistance status. Save import is size-limited and validates record keys/ranges; replay import also validates frame count, fields, time monotonicity and numeric ranges.

## Replay

A replay captures twelve numeric fields at up to 60 Hz, not DOM frames or compressed video. Playback interpolates continuous fields and holds discrete phase/landing fields. Binary-search seeking is independent of replay length. Final-frame recording compares quantized timestamps to avoid duplicate final frames. The `.sjr.json` format is deliberately versioned and does not claim original `.rpl` compatibility.

## Rendering and audio

Static geometry is one interleaved position/RGB vertex buffer. A small per-frame buffer contains the skier, projected shadow and optional ghost. Cameras use orthographic world-to-clip transforms with backend-specific depth conventions. Shaders apply flat color, distance fog and palette quantization. WebGPU snow uses 384 storage-buffer particles, 64-thread workgroups and a render pass. WebGL2 uses the same meshes; software fallback reduces scene detail and depth-sorts projected triangles.

Web Audio combines a master gain/compressor, two filtered noise loops and bounded oscillator/noise effect voices. Noise is generated locally. The first user gesture unlocks the audio context; visibility changes suspend it. No external audio or font data is needed.

## Build

The build tool resolves this workspace's controlled named ESM imports into a tiny module registry, then emits normal static files and a fully inline HTML. It does not use eval or fetch runtime modules. Npm tarballs retain original ESM files and declarations. There are no build-time package downloads.
