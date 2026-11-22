#!/usr/bin/env python3
"""Hladina přehrady podle terénu (Lipno u Frymburku, Orlík u Zvíkova).

Hladina je jedna plochá plocha (Orlík 353,00 m n. m.; Lipno u Frymburku 725,60 m n. m.; dno přehrady je v terénu RUIAN už na 724,2 m).
Zaplavená oblast se bere z terénu samotného: souvislá oblast pod touto výškou, navazující na přehradu.
Dva soubory: historický terén (CO a SMO5, společná hladina) a současný terén (RUIAN, přípona _RUIAN). Okraj hladiny tak vždy leží na vrstevnici hladiny a nikdy nezasahuje do svahu.
Okraj je o jednu buňku (2 m) zasunutý pod terén, aby mezi hladinou a terénem nebyla mezera.
  python3 tools/build_water.py           # vytvoří src/assets/modely/{Frymburk,Zvikov}_Vltava_soucasny_tok[_RUIAN].glb
Terén se čte z src/assets/test/*_base_{CO,SMO5,RUIAN}.glb (výška y = n. m. − OFFSET).
"""
import json, struct, sys, os
import numpy as np
from scipy import ndimage as ndi
from scipy.interpolate import LinearNDInterpolator
from skimage import measure
import shapely
from shapely.geometry import Polygon
import mapbox_earcut as earcut

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
A = os.path.join(ROOT, 'src', 'assets')
CELL = 2.0
CFG = {
    'Frymburk': {'level': {'': 725.60, '_RUIAN': 725.60}, 'offset': 690.0, 'terr': {'CO': 'DMR_CO', 'SMO5': 'DMR_SMO5', 'RUIAN': 'DMR_RUIAN'}},
    'Zvikov': {'level': {'': 353.00, '_RUIAN': 353.00}, 'offset': 0.0, 'terr': {'CO': 'DMR_1953_1', 'SMO5': 'DMR_1953_1', 'RUIAN': 'dmr5g_1'}},
}
CT = {5123: '<u2', 5125: '<u4', 5126: '<f4'}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}

def load(p):
    d = open(p, 'rb').read()
    jl, _ = struct.unpack('<II', d[12:20])
    return json.loads(d[20:20 + jl]), d[20 + jl + 8:]

def acc(j, b, i):
    a = j['accessors'][i]; v = j['bufferViews'][a['bufferView']]; n = NC[a['type']]
    dt = np.dtype(CT[a['componentType']]); st = v.get('byteStride') or n * dt.itemsize
    off = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    raw = np.frombuffer(b, np.uint8, a['count'] * st, off).reshape(a['count'], st)[:, :n * dt.itemsize]
    return np.ascontiguousarray(raw).view(dt).reshape(a['count'], n)

def terrain(path, node):
    j, b = load(path)
    for n in j['nodes']:
        if n.get('name') == node and 'mesh' in n:
            return acc(j, b, j['meshes'][n['mesh']]['primitives'][0]['attributes']['POSITION']).astype(float)
    raise KeyError(node)

GROUPS = {'': ['CO', 'SMO5'], '_RUIAN': ['RUIAN']}

def build(name, suffix):
    c = CFG[name]; L = c['level'][suffix] - c['offset']; LR = c['level']['_RUIAN'] - c['offset']
    P = {k: terrain(os.path.join(A, 'test', f'{name}_base_{k}.glb'), n) for k, n in c['terr'].items()}
    allp = np.vstack(list(P.values()))
    xs = np.arange(np.floor(allp[:, 0].min()) - 2, allp[:, 0].max() + 2, CELL)
    zs = np.arange(np.floor(allp[:, 2].min()) - 2, allp[:, 2].max() + 2, CELL)
    X, Z = np.meshgrid(xs, zs)
    H = {k: LinearNDInterpolator(p[:, [0, 2]], p[:, 1])(X, Z) for k, p in P.items()}
    low = {k: np.nan_to_num(h, nan=1e9) < (L if k in GROUPS[suffix] else LR) for k, h in H.items()}
    lowR = np.nan_to_num(H['RUIAN'], nan=1e9) < LR
    # přehrada = velké souvislé oblasti pod hladinou v současném terénu (RUIAN), pak se hledají v ostatních variantách
    lab, n = ndi.label(lowR); sz = ndi.sum(lowR, lab, range(1, n + 1))
    seed = np.isin(lab, [i + 1 for i, s in enumerate(sz) if s * CELL ** 2 > 100000])
    flood = {}
    for k in GROUPS[suffix]:
        lab, n = ndi.label(low[k]); ov = np.unique(lab[seed & low[k]]); ov = ov[ov > 0]
        if not len(ov):   # hladina pod dnem přehrady v daném terénu: hledat souvislou oblast navazující na přehradu v okolí
            near = ndi.binary_dilation(seed, iterations=int(60 / CELL)); ov = np.unique(lab[near & low[k]]); ov = ov[ov > 0]
        keep = [i for i in ov if (near_ok := True) and (lab == i).sum() * CELL ** 2 > 2000]
        flood[k] = np.isin(lab, keep)
    U = np.zeros_like(seed)
    for k in GROUPS[suffix]: U |= flood[k]
    U2 = ndi.binary_dilation(U, iterations=1)
    ha = lambda m: round(m.sum() * CELL ** 2 / 1e4, 1)
    print(f'{name}{suffix}: hladina {L + c["offset"]:.2f} m n. m. (y={L:.2f}), plocha {ha(U2)} ha; zaplaveno ' + ', '.join(f'{k} {ha(flood[k])}' for k in GROUPS[suffix]) + ' ha')
    for k in GROUPS[suffix]:   # kontrola: viditelná hladina nad terénem, který není zaplavený (plave ve vzduchu)
        hover = U2 & low[k] & ~flood[k]
        print(f'  {k}: plocha hladiny nad nezaplaveným nižším terénem {ha(hover)} ha')
    # polygony: konturování masky, sudé/liché plnění
    pad = np.pad(U2, 1)
    rings = [r for r in measure.find_contours(pad.astype(float), 0.5) if len(r) >= 4]
    polys = []
    for r in rings:
        pts = np.c_[xs[0] + (r[:, 1] - 1) * CELL, zs[0] + (r[:, 0] - 1) * CELL]
        p = Polygon(pts)
        if p.is_valid and p.area > 0 or (p := p.buffer(0)).area > 0: polys.append(p)
    polys.sort(key=lambda p: -p.area)
    geom = Polygon()
    for p in polys: geom = geom.symmetric_difference(p)
    geom = geom.simplify(1.0)
    geoms = [g for g in (geom.geoms if hasattr(geom, 'geoms') else [geom]) if g.area > 200]
    V = []; T = []
    for g in geoms:
        rings_ = [np.array(g.exterior.coords)[:-1]] + [np.array(r.coords)[:-1] for r in g.interiors]
        verts = np.vstack(rings_); ends = np.cumsum([len(r) for r in rings_]).astype(np.uint32)
        tri = np.array(earcut.triangulate_float64(verts, ends), dtype=np.int64).reshape(-1, 3) + sum(len(v) for v in V)
        V.append(verts); T.append(tri)
    V = np.vstack(V); T = np.vstack(T)
    # natočení trojúhelníků normálou nahoru (+y)
    a, b_, c_ = V[T[:, 0]], V[T[:, 1]], V[T[:, 2]]
    cy = (b_[:, 1] - a[:, 1]) * (c_[:, 0] - a[:, 0]) - (b_[:, 0] - a[:, 0]) * (c_[:, 1] - a[:, 1])
    T[cy < 0] = T[cy < 0][:, [0, 2, 1]]
    pos = np.c_[V[:, 0], np.full(len(V), L), V[:, 1]].astype('<f4')
    nor = np.tile(np.array([0, 1, 0], '<f4'), (len(V), 1))
    idx = T.astype('<u4').ravel()
    binb = pos.tobytes() + nor.tobytes() + idx.tobytes()
    j = {'asset': {'version': '2.0', 'generator': 'tools/build_water.py'}, 'scene': 0, 'scenes': [{'nodes': [0]}],
         'nodes': [{'name': 'Vltava_soucasny_tok', 'mesh': 0}],
         'meshes': [{'name': 'Vltava_soucasny_tok', 'primitives': [{'attributes': {'POSITION': 0, 'NORMAL': 1}, 'indices': 2, 'material': 0}]}],
         'materials': [{'name': 'Vltava_soucasny_tok', 'alphaMode': 'BLEND', 'doubleSided': False,
                        'pbrMetallicRoughness': {'baseColorFactor': [0.0, 0.6627450980392157, 0.9019607843137255, 0.5], 'metallicFactor': 0.0, 'roughnessFactor': 1.0},
                        'extensions': {'KHR_materials_unlit': {}}}],
         'extensionsUsed': ['KHR_materials_unlit'],
         'accessors': [{'bufferView': 0, 'componentType': 5126, 'count': len(V), 'type': 'VEC3', 'min': pos.min(0).tolist(), 'max': pos.max(0).tolist()},
                       {'bufferView': 1, 'componentType': 5126, 'count': len(V), 'type': 'VEC3'},
                       {'bufferView': 2, 'componentType': 5125, 'count': len(idx), 'type': 'SCALAR'}],
         'bufferViews': [{'buffer': 0, 'byteOffset': 0, 'byteLength': pos.nbytes, 'target': 34962},
                         {'buffer': 0, 'byteOffset': pos.nbytes, 'byteLength': nor.nbytes, 'target': 34962},
                         {'buffer': 0, 'byteOffset': pos.nbytes * 2, 'byteLength': len(idx) * 4, 'target': 34963}],
         'buffers': [{'byteLength': len(binb)}]}
    js = json.dumps(j, separators=(',', ':')).encode()
    while len(js) % 4: js += b' '
    out = os.path.join(A, 'modely', f'{name}_Vltava_soucasny_tok{suffix}.glb')
    open(out, 'wb').write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(binb)) + struct.pack('<II', len(js), 0x4E4F534A) + js +
                          struct.pack('<II', len(binb), 0x004E4942) + binb)
    print(f'  -> {out}: {len(V)} vrcholů, {len(T)} trojúhelníků, {os.path.getsize(out) // 1024} kB')
    return U2, xs, zs, H, L

if __name__ == '__main__':
    for n in (sys.argv[1:] or CFG):
        for sfx in GROUPS: build(n, sfx)
