# Moonbloom typography

## Font roles

- **Moonbloom Display / Baloo 2**: logo, screen titles, combo callouts, major rewards. Weight 650–800. Its rounded silhouette matches the orbs and supports Vietnamese diacritics.
- **Moonbloom UI / Nunito**: HUD, buttons, instructions, scores, settings and accessibility copy. Weight 600 for body text and 800–900 for interactive labels.

## Runtime rules

- Load `assets/fonts/fonts.css`; do not depend on a font CDN.
- Use uppercase only for short labels such as `BẮT ĐẦU`, `TẠM DỪNG`, `KỶ LỤC MỚI`, and `NGUY HIỂM`.
- Minimum mobile sizes: 16 px body, 18 px buttons, 24 px score, 40 px screen title.
- Use moon-gold `#fff1bd` for primary text, lavender `#c9bcff` for secondary display text, and blue-white `#b8ccec` for body copy.
- Apply a dark indigo outline or shadow to text drawn over gameplay. Never rely on glow alone for contrast.
- Keep numeric HUD values tabular and avoid condensed letter spacing on Vietnamese copy.

## Example hierarchy

| Role | Family | Weight | Treatment |
| --- | --- | --- | --- |
| Logo | Moonbloom Display | 750 | Gold fill, brown edge, deep indigo shadow |
| Subtitle | Moonbloom Display | 650 | Lavender, 0.12em tracking |
| Primary button | Moonbloom UI | 850 | Warm white, indigo 2 px shadow |
| HUD value | Moonbloom UI | 850 | Tabular numerals, warm white |
| Body/help | Moonbloom UI | 600 | Blue-white, no all-caps |
