"""logo.png → web, admin ve mobil ikonları. Üretilen dosyalar tasarım token renklerini kullanır."""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
SRC = Path(r"C:\Users\edizk\Downloads\logo.png")
# DESIGN.md / sweetThemes: açık zemin, koyu metin.
BG = (0xF6, 0xF4, 0xF0)
DARK_INK = (0xF3, 0xF1, 0xF5)
WHITE = (255, 255, 255)

WEB = ROOT / "apps" / "web" / "src"
ADMIN = ROOT / "apps" / "admin" / "public"
MOBILE = ROOT / "apps" / "mobile" / "assets" / "images"


def knockout(src: Image.Image) -> Image.Image:
    """Beyaz zemini saydam yap; kenar yumuşak kalsın."""
    rgba = src.convert("RGBA")
    lum = rgba.convert("L")
    table = []
    for p in range(256):
        if p >= 250:
            table.append(0)
        else:
            table.append(min(255, int((255 - p) * 255 / (255 - 36))))
    alpha = lum.point(table)
    rgba.putalpha(alpha)
    bbox = alpha.point(lambda p: 255 if p > 12 else 0).getbbox()
    if not bbox:
        raise SystemExit("logo boş")
    return rgba.crop(bbox)


def fit(mark: Image.Image, size: int, frac: float, bg: tuple[int, int, int] | None) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (*(bg if bg else (0, 0, 0)), 0 if bg is None else 255))
    max_w = int(size * frac)
    max_h = int(size * frac)
    scale = min(max_w / mark.width, max_h / mark.height)
    resized = mark.resize((max(1, int(mark.width * scale)), max(1, int(mark.height * scale))), Image.Resampling.LANCZOS)
    canvas.alpha_composite(resized, ((size - resized.width) // 2, (size - resized.height) // 2))
    return canvas


def flatten(im: Image.Image, bg: tuple[int, int, int]) -> Image.Image:
    out = Image.new("RGB", im.size, bg)
    out.paste(im, mask=im.getchannel("A"))
    return out


def recolor(mark: Image.Image, rgb: tuple[int, int, int]) -> Image.Image:
    out = mark.copy()
    solid = Image.new("RGBA", mark.size, (*rgb, 255))
    solid.putalpha(mark.getchannel("A"))
    return solid


def main() -> None:
    mark = knockout(Image.open(SRC))
    pad = int(max(mark.size) * 0.04)
    padded = Image.new("RGBA", (mark.width + pad * 2, mark.height + pad * 2), (0, 0, 0, 0))
    padded.alpha_composite(mark, (pad, pad))
    mark = padded

    brand = WEB / "assets" / "brand"
    brand.mkdir(parents=True, exist_ok=True)
    mark.save(brand / "wordmark.png")

    app_dir = WEB / "app"
    icon_512 = flatten(fit(mark, 512, 0.86, BG), BG)
    icon_512.save(app_dir / "icon.png", optimize=True)
    apple = flatten(fit(mark, 180, 0.84, BG), BG)
    apple.save(app_dir / "apple-icon.png", optimize=True)
    # Next.js ICO çözücüsü iç PNG'nin RGBA olmasını ister.
    ico_master = fit(mark, 48, 0.9, BG)
    ico_master.save(app_dir / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    ico_master.save(ADMIN / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])

    MOBILE.mkdir(parents=True, exist_ok=True)
    flatten(fit(mark, 1024, 0.78, BG), BG).save(MOBILE / "icon.png", optimize=True)
    fit(mark, 1024, 0.66, None).save(MOBILE / "android-icon-foreground.png")
    Image.new("RGB", (1024, 1024), BG).save(MOBILE / "android-icon-background.png", optimize=True)
    fit(recolor(mark, WHITE), 1024, 0.66, None).save(MOBILE / "android-icon-monochrome.png")
    # Açılış görseli sıkı kadraj: eklenti imageWidth ile ölçekler, zemin renk config'den gelir.
    splash = fit(mark, 1024, 0.92, None)
    splash.save(MOBILE / "splash-icon.png")
    fit(recolor(mark, DARK_INK), 1024, 0.92, None).save(MOBILE / "splash-icon-dark.png")
    flatten(fit(mark, 48, 0.9, BG), BG).save(MOBILE / "favicon.png", optimize=True)
    print("wordmark", mark.size)


if __name__ == "__main__":
    main()
