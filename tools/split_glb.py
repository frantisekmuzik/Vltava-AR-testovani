#!/usr/bin/env python3
"""Rozdělení modelů testovacího režimu na sdílený podklad a vrstvu úlohy.

Podklad (terén, okraj, budovy, kostel, legenda) je pro dané území a období ve všech úlohách shodný,
liší se jen stromy (vyčištěné kolem značek), značky A–D, vrstevnice a popisky vrstevnic.
  python3 tools/split_glb.py <kompletní_model.glb> base <výstup.glb>      # jen podklad
  python3 tools/split_glb.py <kompletní_model.glb> overlay <výstup.glb>   # jen vrstva úlohy
Kompletní modely jsou v repozitáři Vltava-testovani-podklady (Frymburk3D, Zvikov3D).
"""
import json, struct, sys

def load(p):
    d = open(p, 'rb').read()
    jl, _ = struct.unpack('<II', d[12:20])
    j = json.loads(d[20:20 + jl])
    o = 20 + jl + 8
    return j, d[o:]

def is_overlay(name):
    n = (name or '').lower()
    return n in ('body', 'vrstevnice', 'popisky') or n.startswith('deska_') or 'stromy' in n

def subset(j, b, keep_roots):
    nodes, meshes, mats, texs, imgs, smps, accs, bvs = [], [], [], [], [], [], [], []
    mp = {k: {} for k in ('node', 'mesh', 'mat', 'tex', 'img', 'smp', 'acc', 'bv')}
    def take(kind, src, dst, idx, fix=None):
        if idx in mp[kind]: return mp[kind][idx]
        mp[kind][idx] = len(dst)
        item = json.loads(json.dumps(src[idx])); dst.append(item)
        if fix: fix(item)
        return mp[kind][idx]
    def bv(i): return take('bv', j['bufferViews'], bvs, i, lambda x: x.update(buffer=0))
    def acc(i):
        def f(a):
            if 'bufferView' in a: a['bufferView'] = bv(a['bufferView'])
        return take('acc', j['accessors'], accs, i, f)
    def img(i):
        def f(x):
            if 'bufferView' in x: x['bufferView'] = bv(x['bufferView'])
        return take('img', j['images'], imgs, i, f)
    def smp(i): return take('smp', j['samplers'], smps, i)
    def tex(i):
        def f(t):
            if 'source' in t: t['source'] = img(t['source'])
            if 'sampler' in t: t['sampler'] = smp(t['sampler'])
        return take('tex', j['textures'], texs, i, f)
    def mat(i):
        def f(m):
            def walk(o):
                if isinstance(o, dict):
                    for k, v in o.items():
                        if k == 'index' and isinstance(v, int): o[k] = tex(v)
                        else: walk(v)
            walk(m)
        return take('mat', j['materials'], mats, i, f)
    def mesh(i):
        def f(m):
            for p in m['primitives']:
                p['attributes'] = {k: acc(v) for k, v in p['attributes'].items()}
                if 'indices' in p: p['indices'] = acc(p['indices'])
                if 'material' in p: p['material'] = mat(p['material'])
        return take('mesh', j['meshes'], meshes, i, f)
    def node(i):
        def f(n):
            if 'mesh' in n: n['mesh'] = mesh(n['mesh'])
            if 'children' in n: n['children'] = [node(c) for c in n['children']]
        return take('node', j['nodes'], nodes, i, f)
    roots = [node(r) for r in keep_roots]
    out = bytearray(); newbvs = []
    for i, v in enumerate(bvs):
        pass
    # přepočet bufferViews do nového binárního bloku
    order = sorted(mp['bv'].items(), key=lambda kv: kv[1])
    for old, new in order:
        v = j['bufferViews'][old]; s = v.get('byteOffset', 0)
        while len(out) % 4: out.append(0)
        nv = dict(bvs[new]); nv['byteOffset'] = len(out); nv['buffer'] = 0
        out += b[s:s + v['byteLength']]; bvs[new] = nv
    while len(out) % 4: out.append(0)
    g = {'asset': j['asset'], 'scene': 0, 'scenes': [{'nodes': roots}], 'nodes': nodes, 'meshes': meshes,
         'materials': mats, 'accessors': accs, 'bufferViews': bvs, 'buffers': [{'byteLength': len(out)}]}
    if texs: g['textures'] = texs
    if imgs: g['images'] = imgs
    if smps: g['samplers'] = smps
    if 'extensionsUsed' in j: g['extensionsUsed'] = j['extensionsUsed']
    return g, bytes(out)

def write(p, g, binb):
    js = json.dumps(g, separators=(',', ':')).encode()
    while len(js) % 4: js += b' '
    total = 12 + 8 + len(js) + 8 + len(binb)
    open(p, 'wb').write(struct.pack('<III', 0x46546C67, 2, total) + struct.pack('<II', len(js), 0x4E4F534A) + js +
                        struct.pack('<II', len(binb), 0x004E4942) + binb)

if __name__ == '__main__':
    src, mode, dst = sys.argv[1:4]
    j, b = load(src)
    roots = j['scenes'][j.get('scene', 0)]['nodes']
    sel = [r for r in roots if is_overlay(j['nodes'][r].get('name')) == (mode == 'overlay')]
    g, binb = subset(j, b, sel)
    write(dst, g, binb)
