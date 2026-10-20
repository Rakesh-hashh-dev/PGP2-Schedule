"""Prepare the supplied GIF as caption-free transparent WebP sprite strips.

Run: python scripts/prepare-luna.py
Preserves source frames and timings. Background removal is edge-connected only,
so enclosed white fur and eye highlights remain intact. Boundary pixels are
unmatted against the source background instead of retaining a light fringe.
"""
from collections import deque
from pathlib import Path
import hashlib
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / "luna all-states.gif"
OUT = ROOT / "public" / "pets" / "luna"
STATES = {
    "idle": (0, 11), "run-right": (12, 27), "run-left": (28, 43),
    "wave": (44, 51), "jump": (52, 61), "rest": (62, 77),
    "wait": (78, 89), "think": (90, 101), "review": (102, 113),
}


def transparent(frame):
    rgb = frame.convert("RGB").crop((0, 22, 192, 232))
    pixels = rgb.load()
    width, height = rgb.size
    background = pixels[0, 0]
    seen = bytearray(width * height)
    queue = deque()
    for x in range(width):
        queue.extend(((x, 0), (x, height - 1)))
    for y in range(height):
        queue.extend(((0, y), (width - 1, y)))
    while queue:
        x, y = queue.popleft()
        offset = y * width + x
        if seen[offset]:
            continue
        seen[offset] = 1
        if max(abs(a - b) for a, b in zip(pixels[x, y], background)) > 24:
            continue
        seen[offset] = 2
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < width and 0 <= ny < height and not seen[ny * width + nx]:
                queue.append((nx, ny))
    opaque = [value != 2 for value in seen]
    boundary = set()
    for y in range(height):
        for x in range(width):
            if not opaque[y * width + x]:
                continue
            if any(not opaque[ny * width + nx]
                   for ny in range(max(0, y - 1), min(height, y + 2))
                   for nx in range(max(0, x - 1), min(width, x + 2))):
                boundary.add((x, y))
    coverage = bytearray(255 if value else 0 for value in opaque)
    rgba = rgb.convert("RGBA")
    cleaned = rgba.load()
    for x, y in boundary:
        colour = pixels[x, y]
        contrast = sum((a - b) ** 2 for a, b in zip(background, colour))
        candidates = []
        for ny in range(max(0, y - 2), min(height, y + 3)):
            for nx in range(max(0, x - 2), min(width, x + 3)):
                if not opaque[ny * width + nx] or (nx, ny) in boundary:
                    continue
                foreground = pixels[nx, ny]
                delta = [a - b for a, b in zip(background, foreground)]
                strength = sum(v * v for v in delta)
                if strength <= contrast * 1.15:
                    continue
                alpha = sum((a - b) * v for a, b, v in zip(background, colour, delta)) / strength
                # Only edge pixels with a nearby, stronger interior sample are
                # altered. The mask, enclosed fur, and facial details stay put.
                if .18 < alpha < .96:
                    candidates.append(((nx - x) ** 2 + (ny - y) ** 2, alpha))
        if candidates:
            _, alpha = min(candidates, key=lambda item: (item[0], -item[1]))
            coverage[y * width + x] = round(alpha * 255)
            cleaned[x, y] = tuple(max(0, min(255, round(b + (c - b) / alpha)))
                                  for c, b in zip(colour, background)) + (255,)
    rgba.putalpha(Image.frombytes("L", rgb.size, bytes(coverage)))
    return rgba


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE)
    assert source.size == (192, 232) and source.n_frames == 114, "Source layout changed"
    manifest = {"width": 192, "height": 210, "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(), "preparationVersion": 2, "states": {}}
    prepared = {}
    for key, (start, end) in STATES.items():
        frames, duration = [], 0
        for index in range(start, end + 1):
            source.seek(index)
            assert source.info.get("duration") == 120, "Non-uniform frames need a new timing map"
            duration += source.info["duration"]
            frames.append(transparent(source))
        strip = Image.new("RGBA", (192 * len(frames), 210))
        for index, frame in enumerate(frames):
            strip.paste(frame, (index * 192, 0))
        # High quality colour compression keeps the nine strips within the
        # existing 1.2 MB budget. WebP alpha remains lossless, including the
        # softened coverage above; frame geometry and timings stay unchanged.
        strip.save(OUT / f"{key}.webp", "WEBP", quality=90, method=6, exact=True)
        manifest["states"][key] = {"frames": len(frames), "durationMs": duration, "file": f"/pets/luna/{key}.webp"}
        prepared[key] = frames
    prepared["idle"][0].save(OUT / "still.webp", "WEBP", quality=90, method=6, exact=True)
    (ROOT / "src" / "lib" / "lunaAssets.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Luna: {len(STATES)} states, 114 transparent frames, {sum(p.stat().st_size for p in OUT.glob('*.webp')):,} bytes")


if __name__ == "__main__":
    main()
