"""Prepare the supplied GIF as caption-free transparent WebP sprite strips.

Run: python scripts/prepare-luna.py
Preserves source frames and timings. Background removal is edge-connected only,
so enclosed white fur and eye highlights remain intact.
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
    alpha = Image.frombytes("L", rgb.size, bytes(0 if value == 2 else 255 for value in seen))
    rgba = rgb.convert("RGBA")
    rgba.putalpha(alpha)
    return rgba


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE)
    assert source.size == (192, 232) and source.n_frames == 114, "Source layout changed"
    manifest = {"width": 192, "height": 210, "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(), "states": {}}
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
        strip.save(OUT / f"{key}.webp", "WEBP", quality=92, method=6)
        manifest["states"][key] = {"frames": len(frames), "durationMs": duration, "file": f"/pets/luna/{key}.webp"}
        prepared[key] = frames
    prepared["idle"][0].save(OUT / "still.webp", "WEBP", quality=92, method=6)
    (ROOT / "src" / "lib" / "lunaAssets.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Luna: {len(STATES)} states, 114 transparent frames, {sum(p.stat().st_size for p in OUT.glob('*.webp')):,} bytes")


if __name__ == "__main__":
    main()
