"""
Generates thumbnail.png for the Papa's Pantheon mod.

The picture is the mod's key insight: the temple's three sockets, and two
spirits trading places along one arc. Dropping a spirit on an occupied socket
makes the pair exchange, so a rearrangement costs fewer swaps than the number
of sockets that differ - which is why the mod searches for the true minimum
instead of counting.

Everything is the game's own art: the pantheon background, the stone slot from
spellBG.png, the god sprites and the worship gems out of icons.png, and the
inner shading the temple itself uses. The slots carry the game's own vertical
stagger (templeSlot0/1/2 sit at -4, 0 and +4 pixels).

    python moddev/make_thumbnail.py
"""
import math
import os

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

GAME_IMG = os.environ.get(
    "CC_IMG",
    r"C:\Program Files (x86)\Steam\steamapps\common\Cookie Clicker\resources\app\src\img")

OUT_SIZE = 512
SS = 4

TILE_W, TILE_H = 60, 74     # one spellBG cell
SCALE = 2                   # slots and gods are drawn at 2x
GAP = 26

# god icons on icons.png: ruin (Godzamok), mother (Mokalsium), order (Rigidel)
GODS = [(23, 18), (29, 18), (22, 19)]
SLOT_STAGGER = [-4, 0, 4]   # the game's own #templeSlot0/1/2 offsets

# templeGem1/2/3 - the game gives each slot its own gem. Pixel offsets into
# icons.png, 24px cells.
GEMS = [(1104, 720), (1128, 720), (1104, 744)]
GEM_PX = 24

TITLE = "Papa's Pantheon"
SUBTITLE = "TEMPLE"
TITLE_FONT = r"C:\Windows\Fonts\georgiab.ttf"

GOLD = (255, 206, 120)
TEAL = (120, 214, 186)
BORDER = (206, 166, 74)


def asset(name):
    path = os.path.join(GAME_IMG, name)
    if not os.path.exists(path):
        raise SystemExit(
            "Cookie Clicker art not found: %s\n"
            "Set CC_IMG to the game's src/img folder." % path)
    return Image.open(path)


def tiled(name, size):
    src = asset(name).convert("RGB")
    out = Image.new("RGB", (size, size))
    for y in range(0, size, src.height):
        for x in range(0, size, src.width):
            out.paste(src, (x, y))
    return out


def icon(sheet, col, row, scale, size=48):
    c = sheet.crop((col * size, row * size, (col + 1) * size, (row + 1) * size))
    return c.resize((size * scale, size * scale), Image.NEAREST)


def slot_tile(sheet, variant, row, scale):
    c = sheet.crop((variant * TILE_W, row * TILE_H,
                    (variant + 1) * TILE_W, (row + 1) * TILE_H))
    return c.resize((TILE_W * scale, TILE_H * scale), Image.NEAREST)


def drop_shadow(layer, offset, blur, opacity):
    a = layer.split()[3].filter(ImageFilter.GaussianBlur(blur))
    a = a.point(lambda v: int(v * opacity))
    sh = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    sh.putalpha(a)
    return ImageChops.offset(sh, offset[0], offset[1])


def glow(size, at, radius, colour, strength):
    g = Image.new("L", (size, size), 0)
    ImageDraw.Draw(g).ellipse(
        [at[0] - radius, at[1] - radius, at[0] + radius, at[1] + radius], fill=strength)
    g = g.filter(ImageFilter.GaussianBlur(radius * 0.55))
    layer = Image.new("RGBA", (size, size), colour + (0,))
    layer.putalpha(g)
    return layer


def bezier(start, ctrl, end, steps=80):
    pts = []
    for i in range(steps + 1):
        t = i / float(steps)
        u = 1 - t
        pts.append((u * u * start[0] + 2 * u * t * ctrl[0] + t * t * end[0],
                    u * u * start[1] + 2 * u * t * ctrl[1] + t * t * end[1]))
    return pts


def arrow_head(d, at, towards, size, colour):
    """A solid triangle at `at`, pointing along the direction `towards`."""
    ang = math.atan2(towards[1], towards[0])
    tip = (at[0] + math.cos(ang) * size, at[1] + math.sin(ang) * size)
    left = (at[0] + math.cos(ang + 2.5) * size, at[1] + math.sin(ang + 2.5) * size)
    right = (at[0] + math.cos(ang - 2.5) * size, at[1] + math.sin(ang - 2.5) * size)
    d.polygon([(p[0] * SS, p[1] * SS) for p in (tip, left, right)], fill=colour)


def swap_arc(d, a, b, lift, colour, width):
    """The exchange: one arc, an arrowhead at each end.

    Two spirits trading sockets is a single swap, not two - the arc is drawn
    as one stroke for exactly that reason.
    """
    ctrl = ((a[0] + b[0]) / 2.0, (a[1] + b[1]) / 2.0 + lift)
    pts = bezier(a, ctrl, b)
    d.line([(p[0] * SS, p[1] * SS) for p in pts], fill=colour, width=width * SS,
           joint="curve")
    arrow_head(d, pts[3], (pts[0][0] - pts[6][0], pts[0][1] - pts[6][1]), 17, colour)
    arrow_head(d, pts[-4], (pts[-1][0] - pts[-7][0], pts[-1][1] - pts[-7][1]), 17, colour)


def font(size):
    """Georgia Bold - the face the Quant Broker tile already uses."""
    try:
        return ImageFont.truetype(TITLE_FONT, size)
    except (OSError, IOError):
        return ImageFont.load_default()


def scrim(size, top, colour, strength):
    """A soft dark band along the bottom so the caption stays readable."""
    g = Image.new("L", (1, size), 0)
    for y in range(top, size):
        t = (y - top) / float(size - top)
        g.putpixel((0, y), int(strength * (t ** 1.35)))
    layer = Image.new("RGBA", (size, size), colour + (0,))
    layer.putalpha(g.resize((size, size)))
    return layer


def tracked(d, text, centre, f, fill, tracking, shadow):
    """Letterspaced caps - PIL has no tracking, so glyphs are placed one by one."""
    widths = [d.textlength(ch, font=f) for ch in text]
    x = centre[0] - (sum(widths) + tracking * (len(text) - 1)) / 2.0
    for ch, w in zip(text, widths):
        d.text((x + shadow[0], centre[1] + shadow[1]), ch, font=f, fill=shadow[2],
               anchor="lm")
        d.text((x, centre[1]), ch, font=f, fill=fill, anchor="lm")
        x += w + tracking


def caption(base, accent, shade):
    S = base.size[0]
    base.alpha_composite(scrim(S, S - 170, shade, 236))

    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    size = 40
    f = font(size)
    while d.textlength(TITLE, font=f) > S - 88 and size > 20:
        size -= 1
        f = font(size)
    d.text((S // 2 + 2, 432), TITLE, font=f, fill=(0, 0, 0, 160), anchor="mm")
    d.text((S // 2, 430), TITLE, font=f, fill=(240, 246, 234, 255), anchor="mm")

    tracked(d, SUBTITLE, (S // 2, 470), font(15), accent + (255,), 5.0,
            (1, 1, (0, 0, 0, 150)))
    base.alpha_composite(layer)


def rounded_mask(size, radius):
    m = Image.new("L", (size * SS, size * SS), 0)
    ImageDraw.Draw(m).rounded_rectangle(
        [0, 0, size * SS - 1, size * SS - 1], radius=radius * SS, fill=255)
    return m.resize((size, size), Image.LANCZOS)


def outline(size, radius, colour, width):
    layer = Image.new("RGBA", (size * SS, size * SS), (0, 0, 0, 0))
    inset = width * SS // 2
    ImageDraw.Draw(layer).rounded_rectangle(
        [inset, inset, size * SS - inset, size * SS - inset],
        radius=radius * SS, outline=colour + (255,), width=width * SS)
    return layer.resize((size, size), Image.LANCZOS)


def main():
    S = OUT_SIZE
    base = tiled("BGpantheon.jpg", S).convert("RGBA")
    base.alpha_composite(Image.new("RGBA", (S, S), (12, 26, 20, 104)))

    icons = asset("icons.png").convert("RGBA")
    tiles = asset("spellBG.png").convert("RGBA")

    tw, th = TILE_W * SCALE, TILE_H * SCALE
    total = tw * 3 + GAP * 2
    x0 = (S - total) // 2
    y_mid = 236

    base.alpha_composite(glow(S, (S // 2, y_mid), 196, GOLD, 92))

    slots = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    centres = []
    for i, (gcol, grow) in enumerate(GODS):
        x = x0 + i * (tw + GAP)
        y = y_mid - th // 2 + SLOT_STAGGER[i] * SCALE

        cell = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
        cell.alpha_composite(slot_tile(tiles, i % 4, 1, SCALE))
        god = icon(icons, gcol, grow, SCALE)
        cell.alpha_composite(god, ((tw - god.width) // 2, (th - god.height) // 2 - 6))

        # the worship gem the game shows in the corner of a slotted spirit
        gx, gy = GEMS[i]
        gem = icons.crop((gx, gy, gx + GEM_PX, gy + GEM_PX))
        gem = gem.resize((GEM_PX * SCALE, GEM_PX * SCALE), Image.NEAREST)
        gem.putalpha(gem.split()[3].point(lambda v: int(v * 0.85)))
        cell.alpha_composite(gem, (18 * SCALE, th - gem.height - 8 * SCALE))

        slots.alpha_composite(cell, (x, y))
        centres.append((x + tw // 2, y + th // 2))

    base.alpha_composite(drop_shadow(slots, (5, 7), 6, 0.7))
    base.alpha_composite(slots)

    # --- the two that trade places ---------------------------------------
    arc = Image.new("RGBA", (S * SS, S * SS), (0, 0, 0, 0))
    ad = ImageDraw.Draw(arc)
    top = min(c[1] for c in centres) - th // 2
    swap_arc(ad, (centres[0][0], top - 18), (centres[2][0], top - 10),
             -84, GOLD + (245,), 8)
    base.alpha_composite(arc.resize((S, S), Image.LANCZOS))

    caption(base, GOLD, (10, 18, 14))

    borders = asset("shadedBorders.png").convert("RGBA").resize((S, S), Image.BICUBIC)
    base.alpha_composite(borders)
    base.alpha_composite(outline(S, 46, BORDER, 7))
    base.putalpha(ImageChops.multiply(base.split()[3], rounded_mask(S, 46)))

    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "mod", "thumbnail.png")
    base.save(out, "PNG", optimize=True)
    print("wrote %s (%dx%d, %d bytes)" % (out, S, S, os.path.getsize(out)))


if __name__ == "__main__":
    main()
