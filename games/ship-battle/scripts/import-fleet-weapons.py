"""Offline import of weapon fields only from one matching public Erkul snapshot.

Usage: python3 scripts/import-fleet-weapons.py /path/to/public/assets
Pillow is used only by this offline model-anchor calibration step, never in CI/runtime.
"""
from pathlib import Path
import collections
import hashlib
import json
import math
import re
import sys
import subprocess
import unicodedata
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1])
load_path, components_path = source / 'ship-loadouts-erkul.json', source / 'component-matrix-erkul.json'
load, components = json.loads(load_path.read_text()), json.loads(components_path.read_text())
assert load['version'] == components['version'], 'Do not mix snapshot versions'
ships = json.loads((ROOT / 'src/data/ships.json').read_text())
assets = json.loads((ROOT / 'public/assets/ships/manifest.json').read_text())['assets']
artwork_geometry = {row['shipId']: row for row in json.loads((ROOT / 'docs/starjump-sources.json').read_text())['assets']}
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
provenance = {'version': 1, 'gameVersion': load['version'], 'snapshotDate': load['fetched_at'],
              'inputSHA256': {p.name: sha(p) for p in (load_path, components_path)}}

def norm(text):
    return ''.join(c for c in unicodedata.normalize('NFKD', text).lower() if c.isalnum())

def short(text):
    text = re.sub(r'^(?:Aegis|Anvil|Aopoa|Argo|Banu|C\.O\.|Crusader|Drake|Esperia|Gatac|Greycat|Kruger|MISC|Mirai|Origin|RSI|Tumbril|Vanduul)\s+', '', text)
    return norm(text)

explicit = {
 'hornet-mk2': 'Anvil F7C Hornet Mk II', 'f7c-hornet': 'Anvil F7C Hornet Mk I',
 'f7c-s-hornet-ghost': 'Anvil F7C-S Hornet Ghost Mk I', 'f7c-r-hornet-tracker': 'Anvil F7C-R Hornet Tracker Mk I',
 'f7c-m-super-hornet': 'Anvil F7C-M Super Hornet Mk I', 'f7c-hornet-wildfire': 'Anvil F7C Hornet Wildfire Mk I',
 'f7c-m-super-hornet-heartseeker': 'Anvil F7C-M Hornet Heartseeker Mk I',
 'f7cm-hornet-heartseeker-mkii': 'Anvil F7C-M Hornet Heartseeker Mk II',
 'f7a-hornet': 'Anvil F7A Hornet Mk I', 'm50': 'Origin M50 Interceptor',
 '85x': 'Origin 85X Limited', '600i-explorer': 'Origin 600i', 'p-52-merlin': 'Kruger P-52 Merlin',
 'p72-archimedes': 'Kruger P-72 Archimedes', 'p72-archimedes-emerald': 'Kruger P-72 Archimedes Emerald',
 'retaliator-bomber': 'Aegis Retaliator', 'c8x-pisces-expedition': 'Anvil C8X Pisces Expedition',
 'c8r': 'Anvil C8R Pisces Rescue',
 **{f'constellation-{suffix}': f'RSI Constellation Mk IV {name}' for suffix, name in [('andromeda','Andromeda'),('aquila','Aquila'),('taurus','Taurus'),('phoenix','Phoenix'),('phoenix-emerald','Phoenix Emerald')]},
}
variants = {
 'valkyrie-liberator':'valkyrie', 'mustang-alpha-vindicator':'mustang-alpha', 'pirate-gladius':'gladius',
 'cutlass-black-2949-best-in-show':'cutlass-black', 'caterpillar-2949-best-in-show':'caterpillar',
 'hammerhead-2949-best-in-show':'hammerhead', 'reclaimer-2949-best-in-show':'reclaimer',
 'mole-carbon':'mole', 'mole-talus':'mole', 'carrack-c8x':'carrack', 'carrack-expedition-c8x':'carrack-expedition',
 'f8c-lightning-executive':'f8c-lightning',
}
rows = list(load['ships'].values())
full_names = {short(s['name']): s for s in rows}
aliases = collections.defaultdict(list)
for s in rows:
    for name in (s.get('shortName',''), s.get('localName','')):
        if name:
            aliases[norm(name)].append(s)

def match(ship):
    if ship['id'] in explicit:
        return load['ships'][explicit[ship['id']]], 'explicit-alias'
    found = full_names.get(short(ship['name'])) or full_names.get(norm(ship['id']))
    if found:
        return found, 'direct'
    for name in (ship['name'],ship['id']):
        candidates = {s['name']:s for s in aliases[norm(name)]}
        if len(candidates) == 1:
            return next(iter(candidates.values())), 'unique-alias'
    return None, 'missing'

def number(value):
    try:
        return float(value.replace(',',''))
    except ValueError:
        return None

catalog = {}
for category in ('ship-weapon','missile'):
    for row in components['categories'][category]['rows']:
        v = row['values']
        if category == 'missile' and v[3] in ('地面导弹','炸弹'):
            continue
        size = int(v[0])
        key = f"s{size}-" + re.sub(r'[^a-z0-9]+','-',v[1].lower()).strip('-')
        entry = {'id':key,'name':v[1],'nameZh':v[2],'size':size,'type':v[3],
                 'damage':number(v[5 if category=='ship-weapon' else 6]),
                 'speed':number(v[8]),'category':'gun' if category=='ship-weapon' else 'ordnance'}
        if category == 'ship-weapon':
            entry.update(dps=number(v[6]),rpm=number(v[7]),ammoCapacity=number(v[9]))
        catalog[key] = entry

weapon_lookup = {(w['size'],norm(w['nameZh'])):w for w in catalog.values()}
loose_lookup = {(w['size'],re.sub(r's\d+', '',norm(w['nameZh']))):w for w in catalog.values()}

def weapon_for(size, text):
    found = weapon_lookup.get((size,norm(text))) or loose_lookup.get((size,re.sub(r's\d+', '',norm(text))))
    if found:
        return found
    if '焦糊' in text:
        return next(w for w in catalog.values() if w['size']==size and w['name'].startswith('Singe Cannon'))
    return None

loadouts, missing_weapons = {}, []
for ship in ships:
    original, mode = match(ship)
    variant = variants.get(ship['id'])
    if variant:
        original, _ = match(next(s for s in ships if s['id']==variant))
        mode = 'paint-or-package-variant'
    record = {'status':'snapshot' if original else 'fallback','match':mode,'systems':[]}
    if variant:
        record['variantOf'] = variant
    if original:
        record['sourceShip'] = original['name']
        for row in original['rows']:
            if row['label'] not in ('武器','导弹'):
                continue
            parsed = re.fullmatch(r'(\d+)组 S(\d+) (.+)',row['value'])
            assert parsed, (ship['id'],row)
            count, size, text = int(parsed[1]), int(parsed[2]), parsed[3]
            weapon = weapon_for(size,text)
            if not weapon:
                missing_weapons.append((ship['id'],row['value'])); continue
            record['systems'].append({'weaponId':weapon['id'],'count':count})
        if not record['systems']:
            record['status'] = 'unarmed'
            record['note'] = '公开快照无舰载作战武器；保留模型，战斗抽签不凭空装炮。'
    else:
        record['note'] = '同版本公开快照缺项，保留当前已确认模拟配装；不宣称原作精确武器。'
    if ship['id']=='idris-p':
        record['note'] = '基础P公开配装＋用户已确认K套件持续光束，不冒称基础P自带光束。'
    if ship['id'].startswith('retaliator-'):
        record['note'] = '基础舰公开炮塔＋用户已确认鱼雷模块；模块不在此聚合表内，保留原已确认鱼雷。'
    loadouts[ship['id']] = record
assert not missing_weapons, missing_weapons

# Existing calibrated firing points remain first. New points are explicit 2D
# model estimates inside the eroded alpha silhouette, never claimed as 3D sockets.
anchors = {}
anchor_path = ROOT/'src/data/weapon-anchor-layouts.json'
previous_anchors = json.loads(anchor_path.read_text())['ships'] if anchor_path.exists() else {}
for ship, asset in zip(ships,assets):
    assert ship['id']==asset['shipId']
    # Socket metadata belongs to the calibrated artwork, not mutable physical stats.
    # Otherwise a real-data length crossing 35m can reclassify every generated anchor.
    layout_length = artwork_geometry[ship['id']]['length']
    points = [p.copy() for p in previous_anchors.get(ship['id'],[]) if not p['id'].startswith('model-weapon-')] or [{'id':m['id'],'x':m['x'],'y':m['y'],'facing':m['facing'],'kind':m['kind'],'arc':m['arc'],'role':m.get('role','main')} for m in ship['mounts']]
    image = Image.open(ROOT/'public'/asset['url']).convert('RGBA')
    mask=image.getchannel('A').resize((100,100),Image.Resampling.NEAREST).filter(ImageFilter.MinFilter(5))
    rot=math.pi/2-math.radians(asset['noseDegrees']);c,s=math.cos(rot),math.sin(rot)
    sideways=abs(math.sin(math.radians(asset['noseDegrees'])))>.7
    width,height=(ship['length'],ship['beam']) if sideways else (ship['beam'],ship['length'])
    candidates=[]
    for y in range(4,97,4):
        for x in range(4,97,4):
            if mask.getpixel((x,y))<220:continue
            ix=(x/100-asset['center']['x'])*width;iy=(y/100-asset['center']['y'])*height
            candidates.append({'x':round((s*ix+c*iy)/ship['beam'],6),'y':round(-(c*ix-s*iy)/ship['length'],6)})
    def solid(point, margin=1, threshold=32):
        wx,wy=-point['y']*ship['length'],point['x']*ship['beam']
        u=(c*wx+s*wy)/width+asset['center']['x'];v=(-s*wx+c*wy)/height+asset['center']['y']
        px,py=int(u*image.width),int(v*image.height)
        return all(0<=px+dx<image.width and 0<=py+dy<image.height and image.getpixel((px+dx,py+dy))[3]>=threshold for dx in range(-margin,margin+1) for dy in range(-margin,margin+1))
    candidates=[point for point in candidates if solid(point,2,220)]
    if not candidates:
        # Very thin silhouettes can vanish in the eroded low-resolution mask.
        # Reuse their already opaque model points instead of keeping a floating origin.
        for point in points:
            wx,wy=-point['y']*ship['length'],point['x']*ship['beam']
            u=(c*wx+s*wy)/width+asset['center']['x'];v=(-s*wx+c*wy)/height+asset['center']['y']
            px,py=min(image.width-1,max(0,int(u*image.width))),min(image.height-1,max(0,int(v*image.height)))
            if solid(point) and not any(q['x']==point['x'] and q['y']==point['y'] for q in candidates):candidates.append({'x':point['x'],'y':point['y']})
    for point in points:
        wx,wy=-point['y']*ship['length'],point['x']*ship['beam']
        u=(c*wx+s*wy)/width+asset['center']['x'];v=(-s*wx+c*wy)/height+asset['center']['y']
        px,py=min(image.width-1,max(0,int(u*image.width))),min(image.height-1,max(0,int(v*image.height)))
        if not solid(point) and candidates:
            nearest=min(candidates,key=lambda q:((point['x']-q['x'])*ship['beam'])**2+((point['y']-q['y'])*ship['length'])**2)
            point.update(nearest)
    for n in range(24):
        if not candidates:break
        best=max(candidates,key=lambda p:min(((p['x']-q['x'])**2+(p['y']-q['y'])**2 for q in points),default=1))
        candidates.remove(best)
        points.append({'id':f'model-weapon-{n+1}',**best,'facing':0,'kind':'turret' if layout_length>=35 else 'laser','arc':300 if layout_length>=35 else 85,'role':'main'})
    anchors[ship['id']]=points

def save(name, value):
    (ROOT/'src/data'/name).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
save('weapon-catalog.json',{**provenance,'weapons':catalog})
save('fleet-weapon-loadouts.json',{**provenance,'ships':loadouts})
save('weapon-anchor-layouts.json',{'version':1,'note':'Original calibrated firing points followed by alpha-safe 2D model estimates, not verified original 3D sockets.','ships':anchors})
print(json.dumps({'ships':len(ships),'weapons':len(catalog),'statuses':dict(collections.Counter(r['status'] for r in loadouts.values())),
                  'fallback':[k for k,v in loadouts.items() if v['status']=='fallback'],
                  'unarmed':[k for k,v in loadouts.items() if v['status']=='unarmed']},ensure_ascii=False))
if (source.parent/'data/shipmatrix-index.json').exists() and (source/'ship-supplemental.json').exists():
    subprocess.run(['node',str(ROOT/'scripts/import-reference-armaments.mjs'),str(source)],check=True)
