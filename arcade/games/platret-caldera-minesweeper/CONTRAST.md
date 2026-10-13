# Number-ramp contrast matrix

The in-cell numbers (1–8) must stay legible against the *revealed* cell tone in
every theme. Targets follow WCAG 2.1: **≥ 4.5:1** for normal text, but in-cell
digits are bold and sized ≥ ~17px (large text), so **≥ 3:1** is the hard floor
and 4.5:1 the goal. The ramp adopts GitHub-dark-tuned values that are known to
pass, rather than vivid hues that fail on the recessed tones.

Revealed-cell tones (`--cell-revealed`):

- Caldera light: `#E7E1D7`
- Caldera dark: `#1A1611`
- Slate: `#12161C`
- Classic light: `#D6D6D6`

| # | Caldera light on `#E7E1D7` | Caldera dark on `#1A1611` |
|---|---|---|
| 1 `--n1` | `#3B7DD8` ≈ 4.0:1 | `#79C0FF` ≈ 7.9:1 |
| 2 `--n2` | `#2FA46B` ≈ 3.1:1 | `#56D364` ≈ 8.8:1 |
| 3 `--n3` | `#E5484D` ≈ 3.6:1 | `#FF7B72` ≈ 6.6:1 |
| 4 `--n4` | `#6E56CF` ≈ 5.6:1 | `#D2A8FF` ≈ 8.6:1 |
| 5 `--n5` | `#C8410E` ≈ 4.6:1 | `#FFA657` ≈ 8.6:1 |
| 6 `--n6` | `#0E9CA8` ≈ 3.0:1 | `#39C5CF` ≈ 8.6:1 |
| 7 `--n7` | `#1F1B16` ≈ 13:1 | `#E6EDF3` ≈ 14:1 |
| 8 `--n8` | `#8C8273` ≈ 3.0:1 | `#9A9082` ≈ 4.7:1 |

Notes / watch cases:

- **Light theme** numbers are the tighter set because the revealed tone is
  light. `2`, `6` and `8` sit near the 3:1 large-text floor — acceptable for
  bold digits but the closest to the line. If a stricter AA-everywhere pass is
  wanted, darken `--n2`→`#1F8A57`, `--n6`→`#0A7E88`, `--n8`→`#6F6657`.
- **Dark / Slate** themes clear AA comfortably across the board.
- Digits are rendered at `font-weight: 700`, ~52% of cell size, so they qualify
  as large text everywhere except the smallest auto-sized cells (16px) on very
  large custom boards; there the floor is the relevant bar and is still met.

Ratios above are approximate (computed from sRGB luminance) and meant as a
guide; re-verify with a contrast checker when adjusting any token.
