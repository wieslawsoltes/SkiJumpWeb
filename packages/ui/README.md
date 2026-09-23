# @wieslawsoltes/ski-ui

Hand-authored bitmap lettering, labels, in-game HUD and lightweight DOM/download helpers.

Version **0.2.0**, ESM JavaScript, TypeScript declarations, MIT. No third-party runtime dependencies beyond the other packages in this workspace. The tarball is publish-ready; this delivery does not imply that it has been published to npm.

## Example

```js
import { pixelCanvas, drawText } from '@wieslawsoltes/ski-ui';
document.body.append(pixelCanvas('WORLD CUP'));
const canvas = document.createElement('canvas');
drawText(canvas.getContext('2d'), 'FINLAND K105', 8, 8);
document.body.append(canvas);
```

## Installation

From the provided source workspace, run `node tools/link.mjs` to link all packages for local development. To install the packed SDK in another project, install **all ten** provided `.tgz` files in one `npm install` invocation so internal dependencies resolve locally. After publication, ordinary scoped-package installation is supported.

Browser packages require their respective platform APIs only when instantiated. `core`, `hills`, `physics`, `competition`, and `replay` can execute in Node without DOM mocks. `storage` accepts an injected storage object for headless execution. Renderer, input, UI and audio adapters are designed for browsers.

## Compatibility and fidelity

This is an independent implementation, not original DSJ2 code, an official port, or a verified 1:1 replica. Geometry, physics, glyphs and audio are newly authored. Original `.rpl`/save files and Mediamond online services are not supported. No original copyrighted assets are included. See the workspace README and `docs/FIDELITY.md` for the exact implementation boundary.

API signatures are in `index.d.ts`; implementation and lifecycle behavior are in `index.js`.

## 0.3.0 reference profile

See [`docs/REFERENCE-DSJ210.md`](../../docs/REFERENCE-DSJ210.md) in the repository
for documented behavior versus authored reconstruction parameters. New profile
APIs are declared in `index.d.ts`; old low-level defaults and replay v1 remain
compatible. Application defaults are separate from the SDK defaults.

## Classic menu skin (0.5.0)

`ClassicMenuSkin` styles any supplied DOM root using scoped styles, authored bitmap ink, semantic controls and fixed 320×200 coordinates. `classicViewport`, `navigationIndex`, `drawMenuBackdrop`, `drawClassicLogo` and `CLASSIC_MENU_LAYOUT` are independently reusable. Call `dispose()` on teardown. See the repository `docs/CLASSIC-UI.md` for a complete example and fidelity boundaries. No font files or original game assets are bundled.
