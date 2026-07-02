#!/usr/bin/env python3
"""
Generate the App Store banner images and widget preview images for the
Google Photos Slideshow Homey app.

Outputs:
  assets/images/small.png    250x175   (App Store thumbnail)
  assets/images/large.png    500x350   (App Store image)
  assets/images/xlarge.png   1000x700  (App Store hero)
  widgets/slideshow/preview-light.png  400x300
  widgets/slideshow/preview-dark.png   400x300

Requires: Pillow, numpy (both present on the dev machine).
Run: python3 scripts/gen-assets.py
"""

import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ---- palette ---------------------------------------------------------------
BG_TL = (91, 147, 246)     # brand blue (top-left)
BG_BR = (24, 45, 110)      # deep navy (bottom-right)
SKY_TOP = (191, 230, 255)
SKY_BOT = (255, 233, 194)
SUN = (253, 185, 46)
MTN_BACK = (120, 198, 160)
MTN_FRONT = (46, 125, 91)
WHITE = (255, 255, 255)
DOTS = [(66, 133, 244), (234, 67, 53), (251, 188, 5), (52, 168, 83)]


# ---- gradients -------------------------------------------------------------
def grad_diagonal(w, h, c0, c1):
    yy, xx = np.mgrid[0:h, 0:w]
    t = ((xx / max(w - 1, 1)) + (yy / max(h - 1, 1))) / 2.0
    t = t[..., None]
    arr = (np.array(c0) * (1 - t) + np.array(c1) * t)
    return arr.astype(np.uint8)


def grad_vertical(w, h, top, bottom):
    yy = np.linspace(0, 1, h)[:, None, None]
    arr = np.array(top) * (1 - yy) + np.array(bottom) * yy
    arr = np.repeat(arr, w, axis=1)
    return arr.astype(np.uint8)


# ---- fonts -----------------------------------------------------------------
def load_font(size, bold=False):
    try:
        f = ImageFont.truetype("/System/Library/Fonts/SFNS.ttf", size)
        for name in (("Bold", "Heavy", "Semibold") if bold else ("Regular", "Medium")):
            try:
                f.set_variation_by_name(name)
                break
            except Exception:
                continue
        return f
    except Exception:
        path = ("/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold
                else "/System/Library/Fonts/Supplemental/Arial.ttf")
        return ImageFont.truetype(path, size)


# ---- building blocks -------------------------------------------------------
def landscape_card(cw, ch, radius):
    """A stylised photo: sky, sun and mountains, with rounded corners."""
    card = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    sky = Image.fromarray(grad_vertical(cw, ch, SKY_TOP, SKY_BOT)).convert("RGBA")
    card.alpha_composite(sky)

    d = ImageDraw.Draw(card)
    # sun
    r = int(ch * 0.13)
    d.ellipse([cw * 0.66 - r, ch * 0.22 - r, cw * 0.66 + r, ch * 0.22 + r], fill=SUN)
    # mountains
    d.polygon([(0, ch), (cw * 0.34, ch * 0.42), (cw * 0.56, ch * 0.66),
               (cw, ch * 0.5), (cw, ch)], fill=MTN_BACK)
    d.polygon([(0, ch), (cw * 0.22, ch * 0.58), (cw * 0.42, ch * 0.82),
               (cw * 0.66, ch * 0.44), (cw, ch * 0.78), (cw, ch)], fill=MTN_FRONT)

    # rounded-corner mask
    mask = Image.new("L", (cw, ch), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, cw - 1, ch - 1], radius=radius, fill=255)
    card.putalpha(mask)
    return card


def white_card(cw, ch, radius):
    card = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    ImageDraw.Draw(card).rounded_rectangle([0, 0, cw - 1, ch - 1], radius=radius,
                                           fill=(255, 255, 255, 255))
    return card


def paste_rotated_with_shadow(base, card, center, angle, shadow_alpha=95,
                              blur=20, offset=(0, 16)):
    cw, ch = card.size
    # soft shadow (axis-aligned under the card)
    shadow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    sx = center[0] - cw // 2 + offset[0]
    sy = center[1] - ch // 2 + offset[1]
    ImageDraw.Draw(shadow).rounded_rectangle(
        [sx, sy, sx + cw, sy + ch], radius=int(min(cw, ch) * 0.1),
        fill=(0, 0, 0, shadow_alpha))
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur))
    base.alpha_composite(shadow)

    rot = card.rotate(angle, expand=True, resample=Image.BICUBIC)
    rx = center[0] - rot.size[0] // 2
    ry = center[1] - rot.size[1] // 2
    base.alpha_composite(rot, (rx, ry))


# ---- banner ----------------------------------------------------------------
def build_banner():
    W, H = 1000, 700
    img = Image.fromarray(grad_diagonal(W, H, BG_TL, BG_BR)).convert("RGBA")

    # subtle glow behind the photo stack
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([560, 150, 960, 560], fill=(255, 255, 255, 40))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(60)))

    # photo stack (right side)
    cx, cy = 744, 350
    cw, ch = 300, 236
    rad = 26
    paste_rotated_with_shadow(img, white_card(cw, ch, rad), (cx + 26, cy + 8), -13)
    paste_rotated_with_shadow(img, white_card(cw, ch, rad), (cx - 18, cy - 6), 9)
    paste_rotated_with_shadow(img, landscape_card(cw - 16, ch - 16, rad),
                              (cx, cy - 2), -2, shadow_alpha=110, blur=24)

    d = ImageDraw.Draw(img)

    # four brand dots
    dx, dy, dr, gap = 66, 150, 11, 34
    for i, c in enumerate(DOTS):
        d.ellipse([dx + i * gap, dy, dx + i * gap + dr * 2, dy + dr * 2], fill=c)

    # title
    title_font = load_font(74, bold=True)
    d.text((64, 196), "Google Photos", font=title_font, fill=WHITE)
    d.text((64, 278), "Slideshow", font=title_font, fill=WHITE)

    # subtitle
    sub_font = load_font(30, bold=False)
    d.text((66, 392), "Any album, live on your dashboard.",
           font=sub_font, fill=(223, 233, 255))

    img = img.convert("RGB")
    sizes = {
        "assets/images/xlarge.png": (1000, 700),
        "assets/images/large.png": (500, 350),
        "assets/images/small.png": (250, 175),
    }
    for rel, (w, h) in sizes.items():
        out = img.resize((w, h), Image.LANCZOS)
        p = os.path.join(ROOT, rel)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        out.save(p)
        print(f"wrote {rel} ({w}x{h})")


# ---- widget previews -------------------------------------------------------
def build_preview(bg_color, rel):
    W, H = 400, 300
    img = Image.new("RGBA", (W, H), bg_color + (255,))
    card = landscape_card(W - 28, H - 28, 20)
    paste_rotated_with_shadow(img, card, (W // 2, H // 2), 0,
                              shadow_alpha=70, blur=16, offset=(0, 10))
    img = img.convert("RGB")
    p = os.path.join(ROOT, rel)
    img.save(p)
    print(f"wrote {rel} ({W}x{H})")


if __name__ == "__main__":
    build_banner()
    build_preview((238, 240, 244), "widgets/slideshow/preview-light.png")
    build_preview((26, 27, 30), "widgets/slideshow/preview-dark.png")
