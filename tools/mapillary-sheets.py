# Lays the Mapillary photos picked by tools/fetch-mapillary.mjs out on contact sheets, six buildings per sheet,
# each row labelled with the building's OpenStreetMap id and name, so their real look can be read off quickly
# and written into public-data/facades.json.
#   python tools/mapillary-sheets.py            → .cache/mapillary/sheets/sheet_000.jpg … + sheets.json
#   python tools/mapillary-sheets.py --todo     → only buildings not yet in public-data/facades.json
#   python tools/mapillary-sheets.py --src wikimedia   → the Wikimedia Commons photos of notable places (tools/fetch-wikimedia.mjs), 3 per row
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

SRC = sys.argv[sys.argv.index('--src') + 1] if '--src' in sys.argv else 'mapillary'
root = os.getcwd(); cache = os.path.join(root, '.cache', SRC); img = os.path.join(cache, 'img'); out = os.path.join(cache, 'sheets')
os.makedirs(out, exist_ok=True)
picks = json.load(open(os.path.join(cache, 'picks.json'), encoding='utf-8'))
done = {}
fp = os.path.join(root, 'public-data', 'facades.json')
if '--todo' in sys.argv and os.path.exists(fp): done = json.load(open(fp, encoding='utf-8'))
items = [p for k, p in sorted(picks.items(), key=lambda kv: (kv[1]['tile'], kv[0])) if k not in done]
W, H, LBL, PER = 480, 360, 34, 6
COLS = 3 if SRC == 'wikimedia' else 2
try: font = ImageFont.truetype('arial.ttf', 22)
except Exception:
    try: font = ImageFont.truetype('DejaVuSans.ttf', 22)
    except Exception: font = ImageFont.load_default()
for f in os.listdir(out):
    if f.startswith('sheet_'): os.remove(os.path.join(out, f))
index = {}
for s in range(0, len(items), PER):
    group = items[s:s + PER]; sheet = Image.new('RGB', (W * COLS, (H + LBL) * len(group)), (24, 24, 26)); d = ImageDraw.Draw(sheet)
    for r, p in enumerate(group):
        y = r * (H + LBL); d.text((8, y + 6), f"{p['id']}  ·  {p['name']}", fill=(255, 230, 120), font=font)
        for c, im in enumerate(p['images'][:COLS]):
            try: ph = Image.open(os.path.join(img, im['file'])).convert('RGB'); ph.thumbnail((W, H)); sheet.paste(ph, (c * W + (W - ph.width) // 2, y + LBL + (H - ph.height) // 2))
            except Exception: d.text((c * W + 20, y + LBL + 20), 'missing', fill=(200, 80, 80), font=font)
            d.text((c * W + 8, y + LBL + H - 28), f"{im['dist']} m · {im['year']}" + (f" · {im.get('title','')[:28]}" if SRC == 'wikimedia' else ''), fill=(255, 255, 255), font=font)
    name = f'sheet_{s // PER:03d}.jpg'; sheet.save(os.path.join(out, name), quality=82); index[name] = [p['id'] for p in group]
json.dump(index, open(os.path.join(out, 'sheets.json'), 'w'), indent=0)
print(f'{len(index)} contact sheets for {len(items)} buildings in .cache/{SRC}/sheets/')
