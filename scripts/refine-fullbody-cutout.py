#!/usr/bin/env python3
"""Remove photographed rail remnants from the IMG_1021 Vision cutout.

Only alpha values change. Coordinates describe visible rail between the left
fingers and below the wrist; no pixels or hidden anatomy are synthesized.
Usage: python3 scripts/refine-fullbody-cutout.py INPUT.png OUTPUT.png
Requires Pillow. Expected input: the 701×1043 crop produced by extract-portrait.swift.
Create it with Apple Vision on macOS 14 or later:
  swift scripts/extract-portrait.swift /path/to/IMG_1021.jpeg cutout.png 0.51 0.49 370,530,760,1080
Then run this script on cutout.png. Inspect the edges after any OS/model update;
these alpha-mask coordinates are specific to this photograph and crop.
"""
from pathlib import Path
import sys
from PIL import Image, ImageChops, ImageDraw

if len(sys.argv) != 3:
    raise SystemExit(__doc__)

source, destination = map(Path, sys.argv[1:])
image = Image.open(source).convert("RGBA")
if image.size != (701, 1043):
    raise SystemExit(f"Expected 701×1043 cutout, received {image.size}.")

exclusions = [
    [(0, 418.5), (7, 419), (14, 419), (16, 416), (19, 414),
     (24, 413), (29, 413), (31, 413), (33, 414), (38, 414),
     (42, 414), (46, 413.5), (49, 413), (48, 415.5), (44, 417.5),
     (39, 420), (35, 422), (32, 425), (29, 427), (28, 429), (0, 429)],
    [(72, 425), (80, 423), (85, 420), (88, 422),
     (94, 426), (96, 429), (70, 429)],
    [(49, 428), (53, 428), (53, 432), (49, 432)],
]
scale = 4
mask = Image.new("L", (image.width * scale, image.height * scale), 255)
draw = ImageDraw.Draw(mask)
for polygon in exclusions:
    draw.polygon([(round(x * scale), round(y * scale)) for x, y in polygon], fill=0)
mask = mask.resize(image.size, Image.Resampling.LANCZOS)
image.putalpha(ImageChops.multiply(image.getchannel("A"), mask))
destination.parent.mkdir(parents=True, exist_ok=True)
image.save(destination)
print(f"Saved refined transparent cutout: {destination}")
