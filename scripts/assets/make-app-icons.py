#!/usr/bin/env python3
"""Sinh toàn bộ icon ứng dụng từ ảnh nguồn `assets/images/brand-source/icon-source.png` (O-23).

Ảnh nguồn không vuông tuyệt đối và có đốm nhiễu ở viền, nên KHÔNG dùng trực tiếp: script chỉ trích chữ "A" trắng
(kênh xanh dương tách sạch khỏi nền cam/đỏ) rồi dựng lại nền gradient vuông kín với màu lấy mẫu từ nguồn.

Đầu ra:
  assets/images/icon.png                          iOS/chung: 1024, vuông kín, không alpha (hệ điều hành tự bo góc)
  assets/images/adaptive-icon-foreground.png      Android: chữ A trắng, nền trong suốt, nằm trong vùng an toàn
  assets/images/adaptive-icon-background.png      Android: gradient
  assets/images/adaptive-icon-monochrome.png      Android 13+ themed icon
  assets/images/splash/splash-icon.png            splash iOS (hình bo góc, nền trong suốt)
  assets/images/splash/splash-icon-android.png    splash Android 12+ (có đệm, hình chiếm ~40%)
  web/public/{favicon,apple-touch-icon,logo-512}.png

Dùng (từ gốc repo): python3 scripts/assets/make-app-icons.py     Cần Pillow + numpy.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'assets/images/brand-source/icon-source.png'
SIZE = 1024
SS = 4  # siêu lấy mẫu cho cạnh bo góc
RADIUS = 0.2237  # tỉ lệ bo góc kiểu iOS
# Màu gradient lấy mẫu từ nguồn: trái-trên cam, phải-dưới đỏ cam.
C_START = np.array([252, 118, 8], dtype=np.float32)
C_END = np.array([252, 28, 1], dtype=np.float32)
# Chữ A trong ảnh nguồn nằm trong khung này (x0, y0, x1, y1), tọa độ ảnh 1254.
GLYPH_BOX = (200, 330, 1060, 920)
GLYPH_ON_ICON = 0.76  # chiều rộng chữ A / cạnh icon (giữ như nguồn)
GLYPH_ON_ADAPTIVE = 0.56  # vùng an toàn Android ~61%
GLYPH_ON_MONO = 0.56


def gradient(size):
    y, x = np.mgrid[0:size, 0:size].astype(np.float32)
    t = ((x + y) / (2.0 * (size - 1)))[..., None]
    rgb = C_START * (1 - t) + C_END * t
    return Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), 'RGB')


def glyph_alpha():
    """Mặt nạ chữ A (L, 0-255) cắt sát; kênh B ~250 ở chữ trắng, <10 ở nền cam/đỏ."""
    a = np.asarray(Image.open(SRC).convert('RGBA')).astype(np.float32)
    x0, y0, x1, y1 = GLYPH_BOX
    b = a[y0:y1, x0:x1, 2]
    alpha = np.clip((b - 10.0) / (240.0 - 10.0), 0, 1) * (a[y0:y1, x0:x1, 3] / 255.0)
    m = Image.fromarray((alpha * 255).astype(np.uint8), 'L')
    return m.crop(m.getbbox())


def place_glyph(mask, canvas, ratio, color=(255, 255, 255), center_y_shift=0.0):
    """Dán chữ A (màu `color`) vào canvas RGBA trong suốt/hoặc ảnh, rộng `ratio` cạnh, căn giữa theo bbox."""
    w = round(canvas.width * ratio)
    h = round(mask.height * w / mask.width)
    m = mask.resize((w, h), Image.LANCZOS)
    layer = Image.new('RGBA', (w, h), color + (255,))
    layer.putalpha(m)
    x = (canvas.width - w) // 2
    y = (canvas.height - h) // 2 + round(canvas.height * center_y_shift)
    canvas.alpha_composite(layer, (x, y))
    return canvas


def rounded_mask(size):
    big = Image.new('L', (size * SS, size * SS), 0)
    ImageDraw.Draw(big).rounded_rectangle(
        (0, 0, size * SS - 1, size * SS - 1), radius=int(size * SS * RADIUS), fill=255
    )
    return big.resize((size, size), Image.LANCZOS)


def full_icon(size=SIZE):
    base = gradient(size).convert('RGBA')
    return place_glyph(glyph_mask, base, GLYPH_ON_ICON)


def rounded_icon(size):
    im = full_icon(SIZE).resize((size, size), Image.LANCZOS)
    im.putalpha(rounded_mask(size))
    return im


def save(im, rel, mode=None):
    p = ROOT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    if mode:
        im = im.convert(mode)
    im.save(p, optimize=True)
    print('ghi', rel, im.size, im.mode)


glyph_mask = glyph_alpha()

# iOS / chung: RGB, không alpha.
save(full_icon(), 'assets/images/icon.png', 'RGB')

# Android adaptive.
fg = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
save(place_glyph(glyph_mask, fg, GLYPH_ON_ADAPTIVE), 'assets/images/adaptive-icon-foreground.png')
save(gradient(SIZE), 'assets/images/adaptive-icon-background.png', 'RGB')
mono = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
save(place_glyph(glyph_mask, mono, GLYPH_ON_MONO, color=(0, 0, 0)), 'assets/images/adaptive-icon-monochrome.png')

# Splash: hình bo góc trên nền trong suốt.
save(rounded_icon(640), 'assets/images/splash/splash-icon.png')
sp = Image.new('RGBA', (1152, 1152), (0, 0, 0, 0))
inner = rounded_icon(round(1152 * 0.40))
sp.alpha_composite(inner, ((1152 - inner.width) // 2, (1152 - inner.height) // 2))
save(sp, 'assets/images/splash/splash-icon-android.png')

# Website.
save(rounded_icon(64), 'web/public/favicon.png')
save(full_icon().resize((180, 180), Image.LANCZOS), 'web/public/apple-touch-icon.png', 'RGB')
save(rounded_icon(512), 'web/public/logo-512.png')
