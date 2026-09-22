# @wieslawsoltes/ski-physics

Deterministic 120 Hz inrun, takeoff, aerodynamic flight, swept landing collision, judges and CPU controller.

Version **0.1.0**, ESM JavaScript, TypeScript declarations, MIT. No third-party runtime dependencies beyond the other packages in this workspace. The tarball is publish-ready; this delivery does not imply that it has been published to npm.

## Example

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

## Installation

From the provided source workspace, run `node tools/link.mjs` to link all packages for local development. To install the packed SDK in another project, install **all ten** provided `.tgz` files in one `npm install` invocation so internal dependencies resolve locally. After publication, ordinary scoped-package installation is supported.

Browser packages require their respective platform APIs only when instantiated. `core`, `hills`, `physics`, `competition`, and `replay` can execute in Node without DOM mocks. `storage` accepts an injected storage object for headless execution. Renderer, input, UI and audio adapters are designed for browsers.

## Compatibility and fidelity

This is an independent implementation, not original DSJ2 code, an official port, or a verified 1:1 replica. Geometry, physics, glyphs and audio are newly authored. Original `.rpl`/save files and Mediamond online services are not supported. No original copyrighted assets are included. See the workspace README and `docs/FIDELITY.md` for the exact implementation boundary.

API signatures are in `index.d.ts`; implementation and lifecycle behavior are in `index.js`.
