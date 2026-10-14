from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets" / "generated"
OUTPUT = ROOT / "assets" / "runtime"


def convert(source: Path, target: Path, size: tuple[int, int], quality: int = 88) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        image.thumbnail(size, Image.Resampling.LANCZOS)
        image.save(target, "WEBP", quality=quality, method=6, exact=True)


convert(SOURCE / "moonbloom-garden-bg.png", OUTPUT / "moonbloom-garden-bg.webp", (720, 1280), 84)
convert(SOURCE / "lyra-launcher.png", OUTPUT / "lyra-launcher.webp", (460, 590), 88)
convert(SOURCE / "lyra-recoil.png", OUTPUT / "lyra-recoil.webp", (460, 590), 88)

for source in (SOURCE / "orbs").glob("*.png"):
    convert(source, OUTPUT / "orbs" / f"{source.stem}.webp", (144, 144), 90)

convert(SOURCE / "ui" / "ui-title-plaque.png", OUTPUT / "ui" / "ui-title-plaque.webp", (720, 273), 88)
convert(SOURCE / "ui" / "ui-primary-button.png", OUTPUT / "ui" / "ui-primary-button.webp", (640, 123), 88)

print(f"Optimized runtime assets to {OUTPUT}")
