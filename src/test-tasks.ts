// Seznam testovacích úloh a jejich modelů (GLB).
// own = true (Zvíkov, Frymburk): model se skládá z podkladu a vrstvy úlohy.
//   Podklad (base, jinak baseUrl() podle období): terén s texturou, budovy, legenda s měřítkem; u sad 2–4 i stromy a vrstevnice s popisky
//   (*_base_sada23.glb, *_base_sada4.glb), u sady 1 *_base_{CO,SMO5,RUIAN}.glb.
//   Vrstva úlohy (files): u sad 2–4 jen body A–D / A–B, u sady 1 i stromy. Podklad se při změně úlohy nenačítá znovu.
// Sady: 1 Změny (jeden model pro tři období), 2 Výška, 3 Zaplavení, 4 Vzdálenost (body A a B).
export type TestTask = {id: string, set: number, terr: 'zvi' | 'fry', period: 'CO' | 'SMO5' | 'RUIAN' | 'ALL', own: boolean, files: Record<string, string>, start?: 'CO' | 'SMO5' | 'RUIAN', base?: string}   // start: období zobrazené jako první (sada 1) = pokryv v tištěné mapě sady 1 (image target pro všechny sady)
export const baseUrl = (terr: 'zvi' | 'fry', period: string) =>
  `assets/test/${terr === 'zvi' ? 'Zvikov' : 'Frymburk'}_base_${period}.glb`
export const TEST_TASKS: TestTask[] = [
  {"id": "1-Z", "set": 1, "terr": "zvi", "period": "ALL", "own": true, "start": "SMO5", "files": {"CO": "assets/test/Zvikov_sada1_CO.glb", "SMO5": "assets/test/Zvikov_sada1_SMO5.glb", "RUIAN": "assets/test/Zvikov_sada1_RUIAN.glb"}},
  {"id": "2-Z1", "set": 2, "terr": "zvi", "period": "SMO5", "own": true, "base": "assets/test/Zvikov_base_sada23.glb", "files": {"SMO5": "assets/test/Zvikov_sada2_otazka1.glb"}},
  {"id": "2-Z2", "set": 2, "terr": "zvi", "period": "SMO5", "own": true, "base": "assets/test/Zvikov_base_sada23.glb", "files": {"SMO5": "assets/test/Zvikov_sada2_otazka2.glb"}},
  {"id": "3-Z1", "set": 3, "terr": "zvi", "period": "SMO5", "own": true, "base": "assets/test/Zvikov_base_sada23.glb", "files": {"SMO5": "assets/test/Zvikov_sada3_otazka1.glb"}},
  {"id": "3-Z2", "set": 3, "terr": "zvi", "period": "SMO5", "own": true, "base": "assets/test/Zvikov_base_sada23.glb", "files": {"SMO5": "assets/test/Zvikov_sada3_otazka2.glb"}},
  {"id": "4-Z1", "set": 4, "terr": "zvi", "period": "CO", "own": true, "base": "assets/test/Zvikov_base_sada4.glb", "files": {"CO": "assets/test/Zvikov_sada4_otazka1_250m.glb"}},
  {"id": "4-Z2", "set": 4, "terr": "zvi", "period": "CO", "own": true, "base": "assets/test/Zvikov_base_sada4.glb", "files": {"CO": "assets/test/Zvikov_sada4_otazka2_500m.glb"}},
  {"id": "4-Z3", "set": 4, "terr": "zvi", "period": "CO", "own": true, "base": "assets/test/Zvikov_base_sada4.glb", "files": {"CO": "assets/test/Zvikov_sada4_otazka3_850m.glb"}},
  {"id": "1-F", "set": 1, "terr": "fry", "period": "ALL", "own": true, "start": "CO", "files": {"CO": "assets/test/Frymburk_sada1_CO.glb", "SMO5": "assets/test/Frymburk_sada1_SMO5.glb", "RUIAN": "assets/test/Frymburk_sada1_RUIAN.glb"}},
  {"id": "2-F1", "set": 2, "terr": "fry", "period": "SMO5", "own": true, "base": "assets/test/Frymburk_base_sada23.glb", "files": {"SMO5": "assets/test/Frymburk_sada2_otazka1.glb"}},
  {"id": "2-F2", "set": 2, "terr": "fry", "period": "SMO5", "own": true, "base": "assets/test/Frymburk_base_sada23.glb", "files": {"SMO5": "assets/test/Frymburk_sada2_otazka2.glb"}},
  {"id": "3-F1", "set": 3, "terr": "fry", "period": "SMO5", "own": true, "base": "assets/test/Frymburk_base_sada23.glb", "files": {"SMO5": "assets/test/Frymburk_sada3_otazka1.glb"}},
  {"id": "3-F2", "set": 3, "terr": "fry", "period": "SMO5", "own": true, "base": "assets/test/Frymburk_base_sada23.glb", "files": {"SMO5": "assets/test/Frymburk_sada3_otazka2.glb"}},
  {"id": "4-F1", "set": 4, "terr": "fry", "period": "CO", "own": true, "base": "assets/test/Frymburk_base_sada4.glb", "files": {"CO": "assets/test/Frymburk_sada4_otazka1_500m.glb"}},
  {"id": "4-F2", "set": 4, "terr": "fry", "period": "CO", "own": true, "base": "assets/test/Frymburk_base_sada4.glb", "files": {"CO": "assets/test/Frymburk_sada4_otazka2_800m.glb"}},
  {"id": "4-F3", "set": 4, "terr": "fry", "period": "CO", "own": true, "base": "assets/test/Frymburk_base_sada4.glb", "files": {"CO": "assets/test/Frymburk_sada4_otazka3_1110m.glb"}}
]
