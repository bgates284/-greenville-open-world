# Automatic first pass over the Mapillary photos picked by tools/fetch-mapillary.mjs: reads the wall colour off the
# middle of each photo (where the camera was pointing at the building), decides brick vs painted / sided walls when it
# is confident, and merges the result into public-data/facades.json as "src": "auto" entries. Entries written by hand
# (anything without "src": "auto") are never touched, so contact-sheet corrections always win.
#   python tools/mapillary-colours.py
import colorsys, json, os
from PIL import Image

root = os.getcwd(); cache = os.path.join(root, '.cache', 'mapillary'); img = os.path.join(cache, 'img')
picks = json.load(open(os.path.join(cache, 'picks.json'), encoding='utf-8'))
fp = os.path.join(root, 'public-data', 'facades.json')
fac = json.load(open(fp, encoding='utf-8')) if os.path.exists(fp) else {}

def wall_colour(path):
    im = Image.open(path).convert('RGB'); w, h = im.size
    crop = im.crop((int(w * 0.3), int(h * 0.3), int(w * 0.7), int(h * 0.62))).resize((80, 64))  # the building, not sky or road
    q = crop.quantize(colors=5, method=Image.Quantize.MEDIANCUT); pal = q.getpalette()[:15]; counts = sorted(q.getcolors(), reverse=True)
    for n, i in counts:
        r, g, b = pal[i * 3:i * 3 + 3]; hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        if vv < 0.12: continue                                   # deep shadow / windows
        if 0.22 < hh < 0.45 and ss > 0.2: continue               # trees and lawns
        if 0.5 < hh < 0.7 and vv > 0.75 and ss < 0.35: continue  # sky
        return (r, g, b), n / (80 * 64), (hh, ss, vv)
    return None

done = 0; skipped = 0
for key, p in picks.items():
    if key in fac and fac[key].get('src') != 'auto': continue
    votes = []
    for im in p['images']:
        f = os.path.join(img, im['file'])
        if not os.path.exists(f): continue
        try: res = wall_colour(f)
        except Exception: res = None
        if res: votes.append(res)
    if not votes: skipped += 1; continue
    (r, g, b), share, (hh, ss, vv) = max(votes, key=lambda v: v[1])
    hexc = '#%02x%02x%02x' % (r, g, b); entry = None
    if share > 0.18 and (hh < 0.07 or hh > 0.95) and 0.28 < ss < 0.75 and 0.22 < vv < 0.7: entry = {'mat': 'brick'}            # red-brown, moderately saturated
    elif share > 0.25 and ss < 0.22 and vv > 0.55: entry = {'mat': 'vinyl', 'colour': hexc}                                   # light painted / sided wall
    elif share > 0.25 and 0.07 <= hh < 0.17 and ss < 0.45 and vv > 0.5: entry = {'mat': 'plaster', 'colour': hexc}           # tan / beige stucco or painted block
    if entry: entry['src'] = 'auto'; fac[key] = entry; done += 1
    else: skipped += 1
json.dump(fac, open(fp, 'w', encoding='utf-8'), indent=0, sort_keys=True)
print(f'auto colours: {done} buildings set, {skipped} not confident (left to the county record) → public-data/facades.json')
