#!/usr/bin/env python3
"""Sdílený podklad pro skupinu úloh (sady 2+3, sada 4) a vrstva úlohy jen se značkami.

Stromy (a popisky vrstevnic) se liší mezi úlohami jen vyčištěním kolem značek. Do sdíleného podkladu se berou jen
trojúhelníky, které jsou ve VŠECH modelech skupiny (průnik), takže žádný strom nezakrývá značky žádné z úloh.
  python3 tools/build_shared.py base <výstup.glb> <model1.glb> <model2.glb> ...   # podklad (první model je šablona)
  python3 tools/build_shared.py points <model.glb> <výstup.glb>                   # jen značky A–D / A–B
"""
import json, sys, numpy as np
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from split_glb import load, subset, write

CT = {5120: 'i1', 5121: 'u1', 5122: 'i2', 5123: 'u2', 5125: 'u4', 5126: 'f4'}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}

def rd(j, b, i):
    a = j['accessors'][i]; v = j['bufferViews'][a['bufferView']]
    assert not v.get('byteStride')
    n = NC[a['type']]
    return np.frombuffer(b, np.dtype(CT[a['componentType']]).newbyteorder('<'), a['count'] * n,
                         v.get('byteOffset', 0) + a.get('byteOffset', 0)).reshape(a['count'], n)

def is_points(name):
    n = (name or '').lower()
    return n == 'body' or n.startswith('deska_')

def is_filtered(name):   # stromy a popisky vrstevnic: průnik napříč úlohami
    n = (name or '').lower()
    return 'stromy' in n or n == 'popisky'

def filtered_prims(j):
    for nd in j['nodes']:
        if 'mesh' in nd and is_filtered(nd.get('name')):
            for p in j['meshes'][nd['mesh']]['primitives']:
                yield nd['name'], p

def tri_keys(j, b, p):
    pos = rd(j, b, p['attributes']['POSITION'])
    idx = rd(j, b, p['indices']).reshape(-1, 3) if 'indices' in p else np.arange(len(pos)).reshape(-1, 3)
    q = np.round(pos.astype(np.float64) * 100).astype(np.int64)
    h = ((q[:, 0] * 1000003) ^ (q[:, 1] * 999983)) * 1000033 ^ (q[:, 2] * 999979)
    t = np.sort(h[idx], axis=1)
    return idx, np.ascontiguousarray(t).view('V24').ravel()

def keyset(j, b):
    s = set()
    for _, p in filtered_prims(j):
        s.update(tri_keys(j, b, p)[1].tolist())
    return s

def add_view(j, binb, arr, target):
    data = np.ascontiguousarray(arr).tobytes()
    while len(binb) % 4: binb.append(0)
    j['bufferViews'].append({'buffer': 0, 'byteOffset': len(binb), 'byteLength': len(data), 'target': target})
    binb += data
    return len(j['bufferViews']) - 1

def rebuild_prim(j, b, binb, p, keep_keys):
    idx, keys = tri_keys(j, b, p)
    mask = np.array([k in keep_keys for k in keys.tolist()], bool)
    tri = idx[mask]
    used = np.unique(tri)
    remap = np.zeros(int(idx.max()) + 1, np.int64); remap[used] = np.arange(len(used))
    newattr = {}
    for name, ai in p['attributes'].items():
        a = dict(j['accessors'][ai]); arr = rd(j, b, ai)[used]
        a['bufferView'] = add_view(j, binb, arr, 34962); a['count'] = len(used); a.pop('byteOffset', None)
        if name == 'POSITION': a['min'] = arr.min(0).tolist(); a['max'] = arr.max(0).tolist()
        else: a.pop('min', None); a.pop('max', None)
        j['accessors'].append(a); newattr[name] = len(j['accessors']) - 1
    it = remap[tri.ravel()].astype('<u4' if len(used) >= 65535 else '<u2')
    ia = {'bufferView': add_view(j, binb, it, 34963), 'componentType': 5125 if it.dtype == np.dtype('<u4') else 5123,
          'count': int(it.size), 'type': 'SCALAR'}
    j['accessors'].append(ia)
    p['attributes'] = newattr; p['indices'] = len(j['accessors']) - 1
    return int(mask.sum()), len(mask)

if __name__ == '__main__':
    if sys.argv[1] == 'base':
        out, files = sys.argv[2], sys.argv[3:]
        j, b = load(files[0]); binb = bytearray(b)
        others = [keyset(*load(f)) for f in files[1:]]
        keep = keyset(j, b)
        for o in others: keep &= o
        for name, p in filtered_prims(j):
            k, n = rebuild_prim(j, b, binb, p, keep)
            print(f'  {name}: ponecháno {k}/{n} trojúhelníků')
        roots = [r for r in j['scenes'][j.get('scene', 0)]['nodes'] if not is_points(j['nodes'][r].get('name'))]
        g, nb = subset(j, bytes(binb), roots)
        write(out, g, nb)
    else:
        j, b = load(sys.argv[2])
        roots = [r for r in j['scenes'][j.get('scene', 0)]['nodes'] if is_points(j['nodes'][r].get('name'))]
        g, nb = subset(j, b, roots)
        write(sys.argv[3], g, nb)
