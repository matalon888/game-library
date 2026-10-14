"""Turn ImageGen chroma sources into production-ready transparent sprites."""

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "source"
OUTPUT = ROOT / "assets" / "generated"


def connected_chroma(source: Path, destination: Path, key: tuple[int, int, int]) -> Image.Image:
    image = Image.open(source).convert("RGBA")
    pixels = np.asarray(image).copy()
    rgb = pixels[:, :, :3].astype(np.int32)
    key_array = np.asarray(key, dtype=np.int32)
    distance = np.sqrt(np.sum((rgb - key_array) ** 2, axis=2))

    # Only remove key-colored pixels connected to the canvas edge. This keeps
    # violet highlights inside the dream orb and teal details inside Lyra.
    traversable = distance <= 70
    height, width = traversable.shape
    connected = np.zeros((height, width), dtype=bool)
    queue: deque[tuple[int, int]] = deque()

    for x in range(width):
        if traversable[0, x]:
            queue.append((0, x))
        if traversable[height - 1, x]:
            queue.append((height - 1, x))
    for y in range(height):
        if traversable[y, 0]:
            queue.append((y, 0))
        if traversable[y, width - 1]:
            queue.append((y, width - 1))

    while queue:
        y, x = queue.popleft()
        if connected[y, x] or not traversable[y, x]:
            continue
        connected[y, x] = True
        if y:
            queue.append((y - 1, x))
        if y + 1 < height:
            queue.append((y + 1, x))
        if x:
            queue.append((y, x - 1))
        if x + 1 < width:
            queue.append((y, x + 1))

    pixels[connected, 3] = 0
    # Remove exact-key islands enclosed by a sprite (for example, the open
    # flower-cannon muzzle) without touching nearby subject colors.
    pixels[distance <= 35, 3] = 0
    if key[1] > 200:
        red = rgb[:, :, 0]
        green = rgb[:, :, 1]
        blue = rgb[:, :, 2]
        enclosed_green = (green > 145) & (green > red * 1.35) & (green > blue * 1.35)
        pixels[enclosed_green, 3] = 0

    result = Image.fromarray(pixels, "RGBA")
    destination.parent.mkdir(parents=True, exist_ok=True)
    result.save(destination, optimize=True)
    return result


def alpha_bbox(image: Image.Image, pad: int = 10) -> tuple[int, int, int, int]:
    alpha = np.asarray(image.getchannel("A"))
    ys, xs = np.where(alpha > 8)
    if not len(xs):
        raise ValueError("No visible pixels found")
    return (
        max(0, int(xs.min()) - pad),
        max(0, int(ys.min()) - pad),
        min(image.width, int(xs.max()) + 1 + pad),
        min(image.height, int(ys.max()) + 1 + pad),
    )


def crop_cell(atlas: Image.Image, box: tuple[int, int, int, int], destination: Path, square=False):
    cell = atlas.crop(box)
    sprite = cell.crop(alpha_bbox(cell, 8))
    if square:
        side = max(sprite.size)
        square_image = Image.new("RGBA", (side, side))
        square_image.alpha_composite(sprite, ((side - sprite.width) // 2, (side - sprite.height) // 2))
        sprite = square_image.resize((232, 232), Image.Resampling.LANCZOS)
        padded = Image.new("RGBA", (256, 256))
        padded.alpha_composite(sprite, (12, 12))
        sprite = padded
    destination.parent.mkdir(parents=True, exist_ok=True)
    sprite.save(destination, optimize=True)


def contain(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    copy = image.copy()
    copy.thumbnail(size, Image.Resampling.LANCZOS)
    return copy


def font(path: Path, size: int, variation: str) -> ImageFont.FreeTypeFont:
    result = ImageFont.truetype(path, size)
    result.set_variation_by_name(variation)
    return result


def create_preview() -> None:
    canvas = Image.new("RGB", (1600, 900), "#07152b").convert("RGBA")
    draw = ImageDraw.Draw(canvas)
    title_font = font(ROOT / "assets" / "fonts" / "Baloo2-Variable.ttf", 46, "Bold")
    label_font = font(ROOT / "assets" / "fonts" / "Nunito-Variable.ttf", 24, "Regular")

    background = Image.open(OUTPUT / "moonbloom-garden-bg.png").convert("RGBA")
    scene = contain(background, (560, 840))
    canvas.alpha_composite(scene, (30, 30))
    launcher = contain(Image.open(OUTPUT / "lyra-launcher.png").convert("RGBA"), (280, 340))
    canvas.alpha_composite(launcher, (170, 525))

    draw.text((640, 38), "MOONBLOOM • BỘ ASSET 2D", font=title_font, fill="#f5dfa2", stroke_width=1, stroke_fill="#765223")
    draw.text((640, 105), "Sáu linh cầu có ký hiệu riêng", font=label_font, fill="#b7cfec")
    orb_names = ["flame", "tide", "starlight", "dream", "leaf", "frost"]
    for index, name in enumerate(orb_names):
        orb = Image.open(OUTPUT / "orbs" / f"orb-{name}.png").convert("RGBA").resize((150, 150), Image.Resampling.LANCZOS)
        x = 640 + (index % 3) * 190
        y = 160 + (index // 3) * 200
        canvas.alpha_composite(orb, (x, y))
        draw.text((x + 42, y + 155), name.title(), font=label_font, fill="#dce9ff")

    draw.text((640, 565), "UI thực vật dưới ánh trăng", font=label_font, fill="#b7cfec")
    button = contain(Image.open(OUTPUT / "ui" / "ui-primary-button.png").convert("RGBA"), (650, 130))
    canvas.alpha_composite(button, (640, 610))
    badge = contain(Image.open(OUTPUT / "ui" / "ui-score-badge.png").convert("RGBA"), (300, 130))
    canvas.alpha_composite(badge, (640, 755))
    icon = contain(Image.open(OUTPUT / "ui" / "ui-icon-button.png").convert("RGBA"), (145, 145))
    canvas.alpha_composite(icon, (990, 740))
    meter = contain(Image.open(OUTPUT / "ui" / "ui-danger-meter.png").convert("RGBA"), (380, 100))
    canvas.alpha_composite(meter, (1175, 765))
    canvas.save(OUTPUT / "moonbloom-asset-preview.png", optimize=True)


def create_typography_preview() -> None:
    canvas = Image.new("RGBA", (1400, 900), "#07152b")
    draw = ImageDraw.Draw(canvas)
    display_path = ROOT / "assets" / "fonts" / "Baloo2-Variable.ttf"
    ui_path = ROOT / "assets" / "fonts" / "Nunito-Variable.ttf"
    display = font(display_path, 92, "ExtraBold")
    display_small = font(display_path, 38, "SemiBold")
    button_font = font(ui_path, 38, "ExtraBold")
    hud_font = font(ui_path, 30, "ExtraBold")
    body_font = font(ui_path, 24, "SemiBold")

    plaque = contain(Image.open(OUTPUT / "ui" / "ui-title-plaque.png").convert("RGBA"), (1120, 390))
    plaque_x = (canvas.width - plaque.width) // 2
    canvas.alpha_composite(plaque, (plaque_x, 30))
    title = "MOONBLOOM"
    title_box = draw.textbbox((0, 0), title, font=display, stroke_width=3)
    title_x = (canvas.width - (title_box[2] - title_box[0])) // 2
    draw.text((title_x + 4, 115 + 7), title, font=display, fill="#06122d", stroke_width=5, stroke_fill="#06122d")
    draw.text((title_x, 115), title, font=display, fill="#f7dfa0", stroke_width=3, stroke_fill="#8b5a21")
    subtitle = "KHU VƯỜN BẤT TẬN"
    subtitle_box = draw.textbbox((0, 0), subtitle, font=display_small)
    draw.text(((canvas.width - subtitle_box[2]) // 2, 235), subtitle, font=display_small, fill="#c7b8ff")

    button = contain(Image.open(OUTPUT / "ui" / "ui-primary-button.png").convert("RGBA"), (720, 155))
    button_x = (canvas.width - button.width) // 2
    canvas.alpha_composite(button, (button_x, 400))
    play = "BẮT ĐẦU"
    play_box = draw.textbbox((0, 0), play, font=button_font, stroke_width=1)
    draw.text(((canvas.width - play_box[2]) // 2, 445), play, font=button_font, fill="#fff4cf", stroke_width=2, stroke_fill="#24315f")

    badge = contain(Image.open(OUTPUT / "ui" / "ui-score-badge.png").convert("RGBA"), (450, 180))
    canvas.alpha_composite(badge, (130, 625))
    draw.text((245, 660), "ĐIỂM", font=body_font, fill="#a9c7ef")
    draw.text((235, 697), "12 480", font=hud_font, fill="#fff1b7", stroke_width=1, stroke_fill="#24315f")

    meter = contain(Image.open(OUTPUT / "ui" / "ui-danger-meter.png").convert("RGBA"), (610, 130))
    canvas.alpha_composite(meter, (670, 650))
    draw.rounded_rectangle((755, 690, 1120, 712), radius=11, fill="#ff6b75")
    danger = "NGUY HIỂM"
    danger_box = draw.textbbox((0, 0), danger, font=body_font)
    draw.text((975 - danger_box[2] // 2, 735), danger, font=body_font, fill="#ffb4bd")

    draw.text((130, 835), "Baloo 2 • Logo & tiêu đề", font=body_font, fill="#9bb5d8")
    draw.text((920, 835), "Nunito • HUD & nội dung", font=body_font, fill="#9bb5d8")
    canvas.save(OUTPUT / "moonbloom-typography-preview.png", optimize=True)


def main() -> None:
    launcher = connected_chroma(
        SOURCE / "lyra-launcher-chroma.png",
        OUTPUT / "lyra-launcher.png",
        (4, 249, 6),
    )
    launcher.crop(alpha_bbox(launcher, 16)).save(OUTPUT / "lyra-launcher.png", optimize=True)

    orbs = connected_chroma(
        SOURCE / "spirit-orbs-atlas-chroma.png",
        OUTPUT / "spirit-orbs-atlas.png",
        (250, 2, 248),
    )
    orb_names = ["flame", "tide", "starlight", "dream", "leaf", "frost"]
    cell_width = orbs.width // 3
    cell_height = orbs.height // 2
    for index, name in enumerate(orb_names):
        col, row = index % 3, index // 3
        crop_cell(
            orbs,
            (col * cell_width, row * cell_height, (col + 1) * cell_width, (row + 1) * cell_height),
            OUTPUT / "orbs" / f"orb-{name}.png",
            square=True,
        )

    ui = connected_chroma(
        SOURCE / "moonbloom-ui-kit-chroma.png",
        OUTPUT / "moonbloom-ui-kit.png",
        (249, 3, 248),
    )
    ui_regions = {
        "ui-title-plaque.png": (70, 30, 1190, 455),
        "ui-primary-button.png": (80, 485, 1170, 710),
        "ui-icon-button.png": (110, 720, 500, 1025),
        "ui-score-badge.png": (660, 745, 1160, 1020),
        "ui-danger-meter.png": (65, 1025, 1190, 1215),
    }
    for name, region in ui_regions.items():
        crop_cell(ui, region, OUTPUT / "ui" / name)

    create_preview()
    create_typography_preview()
    print("Processed sprites, UI, asset preview, and typography preview.")


if __name__ == "__main__":
    main()
