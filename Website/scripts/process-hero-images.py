"""Process hero images: remove watermarks/logos and save to assets/."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
SRC = Path(r"C:\Users\Tuyen PC\.cursor\projects\c-Users-Tuyen-PC-webetax\assets")

SOURCES = {
    "hero-services.jpg": SRC / "c__Users_Tuyen_PC_AppData_Roaming_Cursor_User_workspaceStorage_b18cc5e12202ae9fba5c970c87b2bd68_images_image-f8f7728d-dbe5-4e57-b0f7-7a45088b3b32.png",
    "hero-careers.jpg": SRC / "c__Users_Tuyen_PC_AppData_Roaming_Cursor_User_workspaceStorage_b18cc5e12202ae9fba5c970c87b2bd68_images_image-b54a96b0-9cc1-4014-8db2-9d36faaf2d44.jpg",
    "hero-contact.jpg": SRC / "c__Users_Tuyen_PC_AppData_Roaming_Cursor_User_workspaceStorage_b18cc5e12202ae9fba5c970c87b2bd68_images_image-802fa9c1-549b-4b4f-a4b4-f0c380dad388.png",
}


def blur_region(img: Image.Image, box: tuple[int, int, int, int], radius: int = 12) -> None:
    x0, y0, x1, y1 = box
    region = img.crop(box)
    blurred = region.filter(ImageFilter.GaussianBlur(radius=radius))
    img.paste(blurred, box)


def fill_region(img: Image.Image, box: tuple[int, int, int, int], color: tuple) -> None:
    draw = ImageDraw.Draw(img)
    draw.rectangle(box, fill=color)


def average_color(img: Image.Image, box: tuple[int, int, int, int]) -> tuple:
    region = img.crop(box)
    pixels = list(region.getdata())
    n = len(pixels)
    r = sum(p[0] for p in pixels) // n
    g = sum(p[1] for p in pixels) // n
    b = sum(p[2] for p in pixels) // n
    return (r, g, b)


def process_services(img: Image.Image) -> Image.Image:
    w, h = img.size
    # Bottom-right watermark — blend with nearby water tones
    box = (int(w * 0.80), int(h * 0.90), w, h)
    blur_region(img, box, radius=18)
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.rectangle(box, fill=(8, 18, 42, 90))
    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    return img


def process_careers(img: Image.Image) -> Image.Image:
    w, h = img.size
    # Bottom-left "Dân Trí" watermark
    blur_region(img, (0, int(h * 0.88), int(w * 0.22), h), radius=14)
    return img


def process_contact(img: Image.Image) -> Image.Image:
    w, h = img.size
    # Crop left edge to remove building with "BƯU ĐIỆN HÀ NỘI" sign; keep Turtle Tower centered
    crop_left = int(w * 0.18)
    return img.crop((crop_left, 0, w, h))


PROCESSORS = {
    "hero-services.jpg": process_services,
    "hero-careers.jpg": process_careers,
    "hero-contact.jpg": process_contact,
}


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    for name, src in SOURCES.items():
        img = Image.open(src).convert("RGB")
        img = PROCESSORS[name](img)
        out = ASSETS / name
        img.save(out, "JPEG", quality=88, optimize=True)
        print(f"Saved {out} ({img.size[0]}x{img.size[1]})")


if __name__ == "__main__":
    main()
