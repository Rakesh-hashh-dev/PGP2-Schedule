"""Verify all prepared Luna frames and emit light/dark contact sheets."""
import importlib.util
import json
import sys
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageStat

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("prepare_luna", ROOT / "scripts" / "prepare-luna.py")
prepare = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare)
source = Image.open(prepare.SOURCE)
frames = []
colour_errors = []
partial_alpha = 0
for state, (start, end) in prepare.STATES.items():
    strip = Image.open(prepare.OUT / f"{state}.webp").convert("RGBA")
    assert strip.size == (192 * (end - start + 1), 210)
    for index in range(start, end + 1):
        source.seek(index)
        expected = prepare.transparent(source)
        decoded = strip.crop(((index - start) * 192, 0, (index - start + 1) * 192, 210))
        assert ImageChops.difference(expected.getchannel("A"), decoded.getchannel("A")).getbbox() is None, f"Alpha drift at {index}"
        alpha = decoded.getchannel("A")
        partial_alpha += sum(count for value, count in enumerate(alpha.histogram()) if 0 < value < 255)
        mask = alpha.point(lambda a: 255 if a > 230 else 0)
        colour_errors.append(sum(ImageStat.Stat(ImageChops.difference(expected.convert("RGB"), decoded.convert("RGB")), mask).mean) / 3)
        frames.append((state, index, decoded))
assert len(frames) == 114 and partial_alpha > 0
assert max(colour_errors) < 12, "Visible colour compression needs inspection"
out = ROOT / ".local"
for theme, background in [("light", "#f5f2ec"), ("dark", "#141725")]:
    sheet = Image.new("RGB", (12 * 90, 10 * 120), background)
    draw = ImageDraw.Draw(sheet)
    for i, (state, index, frame) in enumerate(frames):
        x, y = (i % 12) * 90, (i // 12) * 120
        thumbnail = frame.copy()
        thumbnail.thumbnail((80, 94), Image.Resampling.LANCZOS)
        sheet.paste(thumbnail, (x + (90 - thumbnail.width) // 2, y), thumbnail)
        draw.text((x + 2, y + 97), f"{state}\n{index}", fill="#eeedf8" if theme == "dark" else "#282633")
    sheet.save(out / f"luna-114-{theme}.png")
result = {"frames": len(frames), "alpha": "all 114 alpha channels match softened source preparation exactly", "partialAlphaPixels": partial_alpha, "maxMeanColourError": round(max(colour_errors), 3), "totalBytes": sum(p.stat().st_size for p in prepare.OUT.glob("*.webp"))}
(out / "luna-visual-report.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result))
