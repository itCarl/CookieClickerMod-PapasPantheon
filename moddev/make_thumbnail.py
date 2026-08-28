"""
Generates thumbnail.png for Papa's Pantheon.

The mod's thesis in one picture: three sockets, each a different gem, with a
spirit seated in each - and underneath, the price of changing your mind. Three
swap pips, one spent, because that is the thing the mod exists to make visible.

Drawn at 4x and downsampled for antialiasing, in the Temple's own palette.

    python moddev/make_thumbnail.py
"""
import math
import os

from PIL import Image, ImageChops, ImageDraw, ImageFilter

OUT_SIZE = 512
SS = 4
S = OUT_SIZE * SS
C = S / 2

# The Temple's palette: stone and gold, with the three socket gems.
STONE_DARK = (26, 22, 16)
STONE_LIT  = (62, 52, 36)
GOLD       = (200, 162, 74)
GOLD_HOT   = (240, 220, 174)
DIAMOND    = (143, 212, 238)
RUBY       = (238, 143, 143)
JADE       = (159, 224, 143)
SPENT      = (92, 78, 52)


def lighten(c, f):
    return tuple(min(255, int(v + (255 - v) * f)) for v in c)


def gem(d, cx, cy, r, colour):
    """A faceted stone: an octagon with a lighter crown, not a circle."""
    pts = []
    for i in range(8):
        a = math.radians(i * 45 - 22.5)
        pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    d.polygon(pts, fill=colour, outline=lighten(colour, 0.45))
    crown = []
    for i in range(8):
        a = math.radians(i * 45 - 22.5)
        crown.append((cx + math.cos(a) * r * 0.52, cy + math.sin(a) * r * 0.52 - r * 0.10))
    d.polygon(crown, fill=lighten(colour, 0.42))
    # Two facet lines, so it reads as cut rather than flat.
    for i in (1, 5):
        a = math.radians(i * 45 - 22.5)
        d.line([cx, cy - r * 0.10,
                cx + math.cos(a) * r, cy + math.sin(a) * r],
               fill=lighten(colour, 0.6), width=max(1, int(SS * 1.1)))


img = Image.new('RGB', (S, S), STONE_DARK)
d = ImageDraw.Draw(img)

# Stone, lit from above.
for i in range(S):
    t = i / S
    shade = tuple(int(STONE_DARK[k] + (STONE_LIT[k] - STONE_DARK[k]) * (1 - t) ** 1.7)
                  for k in range(3))
    d.line([0, i, S, i], fill=shade)

# A warm glow behind the sockets.
glow = Image.new('RGB', (S, S), (0, 0, 0))
gd = ImageDraw.Draw(glow)
gd.ellipse([C - S * 0.36, C - S * 0.30, C + S * 0.36, C + S * 0.22], fill=(58, 44, 18))
glow = glow.filter(ImageFilter.GaussianBlur(S * 0.10))
img = ImageChops.add(img, glow)
d = ImageDraw.Draw(img)

# --- the three sockets ----------------------------------------------------
# Arranged as the Temple does: the strongest slot raised above the other two.
R = S * 0.115
POSITIONS = [
    (C, C - S * 0.13, DIAMOND),
    (C - S * 0.20, C + S * 0.09, RUBY),
    (C + S * 0.20, C + S * 0.09, JADE),
]

for (cx, cy, colour) in POSITIONS:
    # The socket: a gold ring set into the stone.
    d.ellipse([cx - R * 1.34, cy - R * 1.34, cx + R * 1.34, cy + R * 1.34],
              fill=(38, 31, 20), outline=GOLD, width=max(2, int(SS * 2.4)))
    d.ellipse([cx - R * 1.15, cy - R * 1.15, cx + R * 1.15, cy + R * 1.15],
              outline=(28, 23, 15), width=max(1, int(SS * 1.2)))
    gem(d, cx, cy, R, colour)

# Lines linking the three, so they read as one arrangement rather than three
# separate things.
for a in range(3):
    for b in range(a + 1, 3):
        d.line([POSITIONS[a][0], POSITIONS[a][1], POSITIONS[b][0], POSITIONS[b][1]],
               fill=(74, 60, 34), width=max(1, int(SS * 1.3)))

# Redraw the gems over the link lines.
for (cx, cy, colour) in POSITIONS:
    gem(d, cx, cy, R, colour)

# --- the price of changing your mind --------------------------------------
# Three swap pips, one already spent. This is the point of the whole mod.
pw = S * 0.105
gap = S * 0.030
total = 3 * pw + 2 * gap
x = C - total / 2
y = C + S * 0.30
for i in range(3):
    box = [x, y, x + pw, y + pw * 0.40]
    filled = i < 2
    d.rounded_rectangle(box, radius=pw * 0.15,
                        fill=GOLD if filled else None,
                        outline=GOLD if filled else SPENT,
                        width=max(2, int(SS * 1.6)))
    if filled:
        d.rounded_rectangle([box[0] + SS * 3, box[1] + SS * 2,
                             box[2] - SS * 3, box[1] + pw * 0.18],
                            radius=pw * 0.08, fill=GOLD_HOT)
    x += pw + gap

img = img.resize((OUT_SIZE, OUT_SIZE), Image.LANCZOS)

here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, '..', 'mod', 'thumbnail.png')
img.save(out, optimize=True)
print('wrote', os.path.normpath(out), img.size,
      str(os.path.getsize(out) // 1024) + ' KB')
