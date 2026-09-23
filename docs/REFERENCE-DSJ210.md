# DSJ 2.10 behavioral reference — 0.3.0

This document distinguishes publisher-documented behavior, observed layout, and
our reconstruction parameters. Passing our tests does not prove identical DOS
trajectories, original binary compatibility, or pixel identity.

## Source provenance

Publisher: Mediamond, Deluxe Ski Jump 2.10. Public download page:
https://www.mediamond.fi/dsj2/downloads/

Observed archive: https://www.mediamond.fi/dsj2/downloads/dsj210.zip
SHA-256: `c58c4484c911e1a91b1bc62710a6a1ddc911defbe77a06c72ebec51f3c78c431`.
English instructions: `READ-ENG.TXT`, line numbers below refer to that archive.
The manual was inspected on a separate research branch. The unmodified demo was
also run in DOSBox to observe menu layouts; screenshots remained temporary
research artifacts. No executable, game data, bitmap, original glyphs, recorded
sound or extracted code was added to the application or npm packages.

Gallery: https://www.mediamond.fi/dsj2/gallery/ explicitly identifies its images
as raw 320×200 screenshots from version 2.10. Reference screenshot URLs:
`https://www.mediamond.fi/dsj2/gallery/screenshot1.jpg` through `screenshot4.jpg`.

## Implemented documented behavior

| Source | Reference fact, paraphrased | Implementation / regression |
|---|---|---|
| English manual 100–102 | Green start authorization lasts 15 seconds; blinking begins with ten seconds remaining; a missed deadline disqualifies the jump | `JumpSimulation` gate state, 1800-step deadline, single terminal zero-score result, replayable gate clock |
| 109–114 | Left mouse starts the inrun; both buttons initiate takeoff; buttons are released after takeoff | Rising-edge input handling and two-button chord, actual Chromium mouse and multi-contact touch tests |
| 116–129 | Vertical mouse movement controls body angle; simultaneous landing presses differ from sequential presses; either sequential order works; longer delay widens telemark | Independent left/right deployment timestamps; parallel/telemark classification; width transmitted into the skier mesh and replay |
| 70–77 | Three distance coefficients: small 2.0, large 1.8, flying 1.2 points/metre; K-point bases 60 or 120 for flying; five 0–20 judges with extremes discarded | Profile-aware `pointsPerMetre` and `scoreJump`; explicit `hillClass` override; legacy coefficients preserved |
| 90–95 | Four athletes form a team; the first four team cup positions receive 200, 160, 120, 100 | Separate `TEAM_CUP_POINTS` schedule, serialized competition rules, UI explanation |

## Observed UI and rebuilt layout

The unmodified English demo's main menu places World Cup, Team Cup, Practice,
Hill Records, Replay Studio and Sound Setup in that order, followed by its demo
registration entry and Quit. Our compact menu uses those functional entries,
omits the irrelevant registration flow, and places Players, Options and Help
in a separately labelled browser-extension strip. Quit saves state and displays
a tab-close instruction; a web page is not assumed to be able to close its tab.
Sound Setup configures the actual Web Audio mixer, not simulated ISA ports or DMA.

The observed records screen displays eight country/K-point rows and a page
indicator out of four, with Next Page, Reset Hill Records and Back. The compact
records view follows that pagination, cyan labels and navigation. Its reset
confirmation clears only the current rules/assistance partition, including its
record ghosts, and preserves replay-library entries and other boards. Browser
backup/personal-total controls remain in a collapsible extension panel.

Gameplay HUD coordinates use a 320×200 reference space. The bottom status strip
occupies y=187..199 (13 pixels); the wind plaque is at (287,3), size 29×27; judge
plaques start at (291,58), size 25×11 and step 12 vertically. Start lamps sit just
left of the wind box. The wind arrow is red and the speed magnitude unsigned.
The compact view omits the enhanced speed, guide and top-left metadata overlays.
Higher resolutions scale this layout; portrait rearranges available space.
The glyphs, colors, procedural background and 3D scene are independently authored,
so matching layout measurements is not a claim of identical screenshots.

## Explicitly reconstructed / still unverified

- The manual does not identify exact K-point boundaries for its three hill
  classes. We currently infer small below K110, large below K165, flying from
  K165. The three coefficients are documented; these boundaries are not verified.
- A 50 ms simultaneous-button tolerance, stance width = 2.5 × interval in seconds
  (bounded to 1.5), width-dependent style deductions and an over-wide fall threshold
  are authored parameters. The original interval-to-stance transfer function,
  button polling window, impact thresholds and judge deductions are not recovered.
- Start-light blinking begins at the documented threshold, but its two-flash-per-
  second cadence is our display choice. Pause freezes simulation time; background
  tabs pause for usability rather than consuming wall-clock start authorization.
- Wind waiting uses our deterministic field. The arrow's small vertical component
  is a visualization approximation, not a recovered two-dimensional force model.
- Lift/drag constants, takeoff response, hill geometry, camera calibration,
  original distance quantization, negative-score handling, tie details and the
  team points beyond the documented first four positions remain unverified.
- Z/X, gamepad buttons and the existing large touch controls are accessibility
  shortcuts which complete a landing in one action; separate touch LEFT/RIGHT
  pads reproduce the two-input sequence.
- Our replay v2 is not the original `.rpl` format. It extends our v1 with gate,
  per-foot, stance, wind-angle and disqualification state. Legacy v1 stays readable.

## Compatibility policy

New game installations default to `rules: 'dsj210'`, `presentation: 'classic'`,
two-button controls and disabled guide/ghost overlays. Existing settings and
saves without a rules field retain `legacy` behavior and enhanced presentation.
The low-level simulation/competition SDK default also remains `legacy`, so
existing SDK callers do not silently acquire a start deadline or new scores.
Use the DSJ 2.10 Profile button in Options to opt into all new defaults.

Competitions serialize the selected rules. Record keys separate original-profile,
legacy and assisted categories. Old bests are not re-labelled or overwritten by
new-rule jumps. Disqualifications produce zero scores, never hill records or
successful-landing statistics. Explicit cup result rule mismatches are rejected.

## Reproducible checks

`tests/fidelity.test.mjs` covers the 15/10-second thresholds, both foot orders,
interval classification, all 32 hills under the new profile, team points,
record partition/reset behavior, legacy settings/saves and both replay versions.
`tests/browser_fidelity.py` drives real browser mouse/touch events, checks main
menu order, records pagination, sound controls, timeout/results, HUD positions,
virtual pads and rotation. Tests assert our stated contracts, not original image
or trajectory equality. No original download is needed to build or run them.
