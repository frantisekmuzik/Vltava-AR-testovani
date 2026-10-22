import * as ecs from '@8thwall/ecs'
import {ensureFont, FONT_FAMILY} from './fonts'
import {TEST_TASKS, TestTask} from './test-tasks'

// Testovací režim. Tlačítka se zobrazí jen po naskenování území (Zvíkov, Frymburk, Zácvik) a patří vždy k tomuto území:
// vlevo nahoře sady 1 · Landuse, 2 · Výška, 3 · Vzdálenost, pod nimi tlačítka úloh (polohy značek). Bez naskenovaného území
// není na obrazovce nic. Zácvik má v každé sadě jednu úlohu (0-1 až 0-3).
// Použití: na Camera nahraď "period-switcher" komponentou "test-mode". Parametry: fryModel1-3, fryRiver, zviModel1-3, zviRiver,
// zacModel1-3, zacRiver a cílové entity zviTarget, fryTarget, zacTarget (entity s image targetem).

const SET_LABELS = ['1 · Landuse', '2 · Výška', '3 · Vzdálenost']      // sady 1–3 (sada 1 = vývoj land use v čase)
const RIVER_TASKS = (_t: TestTask) => true     // tlačítko řeky/nádrže je dostupné u všech úloh (jako v původní verzi)
const PERIOD_LABELS = ['19. století', '20. století', '21. století']
const PERIODS = ['CO', 'SMO5', 'RUIAN']
const TERRS = ['zvi', 'fry', 'zac'] as const
type Terr = typeof TERRS[number]
const HIGHLIGHT = '#26408C'   // modrá: období a řeka
const BASE = '#7894E8'
const RED_HI = '#B03030'      // světle červená: úlohy
const RED = '#E88080'
const LOST_DELAY_MS = 800     // krátké ztráty sledování nechovají tlačítka

ecs.registerComponent({
  name: 'test-mode',
  schema: {
    fryModel1: ecs.eid, fryModel2: ecs.eid, fryModel3: ecs.eid, fryRiver: ecs.eid, fryTarget: ecs.eid,
    zviModel1: ecs.eid, zviModel2: ecs.eid, zviModel3: ecs.eid, zviRiver: ecs.eid, zviTarget: ecs.eid,
    zacModel1: ecs.eid, zacModel2: ecs.eid, zacModel3: ecs.eid, zacRiver: ecs.eid, zacTarget: ecs.eid,
    zacScale: ecs.f32,    // 0 = ponechat měřítko ze scény; jinak se nastaví měřítko modelů zácviku (kalibrace)
  },
  schemaDefaults: {zacScale: 0},
  add: (world, component) => {
    const s = component.schema
    ensureFont()
    const models = {
      fry: {periods: [s.fryModel1, s.fryModel2, s.fryModel3], river: s.fryRiver, target: s.fryTarget},
      zvi: {periods: [s.zviModel1, s.zviModel2, s.zviModel3], river: s.zviRiver, target: s.zviTarget},
      zac: {periods: [s.zacModel1, s.zacModel2, s.zacModel3], river: s.zacRiver, target: s.zacTarget},
    }
    if (s.zacScale > 0) {
      [...models.zac.periods, models.zac.river].forEach((e) => { try { if (e) world.setScale(e, s.zacScale, s.zacScale, s.zacScale) } catch (err) { console.error(err) } })
    }
    let active: Terr | null = null                    // právě naskenované území
    let fallback = false                              // bez událostí image targetu: tlačítko vlevo dole přepíná území
    const st: Record<Terr, {task: TestTask | null, period: number, riverOn: boolean, marker: ecs.Eid | null}> = {
      zvi: {task: null, period: 0, riverOn: false, marker: null},
      fry: {task: null, period: 0, riverOn: false, marker: null},
      zac: {task: null, period: 0, riverOn: false, marker: null},
    }

    const hide = (e: ecs.Eid) => { try { if (e && !ecs.Hidden.has(world, e)) ecs.Hidden.set(world, e, {}) } catch (err) { console.error(err) } }
    const show = (e: ecs.Eid) => { try { if (e && ecs.Hidden.has(world, e)) ecs.Hidden.remove(world, e) } catch (err) { console.error(err) } }

    const tasksFor = (t: Terr): TestTask[] => TEST_TASKS.filter(x => x.terr === t)
    const isPeriodTask = (k: TestTask) => k.set === 1
    const pIdx = (t: Terr) => { const k = st[t].task; return !k ? 0 : (isPeriodTask(k) ? st[t].period : PERIODS.indexOf(k.period)) }

    const apply = () => {
      TERRS.forEach((t) => {
        const k = st[t].task; const m = models[t]
        m.periods.forEach((e, i) => { if (k && i === pIdx(t)) show(e); else hide(e) })
        if (k && st[t].riverOn && RIVER_TASKS(k)) show(m.river); else hide(m.river)
        if (st[t].marker) { try { world.deleteEntity(st[t].marker!) } catch (err) { console.error(err) } st[t].marker = null }
        const parent = m.periods[pIdx(t)]
        const url = k ? k.files[PERIODS[pIdx(t)]] : null
        // diagnostika: přidej k adrese ?bez-znacky, značka se pak nevytvoří
        if (k && parent && url && !/bez-znacky/.test(window.location.search)) {
          const e = world.createEntity()
          world.setParent(e, parent)
          world.setPosition(e, 0, 0, 0)
          world.setQuaternion(e, 0, 0, 0, 1)
          world.setScale(e, 1, 1, 1)
          ecs.GltfModel.set(world, e, {url, loop: true})
          st[t].marker = e
        }
      })
      refreshUi()
    }
    const init = () => { TERRS.forEach((t) => { const l = tasksFor(t); st[t].task = l.length ? l[0] : null }) }
    // ---------- DOM ----------
    const btnCss = (w: number) => [
      'display:flex', 'align-items:center', 'justify-content:center', 'text-align:center', 'box-sizing:border-box',
      `min-width:${w}px`, 'height:44px', 'padding:0 10px', 'border:0', 'border-radius:10px', 'color:#fff',
      `font:700 15px/1.1 ${FONT_FAMILY}`, 'cursor:pointer', 'pointer-events:auto', 'touch-action:manipulation', 'opacity:0.92',
    ].join(';')
    const root = document.createElement('div')
    root.setAttribute('data-period-switcher', '')
    root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:11'
    const top = document.createElement('div')
    top.style.cssText = 'position:absolute;left:8px;right:96px;top:calc(10px + env(safe-area-inset-top,0px));display:flex;flex-direction:column;gap:6px;pointer-events:none'
    const rowSets = document.createElement('div'); rowSets.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap'
    const rowTasks = document.createElement('div'); rowTasks.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap'
    const info = document.createElement('div')
    info.style.cssText = `color:#fff;background:rgba(59,58,92,0.7);border-radius:10px;padding:6px 10px;font:700 15px/1.2 ${FONT_FAMILY};align-self:flex-start`
    top.appendChild(rowSets); top.appendChild(rowTasks); top.appendChild(info)
    const bottom = document.createElement('div')
    bottom.style.cssText = 'position:absolute;left:0;right:0;bottom:calc(40px + env(safe-area-inset-bottom,0px));display:flex;justify-content:space-evenly;pointer-events:none'
    root.appendChild(top); root.appendChild(bottom); document.body.appendChild(root)

    const mk = (parent: HTMLElement, label: string, w: number, fn: () => void) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.style.cssText = btnCss(w)
      b.addEventListener('click', (ev) => { ev.stopPropagation(); fn() }); parent.appendChild(b); return b
    }
    // sady a úlohy (tlačítka se vytvářejí podle naskenovaného území a dotazníku)
    const taskBtns: HTMLButtonElement[] = []
    const setBtns: HTMLButtonElement[] = []
    const rebuildBtns = () => {
      taskBtns.splice(0).forEach(b => b.remove()); setBtns.splice(0).forEach(b => b.remove())
      if (!active) return
      const all = tasksFor(active); const k0 = st[active].task
      if (!all.length || !k0) return
      [1, 2, 3].forEach((n) => {
        const b = mk(rowSets, SET_LABELS[n - 1], 80, () => { const f = all.find(x => x.set === n); if (f) { st[active!].task = f; st[active!].period = 0; st[active!].riverOn = false; rebuildBtns(); apply() } })
        b.dataset.set = String(n); setBtns.push(b)
      })
      all.filter(x => x.set === k0.set).forEach((k, i) => {
        const b = mk(rowTasks, `Úloha ${i + 1}`, 64, () => { st[active!].task = k; st[active!].period = 0; st[active!].riverOn = false; apply() })
        b.dataset.id = k.id; taskBtns.push(b)
      })
    }
    const riverBtn = mk(root, 'Řeka', 80, () => { if (active) { st[active].riverOn = !st[active].riverOn; apply() } })
    riverBtn.style.cssText += ';position:absolute;right:8px;top:calc(10px + env(safe-area-inset-top,0px))'
    const perBtns = PERIOD_LABELS.map((n, i) => mk(bottom, n, 110, () => { if (active) { st[active].period = i; apply() } }))
    // záložní přepínač území (jen když Studio nevyvolává události image targetu)
    const NAMES: Record<Terr, string> = {zvi: 'Zvíkov', fry: 'Frymburk', zac: 'Zácvik'}
    const zBtn = mk(root, '', 90, () => {
      active = TERRS[(TERRS.indexOf(active || 'zac') + 1) % TERRS.length]; rebuildBtns(); apply()
    })
    zBtn.style.cssText += ';position:absolute;left:8px;bottom:calc(8px + env(safe-area-inset-bottom,0px));height:30px;padding:0 8px;opacity:0.45;background:#3b3a5c;font-size:12px'
    const refreshUi = () => {
      zBtn.style.display = fallback ? 'flex' : 'none'
      zBtn.textContent = active ? NAMES[active] : 'Území'
      const k = active ? st[active].task : null
      const visible = !!(active && k)
      top.style.display = (visible || dbg) ? 'flex' : 'none'
      if (!visible) { riverBtn.style.display = 'none'; bottom.style.display = 'none'; rowSets.style.display = rowTasks.style.display = 'none'; info.style.display = dbg ? 'block' : 'none'; info.textContent = dbgLog.join(' | '); return }
      rowSets.style.display = rowTasks.style.display = 'flex'; info.style.display = 'block'
      setBtns.forEach((b) => { b.style.background = (b.dataset.id ? b.dataset.id === k!.id : b.dataset.set === String(k!.set)) ? RED_HI : RED })
      taskBtns.forEach((b) => { b.style.background = b.dataset.id === k!.id ? RED_HI : RED; b.style.display = 'flex' })
      info.textContent = `ID ${k!.id}` + (dbg ? ' | ' + dbgLog.join(' | ') : '')
      riverBtn.textContent = k!.terr === 'zac' ? 'Nádrž' : 'Řeka'
      riverBtn.style.display = RIVER_TASKS(k!) ? 'flex' : 'none'
      riverBtn.style.background = st[active!].riverOn ? HIGHLIGHT : BASE
      bottom.style.display = isPeriodTask(k!) ? 'flex' : 'none'
      perBtns.forEach((b, i) => { b.style.background = i === st[active!].period ? HIGHLIGHT : BASE })
    }

    // ---------- sledování nalezení cíle ----------
    const lostTimers: Partial<Record<Terr, number>> = {}
    const setFound = (t: Terr) => {
      if (lostTimers[t]) { clearTimeout(lostTimers[t]); lostTimers[t] = undefined }
      if (active !== t) { active = t; rebuildBtns(); refreshUi() }
    }
    const setLost = (t: Terr) => {
      if (lostTimers[t]) clearTimeout(lostTimers[t])
      lostTimers[t] = window.setTimeout(() => { if (active === t) { active = null; rebuildBtns(); refreshUi() } }, LOST_DELAY_MS)
    }
    const ev = (ecs as any).events
    const W = world as any
    const targetEid = (t: Terr): ecs.Eid | null => {
      if (models[t].target) return models[t].target
      try {   // záloha: model → Empty Object → image target
        const p = W.getParent(models[t].periods[0]); const pp = p ? W.getParent(p) : null
        return pp || null
      } catch (err) { return null }
    }
    const TARGET_NAMES: Record<Terr, string> = {zvi: 'Zvikov', fry: 'Frymburk', zac: 'Zacvik'}
    const registered: Record<Terr, boolean> = {zvi: false, fry: false, zac: false}
    const listeners: Array<() => void> = []
    const dbg = /ladeni/.test(window.location.search)
    const dbgLog: string[] = []
    const note = (m: string) => { if (dbg) { dbgLog.push(m); if (dbgLog.length > 4) dbgLog.shift(); console.log('test-mode:', m); refreshUi() } }
    // události image targetu: v tomto projektu fungují globální REALITY_IMAGE_* (stejně jako v tlacitka.ts a scan-prompt.ts)
    const FOUND = ev && ev.REALITY_IMAGE_FOUND, LOST = ev && ev.REALITY_IMAGE_LOST, UPD = ev && ev.REALITY_IMAGE_UPDATED
    let globalOk = false
    try {
      const gid = W.events && W.events.globalId
      if (FOUND && LOST && gid) {
        const terrOf = (e: any): Terr | null => {
          const nm = String((e && e.data && (e.data.name || e.data.imageTarget)) || '').toLowerCase()
          return TERRS.find(t => nm.indexOf(TARGET_NAMES[t].toLowerCase()) >= 0) || null
        }
        const gf = (e: any) => { const t = terrOf(e); note('nalezen ' + String(e && e.data && e.data.name) + ' → ' + t); if (t) setFound(t) }
        const gl = (e: any) => { const t = terrOf(e); if (t) { note('ztracen ' + t); setLost(t) } }
        world.events.addListener(gid, FOUND, gf); world.events.addListener(gid, UPD || FOUND, gf); world.events.addListener(gid, LOST, gl)
        globalOk = true
      }
    } catch (err) { console.error(err) }
    // pokud některé území nemá spolehlivé sledování, objeví se vlevo dole drobné tlačítko pro ruční přepnutí území
    fallback = !globalOk
    if (fallback && !active) active = 'zvi'
    if (fallback) console.warn('test-mode: sledování image targetu není u všech území k dispozici', JSON.stringify(registered), 'global:', globalOk)
    note('cíle: ' + TERRS.map(t => t + (registered[t] ? '✓' : '✗')).join(' ') + ' global:' + (globalOk ? '✓' : '✗'))
    init(); rebuildBtns()
    apply()
    // pojistka: ve scéně může být některý model ve výchozím stavu viditelný, proto po načtení stav ještě dvakrát vynutíme
    setTimeout(apply, 1500)
    setTimeout(apply, 5000)
  },
  remove: () => {
    document.querySelectorAll('body > div[data-period-switcher]').forEach(el => el.remove())
  },
})