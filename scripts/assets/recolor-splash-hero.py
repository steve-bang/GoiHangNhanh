#!/usr/bin/env python3
"""Đổi tông xanh ngọc (jade) của ảnh minh họa Splash sang cam chủ đạo (D-20), giữ độ sáng/độ đậm.

Chỉ đổi dải màu xanh ngọc (hue 125-205) sang dải cam theo độ sáng, mức giữa = `brand.primary` (#EE4D2D). KHÔNG đổi:
logo Shopee/TikTok/Lazada (layout.md mục 3.1: không sửa logo sàn) và hai chậu cây (xanh tự nhiên).

Dùng: python3 scripts/assets/recolor-splash-hero.py <ảnh-xanh.webp> <ảnh-ra.webp>
Cần Pillow + numpy. Nguồn xanh được giữ ở docs/assets/brand/splash/splash-hero-jade.webp.
"""
import sys

import numpy as np
from PIL import Image

# Vùng giữ nguyên (x0, y0, x1, y1) trên ảnh 1024x1050: logo sàn + hai chậu cây.
KEEP = [
    (670, 5, 790, 125),  # Shopee
    (800, 55, 915, 170),  # TikTok
    (840, 185, 960, 305),  # Lazada
    (0, 460, 195, 660),  # cây trái
    (895, 575, 1024, 745),  # cây phải
]


def main(src, dst):
    im = Image.open(src).convert('RGBA')
    rgba = np.asarray(im).astype(np.float32)
    hsv = np.asarray(im.convert('RGB').convert('HSV')).astype(np.float32)
    h = hsv[..., 0] * 360.0 / 255.0
    s = hsv[..., 1] / 255.0
    # Trọng số: 1 trong 140-190, giảm mượt về 0 ở 125 và 205.
    w = np.clip((h - 125) / 15, 0, 1) * np.clip((205 - h) / 15, 0, 1)
    # Điểm ảnh gần như không màu (viền trắng/xám) không bị đẩy sang tông cam.
    w *= np.clip(s / 0.08, 0, 1)
    for x0, y0, x1, y1 in KEEP:
        w[y0:y1, x0:x1] = 0
    # Độ sáng nguồn -> dải cam: tối = brand.deep, 1.0 = brand.primary (độ sáng trung vị của mảng xanh
    # đậm như áo yếm), sáng = cam nhạt rồi gần trắng. Chỉ xoay hue sẽ ra nâu vì xanh nguồn rất tối.
    rgb = np.asarray(im.convert('RGB')).astype(np.float32)
    y = rgb @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    solid = (w >= 1) & (s > 0.4)
    y_ref = float(np.median(y[solid]))
    t = y / y_ref
    stops_t = np.array([0.0, 0.35, 1.0, 1.8, 2.6])
    stops_c = np.array(
        [(48, 16, 6), (124, 45, 18), (238, 77, 45), (255, 184, 163), (255, 245, 240)],
        dtype=np.float32,
    )  # brand.deep #7C2D12 ... brand.primary #EE4D2D
    ramp = np.stack([np.interp(t, stops_t, stops_c[:, i]) for i in range(3)], axis=-1)
    out = rgb * (1 - w[..., None]) + ramp * w[..., None]
    out = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGB')
    res = np.concatenate([np.asarray(out), rgba[..., 3:4].astype(np.uint8)], axis=2)
    Image.fromarray(res, 'RGBA').save(dst, 'WEBP', quality=88, method=6)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
