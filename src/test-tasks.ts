// Seznam testovacích úloh a jejich modelů (GLB).
// own = true (Zvíkov, Frymburk): model se skládá z podkladu a vrstvy úlohy.
//   Podklad (terén s texturou, budovy, legenda s měřítkem) je pro území a období stejný: baseUrl(), soubory *_base_{CO,SMO5,RUIAN}.glb.
//   Vrstva úlohy (files): stromy, body A–D / A–B, vrstevnice a jejich popisky. Podklad se při změně úlohy nenačítá znovu.
// own = false (zácvik): model obsahuje jen značky, terén se bere ze scény.
// Sady: 1 Změny (jeden model pro tři období), 2 Výška, 3 Zaplavení, 4 Vzdálenost (body A a B).
export type TestTask = {id: string, set: number, terr: 'zvi' | 'fry' | 'zac', period: 'CO' | 'SMO5' | 'RUIAN' | 'ALL', own: boolean, files: Record<string, string>, start?: 'CO' | 'SMO5' | 'RUIAN'}   // start: období zobrazené jako první (sada 1) = pokryv v tištěné mapě atlasu (cíl pro sledování)
export const baseUrl = (terr: 'zvi' | 'fry', period: string) =>
  `assets/test/${terr === 'zvi' ? 'Zvikov' : 'Frymburk'}_base_${period}.glb`
export const TEST_TASKS: TestTask[] = [
  {"id": "1-Z", "set": 1, "terr": "zvi", "period": "ALL", "own": true, "start": "SMO5", "files": {"CO": "assets/test/Zvikov_sada1_CO.glb", "SMO5": "assets/test/Zvikov_sada1_SMO5.glb", "RUIAN": "assets/test/Zvikov_sada1_RUIAN.glb"}},
  {"id": "2-Z1", "set": 2, "terr": "zvi", "period": "SMO5", "own": true, "files": {"SMO5": "assets/test/Zvikov_sada2_otazka1.glb"}},
  {"id": "2-Z2", "set": 2, "terr": "zvi", "period": "SMO5", "own": true, "files": {"SMO5": "assets/test/Zvikov_sada2_otazka2.glb"}},
  {"id": "3-Z1", "set": 3, "terr": "zvi", "period": "SMO5", "own": true, "files": {"SMO5": "assets/test/Zvikov_sada3_otazka1.glb"}},
  {"id": "3-Z2", "set": 3, "terr": "zvi", "period": "SMO5", "own": true, "files": {"SMO5": "assets/test/Zvikov_sada3_otazka2.glb"}},
  {"id": "4-Z1", "set": 4, "terr": "zvi", "period": "CO", "own": true, "files": {"CO": "assets/test/Zvikov_sada4_otazka1_250m.glb"}},
  {"id": "4-Z2", "set": 4, "terr": "zvi", "period": "CO", "own": true, "files": {"CO": "assets/test/Zvikov_sada4_otazka2_500m.glb"}},
  {"id": "4-Z3", "set": 4, "terr": "zvi", "period": "CO", "own": true, "files": {"CO": "assets/test/Zvikov_sada4_otazka3_850m.glb"}},
  {"id": "1-F", "set": 1, "terr": "fry", "period": "ALL", "own": true, "start": "CO", "files": {"CO": "assets/test/Frymburk_sada1_CO.glb", "SMO5": "assets/test/Frymburk_sada1_SMO5.glb", "RUIAN": "assets/test/Frymburk_sada1_RUIAN.glb"}},
  {"id": "2-F1", "set": 2, "terr": "fry", "period": "SMO5", "own": true, "files": {"SMO5": "assets/test/Frymburk_sada2_otazka1.glb"}},
  {"id": "2-F2", "set": 2, "terr": "fry", "period": "SMO5", "own": true, "files": {"SMO5": "assets/test/Frymburk_sada2_otazka2.glb"}},
  {"id": "3-F1", "set": 3, "terr": "fry", "period": "SMO5", "own": true, "files": {"SMO5": "assets/test/Frymburk_sada3_otazka1.glb"}},
  {"id": "3-F2", "set": 3, "terr": "fry", "period": "SMO5", "own": true, "files": {"SMO5": "assets/test/Frymburk_sada3_otazka2.glb"}},
  {"id": "4-F1", "set": 4, "terr": "fry", "period": "CO", "own": true, "files": {"CO": "assets/test/Frymburk_sada4_otazka1_500m.glb"}},
  {"id": "4-F2", "set": 4, "terr": "fry", "period": "CO", "own": true, "files": {"CO": "assets/test/Frymburk_sada4_otazka2_800m.glb"}},
  {"id": "4-F3", "set": 4, "terr": "fry", "period": "CO", "own": true, "files": {"CO": "assets/test/Frymburk_sada4_otazka3_1110m.glb"}},
  {"id": "0-1", "set": 1, "terr": "zac", "period": "ALL", "own": false, "files": {"CO": "assets/test/zac_0-1_CO.glb", "SMO5": "assets/test/zac_0-1_SMO5.glb", "RUIAN": "assets/test/zac_0-1_RUIAN.glb"}},
  {"id": "0-2", "set": 2, "terr": "zac", "period": "SMO5", "own": false, "files": {"SMO5": "assets/test/zac_0-2.glb"}},
  {"id": "0-2b", "set": 3, "terr": "zac", "period": "SMO5", "own": false, "files": {"SMO5": "assets/test/zac_0-2.glb"}},
  {"id": "0-3", "set": 4, "terr": "zac", "period": "CO", "own": false, "files": {"CO": "assets/test/zac_0-3.glb"}}
]
