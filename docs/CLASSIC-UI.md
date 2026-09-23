# Classic UI reconstruction — 0.5.0

## Implemented

Every menu family now runs inside a fixed 320×200 logical surface. Integer
letterboxing is the default in either orientation; a browser-only FIT control
opts into aspect-preserving fractional enlargement. Smaller-than-native windows
use fractional downscaling rather than cropping. Mobile navigation has independent
44-pixel UP/DOWN/OK/BACK buttons outside the classic picture. Game input and
in-flight touch pads are unchanged.

The previous reflowed 640×400/360px menu layout remains available as Enhanced.
Classic uses authored bold bitmap ink, a static procedural twin-jump backdrop,
a framed header, fixed title and separator placement, cyan keyboard selection,
compact forms, skinned selects, checks, sliders, result tables and confirmations.
Main/records/replay lists preserve the observed sparse arrangement. Browser-only
player, options, help and board/export tools are outside the original-style frame.

The classic replay browser now opens a metadata screen with hill/player/distance/
date before playback. It retains import/export and renaming; deletion requires
confirmation. Options are divided into Display, Controls and Gameplay tabs without
removing settings. Cup start lists, history, team details, results, records,
practice, setup, player editing, tour editing, sound, help and errors share one skin.
Long forms and tables scroll inside the native surface. Long values clip visually
but remain available to native controls and assistive technology.

Keyboard navigation is shared with the mobile host: Up/Down wrap, Left/Right move
within a grid row, Home/End choose endpoints, Page Up/Down move eight controls,
type-ahead searches the current menu, Enter/Space activates focus, and Escape
closes a select popup before navigating back. Returning to a screen restores its
control key. Hiding a menu moves focus to the arena so it cannot intercept jumping.

Menus stop submitting the hidden 3D scene. Text rasterization is event-driven,
not a per-frame repaint. Bitmap ink uses Canvas2D rectangles; there are no embedded
or downloaded font files. Inputs remain real DOM elements for editing, selection,
clipboard and composition; the visual value/selection/caret is overlaid in bitmap
ink. Semantic labels are retained exactly once. The display alphabet normalizes
accents and unsupported glyphs; the native input still retains the original text
and the pre-existing player normalization rules still apply when saving.

## What the evidence establishes

Reference sources are the previously captured unmodified DSJ 2.10 demo screens
on `research/dsj210-fidelity`, plus the publisher gallery and manual listed in
REFERENCE-DSJ210.md. Available main menu, records, replay-list and replay-information
captures inform the layout. No original bitmap font, photograph, logo bitmap,
executable or audio is redistributed. The backdrop, logo construction and glyph
outlines in this release are independently authored. Other screen layouts extend
the same skin; their original pixel coordinates have not all been observed.

**This is not pixel-identical original UI.** Matching a fixed coordinate system,
observed menu sequence and self-consistent screenshots does not establish identity
with the original font, photo or every original dialog. Registration and DOS
hardware configuration are deliberately not simulated. Sound Setup controls actual
Web Audio. Browser/extension screens are identified as such instead of inventing
original DSJ2 functionality.

`tests/browser_ui.py` checks geometry, text uniqueness, selection, form editing,
settings tabs, replay flows, real competition rows, lifecycle restoration and
portrait/landscape interaction. It writes owned screenshots and a contact sheet
under `artifacts/ui/`. The report includes the actual JS bundle SHA-256. These are
implementation regression fixtures, not original-game golden images. The permanent
Pages pipeline rejects absent, failed or stale UI evidence.

For separately provided original captures, use:

```sh
python tools/compare-ui-reference.py owned-ui.json --require-all
```

```json
{"format":"ski-ui-reference","version":1,"frames":[
  {"screen":"main","reference":"owned/main.png","actual":"current/main.png",
   "stateVerified":true,"source":"Original DSJ 2.10; language, focus and data matched"}
]}
```

The comparator requires native 320×200 images, provenance and matched state. It
never aligns, crops, scales or masks differences. Empty, duplicate or unprovenanced
manifests fail. With `--require-all`, missing screen references fail too. The current
project has not passed this original-image acceptance gate.

## Reusable npm API

`@wieslawsoltes/ski-ui` contains the complete skin and bitmap implementation. It
does not import the application. Scoped styles bind to the supplied root, not a
hard-coded application ID. Optional structural parts use `data-classic-part` values
`header`, `logo`, `note`, `heading`, `content`, and `diagnostics`.

```js
import { ClassicMenuSkin, drawClassicLogo } from '@wieslawsoltes/ski-ui';

// parent is a positioned host, root contains ordinary semantic DOM controls.
const skin = new ClassicMenuSkin(root, {
  back: () => navigateBack(),
  feedback: () => audio.play('menu')
});
skin.setActive(true);
skin.layout(parent.clientWidth, parent.clientHeight);
drawClassicLogo(root.querySelector('[data-classic-part="logo"]'));
skin.enter('main');
// Before replacing a view: skin.remember(); replace DOM; skin.enter(nextView).
// On host resize: skin.layout(width, height).
// On teardown: skin.dispose(); restores text, input nodes, inline scale variables.
```

No physical mobile hardware or screen-reader certification is claimed by browser
emulation. Enhanced rendering, physics, scores and the two existing replay schemas
remain unchanged by this UI release.
