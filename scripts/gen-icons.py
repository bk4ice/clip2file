import os
from PIL import Image, ImageDraw, ImageFont

out_dir = os.path.join(os.path.dirname(__file__), '..', 'public', 'icons')
os.makedirs(out_dir, exist_ok=True)

for size in [16, 48, 128]:
    img = Image.new('RGBA', (size, size), (37, 99, 235, 255))
    draw = ImageDraw.Draw(img)

    font_size = int(size * 0.55)
    try:
        font = ImageFont.truetype("arial.ttf", font_size)
    except:
        font = ImageFont.load_default()

    bbox = draw.textbbox((0, 0), "C", font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (size - text_w) / 2 - bbox[0]
    y = (size - text_h) / 2 - bbox[1]
    draw.text((x, y), "C", fill=(255, 255, 255, 255), font=font)

    img.save(os.path.join(out_dir, f'icon{size}.png'))
    print(f'Generated icon{size}.png')
