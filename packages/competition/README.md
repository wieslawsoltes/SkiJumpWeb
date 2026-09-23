# @wieslawsoltes/ski-competition

Serializable two-round individual cups and four-athlete team cups, with qualification, tied ranks and season points.

Version **0.2.0**, ESM JavaScript, TypeScript declarations, MIT. No third-party runtime dependencies beyond the other packages in this workspace. The tarball is publish-ready; this delivery does not imply that it has been published to npm.

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

## Ordered tours and results (0.2)

```js
import { TourSchedule, Competition, createField, competitionCSV } from '@wieslawsoltes/ski-competition';
const tour = new TourSchedule(['fin', 'eng', 'fin'], 'THREE EVENTS').move(2, 0);
const cup = new Competition({ hills: tour.hills, players: createField([{name:'PLAYER'}], 7) });
console.log(cup.startList(), cup.target(54));
const csv = competitionCSV(cup);
```

Schedules preserve repeats; insert/move/remove validate indices and the 64-event limit. `teamDetails(id)` returns athlete result copies. CSV cells are quoted and formula-prefix escaped.

## 0.3.0 reference profile

See [`docs/REFERENCE-DSJ210.md`](../../docs/REFERENCE-DSJ210.md) in the repository
for documented behavior versus authored reconstruction parameters. New profile
APIs are declared in `index.d.ts`; old low-level defaults and replay v1 remain
compatible. Application defaults are separate from the SDK defaults.
