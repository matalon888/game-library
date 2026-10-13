# Iteration 2 — weather and afterimages

Patterned weather and persistent shed skins extend the independent first candidate following a comparison with Color Snake. Automated checks establish rule behavior, not player enjoyment.

## Game types
Wild preserves the original simulation. Cadence adds recognizable three-drop phrases with an advance forecast. Afterimage uses those same phrases and leaves four-link stationary skins when shedding. Each type has Storm (180 seconds) and Endless durations with separate records. Old records migrate to Wild. Default selection is Cadence to introduce the new direction; Wild remains one click away in the selector.

## Patterned weather
Sweep visits neighboring columns; Echo returns to one column; Fork visits A, B, A. Each phrase uses one color. Forecast marks show ordered landing columns before the first note falls. Difficulty still rises, but phrase identity makes preparation possible. Patterns must remain readable, not a demand to perform a prescribed route.

## Shed skins
Only voluntary shedding creates skins. They preserve the four links' pigment order, catch paint, and dissolve as a whole when any three adjacent links match, clearing nearby rubble and scoring a burst. They persist as obstacles until resolved. New skins are initially ghosted and cannot solidify through an overlapping living body. Invulnerability passes through skins without deleting them. Ordinary bursts clear rubble but not skins, preserving their role as small placed puzzles. Invalid overlapping placement is rejected visibly while the emergency shed still succeeds.

## Work and evidence
The implementation keeps simulation separate from presentation. Wild preserves the original rules while Cadence and Afterimage extend them.

Tests should establish preserved Wild behavior, predictable scheduling, persistent pigment and safe collisions, actual skin-assisted clears, separate/migrated records, tutorial flows and both runtime targets. They cannot establish whether planning is enjoyable. The Wild regression test embeds the original simulation digest.

## Integration finding: self-sheltering skins
A vertical neutral cast could permanently shield its lower links from droplets under the initial body-identical paint rule. Revised skin-only rule: pigment soaks through an existing same-color patch to its next different-colored neighbor, preferring tailward then headward. Two same-color drops on a neutral vertical skin now complete it in either orientation. This gives Echo a useful relationship with skins and avoids a hidden impossibility. Living-body paint stays unchanged. Regression tests use actual falling drops, not direct color injection.
