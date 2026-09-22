# @wieslawsoltes/ski-renderer

Batched flat-shaded 3D scene, skier, terrain and WebGPU snow compute, with WebGL2 and software fallback.

Version **0.1.0**, ESM JavaScript, TypeScript declarations, MIT. No third-party runtime dependencies beyond the other packages in this workspace. The tarball is publish-ready; this delivery does not imply that it has been published to npm.

## Example

```js
import { SkiRenderer } from '@wieslawsoltes/ski-renderer';
const host = document.querySelector('#scene');
const renderer = new SkiRenderer(host, { resolution: 'classic' });
await renderer.ready;
renderer.setHill('fin');
renderer.render({ x: 10, y: 2, phase: 'flight', pitch: -0.1 }, { suit: '#225be7' });
console.log(renderer.diagnostics());
// Call renderer.dispose() when the view is removed.
```

## Installation

From the provided source workspace, run `node tools/link.mjs` to link all packages for local development. To install the packed SDK in another project, install **all ten** provided `.tgz` files in one `npm install` invocation so internal dependencies resolve locally. After publication, ordinary scoped-package installation is supported.

Browser packages require their respective platform APIs only when instantiated. `core`, `hills`, `physics`, `competition`, and `replay` can execute in Node without DOM mocks. `storage` accepts an injected storage object for headless execution. Renderer, input, UI and audio adapters are designed for browsers.

## Compatibility and fidelity

This is an independent implementation, not original DSJ2 code, an official port, or a verified 1:1 replica. Geometry, physics, glyphs and audio are newly authored. Original `.rpl`/save files and Mediamond online services are not supported. No original copyrighted assets are included. See the workspace README and `docs/FIDELITY.md` for the exact implementation boundary.

API signatures are in `index.d.ts`; implementation and lifecycle behavior are in `index.js`.
