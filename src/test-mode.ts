import * as ecs from '@8thwall/ecs'
import {ensureFont, FONT_FAMILY} from './fonts'
import {TEST_TASKS, TestTask} from './test-tasks'

// Testovací režim (marker-based AR): výběr sady a úlohy podle záznamníku 2. fáze.
// Použití: komponenta "test-mode" je na Camera místo "period-switcher" (stejné parametry modelů).
//
// Sady (stejné jako v záznamníku): 1 Změny, 2 Výška, 3 Zaplavení, 4 Vzdálenost.
// Zvíkov a Frymburk: každá úloha je samostatný GLB (terén s texturou, budovy, stromy, legenda, body A–D nebo A–B,
//   vrstevnice). Model se nahraje do entity modelu daného období (zachová se její poloha a měřítko),
//   popisky sídel jsou potomky této entity a zůstávají. Legenda ve scéně se skryje, je součástí GLB.
// Zácvik: model obsahuje jen značky, terén se bere ze scény (původní postup).

const SETS = ['', '1 · Změny', '2 · Výška', '3 · Zaplavení', '4 · Vzdálenost']   // index = číslo sady
const PERIOD_LABELS = ['19. století', '20. století', '21. století']
const PERIODS = ['CO', 'SMO5', 'RUIAN']
const TERR_NAME: Record<string, string> = {zvi: 'Zvíkov', fry: 'Frymburk', zac: 'Zácvik'}
const TERR_CODE: Record<string, string> = {zvi: 'Z', fry: 'F', zac: 'Zácvik'}
const HIGHLIGHT = '#26408C'   // modrá: období a řeka
const BASE = '#7894E8'
const RED_HI = '#B03030'      // světle červená: sady a úlohy
const RED = '#E88080'

ecs.registerComponent({
  name: 'test-mode',
  schema: {
    fryModel1: ecs.eid, fryModel2: ecs.eid, fryModel3: ecs.eid, fryRiver: ecs.eid, fryLegend: ecs.eid,
    zviModel1: ecs.eid, zviModel2: ecs.eid, zviModel3: ecs.eid, zviRiver: ecs.eid, zviLegend: ecs.eid,
    zacModel1: ecs.eid, zacModel2: ecs.eid, zacModel3: ecs.eid, zacRiver: ecs.eid,
    zviTarget: ecs.eid, fryTarget: ecs.eid, zacTarget: ecs.eid,
    zacScale: ecs.f32,    // 0 = ponechat měřítko ze scény; jinak se nastaví měřítko modelů zácviku (kalibrace)
  },
  schemaDefaults: {zacScale: 0},
  add: (world, component) => {
    const s = component.schema
    ensureFont()
    const models = {
      fry: {periods: [s.fryModel1, s.fryModel2, s.fryModel3], river: s.fryRiver},
      zvi: {periods: [s.zviModel1, s.zviModel2, s.zviModel3], river: s.zviRiver},
      zac: {periods: [s.zacModel1, s.zacModel2, s.zacModel3], river: s.zacRiver},
    }
    if (s.zacScale > 0) {
      [...models.zac.periods, models.zac.river].forEach((e) => { try { if (e) world.setScale(e, s.zacScale, s.zacScale, s.zacScale) } catch (err) { console.error(err) } })
    }
    let task: TestTask = TEST_TASKS[0]
    let period = 1          // jen pro sadu 1 (přepínání období); začíná obdobím z tištěné mapy (task.start)
    let marker: ecs.Eid | null = null   // jen zácvik: entita se značkami
    let riverOn = false     // řeka je u každé úlohy na začátku vypnutá, tlačítkem ji lze kdykoli zapnout
    let applyToken = 0      // nejnovější volání apply() vyhrává (rychlé přepínání úloh)
    let scanned = false     // modely úloh se stahují až po nalezení mapy (podle ní se pozná území)

    const hide = (e: ecs.Eid) => { try { if (e && !ecs.Hidden.has(world, e)) ecs.Hidden.set(world, e, {}) } catch (err) { console.error(err) } }
    const show = (e: ecs.Eid) => { try { if (e && ecs.Hidden.has(world, e)) ecs.Hidden.remove(world, e) } catch (err) { console.error(err) } }

    // ---------- modely Zvíkova a Frymburku: nahrávají se až podle úlohy ----------
    // Modely terénu ze scény se při startu odeberou (nic se nestahuje); do entit se nahrávají modely úloh.
    const loadedUrl = new Map<ecs.Eid, string>()
    const clearModel = (e: ecs.Eid) => {
      if (!e) return
      try { if (ecs.GltfModel.has(world, e)) ecs.GltfModel.remove(world, e) } catch (err) { console.error(err) }
      loadedUrl.delete(e)
    }
    const setModel = (e: ecs.Eid, url: string) => {
      if (!e || loadedUrl.get(e) === url) return
      try { if (ecs.GltfModel.has(world, e)) ecs.GltfModel.remove(world, e) } catch (err) { console.error(err) }
      try { ecs.GltfModel.set(world, e, {url, loop: true}); loadedUrl.set(e, url) } catch (err) { console.error(err) }
    }
    ;(['fry', 'zvi'] as const).forEach((t) => {
      models[t].periods.forEach(clearModel)
      hide(models[t].river)
    })
    // legenda s měřítkem je součástí modelů úloh, samostatná legenda ve scéně by ji zdvojila
    hide(s.fryLegend); hide(s.zviLegend)

    // ---------- stahování modelů do mezipaměti prohlížeče ----------
    const MB = 1024 * 1024
    const progress = new Map<string, {got: number, total: number}>()
    const cache = new Map<string, Promise<void>>()
    const prefetch = (url: string): Promise<void> => {
      let p = cache.get(url)
      if (p) return p
      p = (async () => {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const st = {got: 0, total: 0}
            progress.set(url, st)
            const res = await fetch(url)
            if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
            st.total = Number(res.headers.get('content-length')) || 8 * MB
            const reader = res.body.getReader()
            for (;;) {
              const {done, value} = await reader.read()
              if (done) break
              st.got += value.length
              renderLoader()
            }
            st.total = st.got
            return
          } catch (err) {
            console.error('stažení modelu selhalo', url, err)
            await new Promise(r => window.setTimeout(r, 1000))
          }
        }
        throw new Error(`model se nepodařilo stáhnout: ${url}`)
      })()
      p.catch(() => { cache.delete(url) })
      cache.set(url, p)
      return p
    }

    const isPeriodTask = () => task.set === 1   // přepínání období: sada Změny (u všech území)
    const periodIndex = () => (isPeriodTask() ? period : PERIODS.indexOf(task.period))

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
    const loader = document.createElement('div')
    loader.style.cssText = `position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:none;color:#fff;background:rgba(59,58,92,0.85);border-radius:14px;padding:14px 20px;text-align:center;font:700 17px/1.3 ${FONT_FAMILY};pointer-events:none`
    root.appendChild(top); root.appendChild(bottom); root.appendChild(loader); document.body.appendChild(root)

    let loaderUrls: string[] = []
    const renderLoader = () => {
      if (!loaderUrls.length) { loader.style.display = 'none'; return }
      let g = 0; let t = 0
      loaderUrls.forEach((u) => { const p = progress.get(u); if (p) { g += p.got; t += p.total } })
      loader.style.display = 'block'
      loader.textContent = t > 0 ? `Načítám model… ${Math.min(100, Math.round((g / t) * 100))} % (${(g / MB).toFixed(1)} / ${(t / MB).toFixed(1)} MB)` : 'Načítám model…'
    }

    const mk = (parent: HTMLElement, label: string, w: number, fn: () => void) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.style.cssText = btnCss(w)
      b.addEventListener('click', (ev) => { ev.stopPropagation(); fn() }); parent.appendChild(b); return b
    }
    const selectTask = (t: TestTask) => { task = t; period = Math.max(0, PERIODS.indexOf(t.start || 'CO')); riverOn = false; apply() }
    const setBtns = SETS.map((n, i) => mk(rowSets, n, 80, () => {
      if (i === 0) return
      selectTask(TEST_TASKS.find(t => t.set === i && t.terr === task.terr) || TEST_TASKS.find(t => t.set === i)!)
    }))
    // úlohy aktuálního území v aktuální sadě (sada 1 má jeden model pro všechny tři otázky, tlačítka úloh se pak skryjí)
    const tasksHere = () => TEST_TASKS.filter(x => x.set === task.set && x.terr === task.terr)
    const taskForBtn = (i: number): TestTask | undefined => tasksHere()[i]
    // zobrazené označení listu: sada-území+číslo (Z = Zvíkov, F = Frymburk), shodně se záznamníkem, např. 2-Z1
    const shownId = (t: TestTask) => {
      if (t.terr === 'zac') return `Zácvik ${t.set}`
      const k = t.id.replace(/^\d+-[ZF]/, '')
      return t.set === 1 ? `1-${TERR_CODE[t.terr]}1 až 1-${TERR_CODE[t.terr]}3` : `${t.set}-${TERR_CODE[t.terr]}${k}`
    }
    const taskBtns = [0, 1, 2].map(i => mk(rowTasks, `Úloha ${i + 1}`, 64, () => {
      const t = taskForBtn(i)
      if (t) selectTask(t)
    }))
    const riverBtn = mk(root, 'Řeka', 80, () => { riverOn = !riverOn; apply() })
    riverBtn.style.cssText += ';position:absolute;right:8px;top:calc(10px + env(safe-area-inset-top,0px))'
    const perBtns = PERIOD_LABELS.map((n, i) => mk(bottom, n, 110, () => { period = i; apply() }))

    const refreshUi = () => {
      setBtns.forEach((b, i) => {
        b.style.display = i === 0 ? 'none' : 'flex'
        b.style.background = task.set === i ? RED_HI : RED
      })
      const here = tasksHere()
      taskBtns.forEach((b, i) => {
        const t = taskForBtn(i)
        b.style.background = t && t.id === task.id ? RED_HI : RED
        b.style.display = t && here.length > 1 ? 'flex' : 'none'
      })
      info.textContent = `${shownId(task)} · ${TERR_NAME[task.terr]}`
      riverBtn.textContent = task.terr === 'zac' ? 'Nádrž' : 'Řeka'
      riverBtn.style.background = riverOn ? HIGHLIGHT : BASE
      bottom.style.display = isPeriodTask() ? 'flex' : 'none'
      perBtns.forEach((b, i) => { b.style.background = i === period ? HIGHLIGHT : BASE })
    }

    // ---------- zobrazení úlohy ----------
    const showRiver = () => {
      (['fry', 'zvi', 'zac'] as const).forEach((t) => {
        if (t === task.terr && riverOn) show(models[t].river); else hide(models[t].river)
      })
    }
    // zácvik: terén ze scény + GLB se značkami jako potomek modelu období
    const applyTraining = () => {
      models.zac.periods.forEach((e, i) => { if (i === periodIndex()) show(e); else hide(e) })
      if (marker) { try { world.deleteEntity(marker) } catch (err) { console.error(err) } marker = null }
      const parent = models.zac.periods[periodIndex()]
      const url = task.files[PERIODS[periodIndex()]]
      // diagnostika: přidej k adrese ?bez-znacky, značka se pak nevytvoří
      if (parent && url && !/bez-znacky/.test(window.location.search)) {
        const e = world.createEntity()
        world.setParent(e, parent)
        world.setPosition(e, 0, 0, 0)
        world.setQuaternion(e, 0, 0, 0, 1)
        world.setScale(e, 1, 1, 1)
        ecs.GltfModel.set(world, e, {url, loop: true})
        marker = e
      }
    }
    // Zvíkov a Frymburk: samostatný model úlohy v entitě období
    const applyOwn = async (my: number) => {
      if (!scanned) return
      const t = task.terr as 'fry' | 'zvi'
      const ents = models[t].periods
      const idx = periodIndex()
      const want = PERIODS.map((p, i) => ({i, url: task.files[p]})).filter(x => !!x.url)
      // entity období, která úloha nepotřebuje, uvolnit
      ents.forEach((e, i) => { if (!want.some(x => x.i === i)) { clearModel(e); hide(e) } })
      const cur = want.find(x => x.i === idx)
      if (!cur) return
      // 1) zobrazené období: stáhnout, nahrát, zobrazit
      if (loadedUrl.get(ents[idx]) !== cur.url) {
        loaderUrls = [cur.url]; renderLoader()
        try { await prefetch(cur.url) } catch (err) { console.error(err); loader.textContent = 'Model se nepodařilo načíst. Zkontrolujte připojení a zvolte úlohu znovu.'; return }
        if (my !== applyToken) return
        loaderUrls = []; renderLoader()
        setModel(ents[idx], cur.url)
      }
      ents.forEach((e, i) => { if (i === idx) show(e); else hide(e) })
      // 2) ostatní období téže úlohy (sada 1) se dotahují na pozadí, aby přepnutí bylo okamžité
      for (const x of want) {
        if (x.i === idx || loadedUrl.get(ents[x.i]) === x.url) continue
        try { await prefetch(x.url) } catch (err) { console.error(err); continue }
        if (my !== applyToken) return
        setModel(ents[x.i], x.url)
        hide(ents[x.i])
      }
    }
    const apply = () => {
      const my = ++applyToken
      // ostatní území skrýt
      ;(['fry', 'zvi', 'zac'] as const).forEach((t) => {
        if (t !== task.terr) models[t].periods.forEach(hide)
      })
      showRiver()
      if (task.terr === 'zac') { loaderUrls = []; renderLoader(); applyTraining() } else {
        if (marker) { try { world.deleteEntity(marker) } catch (err) { console.error(err) } marker = null }
        applyOwn(my).catch(err => console.error(err))
      }
      refreshUi()
    }

    // poslední naskenované území určuje, ke kterému území patří úlohy a tlačítka
    world.events.addListener(world.events.globalId, ecs.events.REALITY_IMAGE_FOUND, (event) => {
      const name = String((event.data as {name?: string} | undefined)?.name || '').toLowerCase()
      const terr = name.includes('zacvik') ? 'zac' : name.includes('zvikov') ? 'zvi' : name.includes('frymburk') ? 'fry' : null
      if (!terr) return
      scanned = true
      if (task.terr !== terr) {
        const next = TEST_TASKS.find(t => t.terr === terr && t.set === task.set) || TEST_TASKS.find(t => t.terr === terr)
        if (next) { selectTask(next); return }
      }
      // při každém (znovu)nalezení mapy zobrazit úlohu znovu (na mobilu se jinak mohla vytvořit dřív, než byl cíl sledován)
      apply()
      setTimeout(apply, 800)
    })
    apply()
    setTimeout(apply, 1500)
  },
  remove: () => {
    document.querySelectorAll('body > div[data-period-switcher]').forEach(el => el.remove())
  },
})
