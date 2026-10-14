# Moonbloom 2D asset manifest

All assets in this pack were generated specifically for **Moonbloom Endless** with the built-in OpenAI ImageGen tool on 2026-08-12. No production asset from the gameplay reference was copied.

## Runtime assets

| Asset | Purpose |
| --- | --- |
| `generated/moonbloom-garden-bg.png` | Portrait gameplay environment |
| `generated/lyra-launcher.png` | Transparent launcher mascot, Lyra |
| `generated/lyra-recoil.png` | Original Lyra shooting/recoil animation pose, generated and chroma-key extracted for this project |
| `generated/orbs/orb-*.png` | Six transparent, color-and-symbol-coded gameplay pieces |
| `generated/ui/ui-*.png` | Transparent title, button, badge, and meter components |
| `generated/spirit-orbs-atlas.png` | Full transparent orb atlas |
| `generated/moonbloom-ui-kit.png` | Full transparent UI atlas |
| `generated/moonbloom-typography-preview.png` | Vietnamese typography and styled UI preview |
| `fonts/Baloo2-Variable.ttf` | Display/logo font, SIL Open Font License 1.1 |
| `fonts/Nunito-Variable.ttf` | HUD/body font, SIL Open Font License 1.1 |

## Source and processing

Chroma-key source renders are retained in `source/` for non-destructive iteration. Run `tools/process_assets.py` with the bundled Pillow/Numpy environment to rebuild transparent sprites. The processor removes only key-colored regions connected to the image edge, preserving violet and teal details inside sprites.

Font binaries are vendored from the official Google Fonts repository. Their OFL 1.1 license texts are stored beside the font files. Runtime projects should load them through `fonts/fonts.css` rather than a remote CDN.

## Final generation prompts

- Background: enchanted moonlit greenhouse; portrait 2:3; calm central play area; indigo, teal, mint, lavender and restrained gold; hand-painted 2D storybook style; no characters, bubbles, UI, text, logo, or watermark.
- Launcher: tiny moon-moth garden spirit holding a flower cannon; front three-quarter idle pose; lavender, mint, teal and gold; flat `#00ff00` removable background; no text or extra objects.
- Orbs: exact 3×2 grid containing flame, water, starlight, dream, leaf and frost circles; each has a distinct central glyph; flat `#ff00ff` removable background; no labels or extra decoration.
- UI kit: five blank botanical fantasy components—title plaque, primary button, icon button, score badge and danger meter; indigo glass, lavender moonstone, teal leaves and gold trim; flat `#ff00ff` removable background; no text or icons.
