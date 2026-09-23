# @wieslawsoltes/ski-replay

60 Hz compact numeric replay capture; validated imports, interpolation, seeking and variable-speed playback.

Version **0.2.0**, ESM JavaScript, TypeScript declarations, MIT. No third-party runtime dependencies beyond the other packages in this workspace. The tarball is publish-ready; this delivery does not imply that it has been published to npm.

## Example

```js
import { ReplayRecorder, ReplayPlayer } from '@wieslawsoltes/ski-replay';
import { JumpSimulation, CPUController } from '@wieslawsoltes/ski-physics';
const sim = new JumpSimulation('pol', { seed: 1 });
const recorder = new ReplayRecorder(sim, { name: 'DEMO' });
const cpu = new CPUController(1, 0.9);
while (sim.state.phase !== 'finished') { cpu.update(sim); sim.step(); recorder.capture(); }
const playback = new ReplayPlayer(recorder.finish());
console.log(playback.seek(5));
```

## Installation

From the provided source workspace, run `node tools/link.mjs` to link all packages for local development. To install the packed SDK in another project, install **all ten** provided `.tgz` files in one `npm install` invocation so internal dependencies resolve locally. After publication, ordinary scoped-package installation is supported.

Browser packages require their respective platform APIs only when instantiated. `core`, `hills`, `physics`, `competition`, and `replay` can execute in Node without DOM mocks. `storage` accepts an injected storage object for headless execution. Renderer, input, UI and audio adapters are designed for browsers.

## Compatibility and fidelity

This is an independent implementation, not original DSJ2 code, an official port, or a verified 1:1 replica. Geometry, physics, glyphs and audio are newly authored. Original `.rpl`/save files and Mediamond online services are not supported. No original copyrighted assets are included. See the workspace README and `docs/FIDELITY.md` for the exact implementation boundary.

API signatures are in `index.d.ts`; implementation and lifecycle behavior are in `index.js`.

## Exact sample navigation (0.2)

`stepFrame(-1|1)` pauses on a neighboring actual recorded timestamp; it does not approximate a sample using 1/60 seconds. `jumpTo('start'|'takeoff'|'landing'|'end')` seeks phase markers. The `takeoff` marker is the first flight-phase sample, not the input button timestamp. Set negative `speed` for reverse playback, or call `setLoop(start,end)` to define a bounded loop. `.loop=false` pauses at recording endpoints.

## 0.3.0 reference profile

See [`docs/REFERENCE-DSJ210.md`](../../docs/REFERENCE-DSJ210.md) in the repository
for documented behavior versus authored reconstruction parameters. New profile
APIs are declared in `index.d.ts`; old low-level defaults and replay v1 remain
compatible. Application defaults are separate from the SDK defaults.
