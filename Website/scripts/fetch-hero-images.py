"""Download sharp hero images for Services, Careers, Contact pages."""
from pathlib import Path
from urllib.request import Request, urlopen
from PIL import Image

ASSETS = Path(__file__).resolve().parents[1] / "assets"
ASSETS.mkdir(parents=True, exist_ok=True)

SOURCES = {
    # Cầu Vàng Bà Nà (Dịch vụ)
    "hero-services.jpg": "https://images.unsplash.com/photo-1774002441461-e82338cdeb3f?w=2400&q=92&auto=format&fit=crop",
    # Cổ Ngọ Môn Huế (Tuyển dụng)
    "hero-careers.jpg": "https://commons.wikimedia.org/w/index.php?title=Special:FilePath/DGJ_1178_-_Ngo_Mon_Gate_(3442074085).jpg",
    # Ruộng bậc thang + sông (Liên hệ)
    "hero-contact.jpg": "https://images.unsplash.com/photo-1758003653085-4ebfbd7f76b4?w=2400&q=92&auto=format&fit=crop",
}

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"


def download(url: str, dest: Path) -> None:
    req = Request(url, headers={"User-Agent": UA})
    data = urlopen(req, timeout=120).read()
    dest.write_bytes(data)
    print(f"Downloaded {dest.name}: {len(data)} bytes")


def optimize(path: Path, max_w: int = 2400) -> None:
    im = Image.open(path).convert("RGB")
    w, h = im.size
    if w > max_w:
        nh = int(h * max_w / w)
        im = im.resize((max_w, nh), Image.Resampling.LANCZOS)
    im.save(path, "JPEG", quality=90, optimize=True)
    print(f"Saved {path.name}: {im.size}, {path.stat().st_size} bytes")


def main() -> None:
    for name, url in SOURCES.items():
        dest = ASSETS / name
        download(url, dest)
        optimize(dest)


if __name__ == "__main__":
    main()
