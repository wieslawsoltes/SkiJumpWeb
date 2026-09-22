# @wieslawsoltes/ski-competition

Serializable two-round individual cups and four-athlete team cups, with qualification, tied ranks and season points.

Version **0.1.0**, ESM JavaScript, TypeScript declarations, MIT. No third-party runtime dependencies beyond the other packages in this workspace. The tarball is publish-ready; this delivery does not imply that it has been published to npm.

## Example

```js
import { Competition, createField } from '@wieslawsoltes/ski-competition';
const cup = new Competition({
  players: createField([{ name: 'PLAYER 1' }], 15),
  hills: ['fin', 'pol', 'slo'], seed: 42
});
console.log(cup.current(), cup.hill);
// Submit the actual JumpSimulation result for the active player.
// cup.submit(result);
const resumed = Competition.restore(cup.serialize());
```

## Installation

From the provided source workspace, run `node tools/link.mjs` to link all packages for local development. To install the packed SDK in another project, install **all ten** provided `.tgz` files in one `npm install` invocation so internal dependencies resolve locally. After publication, ordinary scoped-package installation is supported.

Browser packages require their respective platform APIs only when instantiated. `core`, `hills`, `physics`, `competition`, and `replay` can execute in Node without DOM mocks. `storage` accepts an injected storage object for headless execution. Renderer, input, UI and audio adapters are designed for browsers.

## Compatibility and fidelity

This is an independent implementation, not original DSJ2 code, an official port, or a verified 1:1 replica. Geometry, physics, glyphs and audio are newly authored. Original `.rpl`/save files and Mediamond online services are not supported. No original copyrighted assets are included. See the workspace README and `docs/FIDELITY.md` for the exact implementation boundary.

API signatures are in `index.d.ts`; implementation and lifecycle behavior are in `index.js`.
