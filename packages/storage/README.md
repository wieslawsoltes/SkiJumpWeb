# @wieslawsoltes/ski-storage

Versioned local settings, separate assisted records, ghosts, replay library and cup saves with quota-safe memory fallback.

Version **0.2.0**, ESM JavaScript, TypeScript declarations, MIT. No third-party runtime dependencies beyond the other packages in this workspace. The tarball is publish-ready; this delivery does not imply that it has been published to npm.

## Example

```js
import { GameStore } from '@wieslawsoltes/ski-storage';
const store = new GameStore();
store.saveSettings({ volume: 0.5, resolution: 'classic' });
console.log(store.settings(), store.records(), store.persistent);
const backup = store.exportData();
// store.importData(backup);
```

## Installation

From the provided source workspace, run `node tools/link.mjs` to link all packages for local development. To install the packed SDK in another project, install **all ten** provided `.tgz` files in one `npm install` invocation so internal dependencies resolve locally. After publication, ordinary scoped-package installation is supported.

Browser packages require their respective platform APIs only when instantiated. `core`, `hills`, `physics`, `competition`, and `replay` can execute in Node without DOM mocks. `storage` accepts an injected storage object for headless execution. Renderer, input, UI and audio adapters are designed for browsers.

## Compatibility and fidelity

This is an independent implementation, not original DSJ2 code, an official port, or a verified 1:1 replica. Geometry, physics, glyphs and audio are newly authored. Original `.rpl`/save files and Mediamond online services are not supported. No original copyrighted assets are included. See the workspace README and `docs/FIDELITY.md` for the exact implementation boundary.

API signatures are in `index.d.ts`; implementation and lifecycle behavior are in `index.js`.

## Local records and tours (0.2)

`hillLeaderboard(hillId, assisted, limit)` defaults to ten visible bests; up to 64 player-name bests are retained separately per hill and assisted mode. `personalBests(name)` returns that player's retained hill results. `saveTour({name,hills})`, `tours()` and `deleteTour(name)` manage up to 20 named ordered/repeated tours. `renameReplay(id,label)` changes the library display name, not recording identity. Backup import/export includes boards/tours and validates saved cups before writing. Local records are not server-verified rankings.
