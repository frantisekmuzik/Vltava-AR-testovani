// Odstraní atributy NORMAL z GLB (materiály jsou KHR_materials_unlit, normály se nepoužijí; model je o ~30 % menší).
// Použití: node tools/strip_normals.mjs soubor.glb [další.glb ...]   (přepíše soubory; potřebuje @gltf-transform/core, extensions, functions)
import {NodeIO} from '@gltf-transform/core'
import {ALL_EXTENSIONS} from '@gltf-transform/extensions'
import {prune} from '@gltf-transform/functions'
import {statSync} from 'node:fs'

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
for (const f of process.argv.slice(2)) {
  const before = statSync(f).size
  const doc = await io.read(f)
  const lit = doc.getRoot().listMaterials().filter(m => !m.getExtension('KHR_materials_unlit'))
  if (lit.length) { console.log(`${f}: přeskočeno (${lit.length} materiálů s osvětlením)`); continue }
  let n = 0
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
    if (prim.getAttribute('NORMAL')) { prim.setAttribute('NORMAL', null); n++ }
  }
  await doc.transform(prune({keepLeaves: true}))
  await io.write(f, doc)
  console.log(`${f}: ${n} primitiv bez normál, ${(before / 1e6).toFixed(2)} → ${(statSync(f).size / 1e6).toFixed(2)} MB`)
}
