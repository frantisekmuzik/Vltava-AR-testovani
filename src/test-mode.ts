import * as ecs from '@8thwall/ecs'
import {ensureFont, FONT_FAMILY} from './fonts'
import {TEST_TASKS, TestTask} from './test-tasks'

// Testovací režim: výběr sady a úlohy, červené značky (body, A/B, úsečka) se vytvářejí v modelu.
// Použití: v testovací verzi aplikace přidej komponentu "test-mode" na Camera INSTEAD OF "period-switcher"
// (stejné parametry: fryModel1-3, fryRiver, zviModel1-3, zviRiver, k tomu zacModel1-3, zacRiver pro zácvikové území).
// Značky jsou potomky modelu terénu. Sada 0 = zácvik (fiktivní území, úlohy 0-1 až 0-4).

const SETS = ['Zácvik', 'Landuse', 'Změny', 'Výška', 'Měřítko']   // index = číslo sady (0 = zácvik)
const PERIOD_LABELS = ['19. století', '20. století', '21. století']
const PERIODS = ['CO', 'SMO5', 'RUIAN']
const HIGHLIGHT = '#26408C'   // modrá: období a řeka
const BASE = '#7894E8'
const RED_HI = '#B03030'      // světle červená: sady a úlohy
const RED = '#E88080'

ecs.registerComponent({
  name: 'test-mode',
  schema: {
    fryModel1: ecs.eid, fryModel2: ecs.eid, fryModel3: ecs.eid, fryRiver: ecs.eid,
    zviModel1: ecs.eid, zviModel2: ecs.eid, zviModel3: ecs.eid, zviRiver: ecs.eid,
    zacModel1: ecs.eid, zacModel2: ecs.eid, zacModel3: ecs.eid, zacRiver: ecs.eid,
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
    let period = 0          // jen pro sadu 2
    let marker: ecs.Eid | null = null
    let riverOn = false     // řeka je u každé úlohy na začátku vypnutá, tlačítkem ji lze kdykoli zapnout

    const hide = (e: ecs.Eid) => { try { if (e && !ecs.Hidden.has(world, e)) ecs.Hidden.set(world, e, {}) } catch (err) { console.error(err) } }
    const show = (e: ecs.Eid) => { try { if (e && ecs.Hidden.has(world, e)) ecs.Hidden.remove(world, e) } catch (err) { console.error(err) } }

    const isPeriodTask = () => task.set === 2 || task.id === '0-2'   // přepínání období: sada 2 a zácvik 0-2
    const periodIndex = () => (isPeriodTask() ? period : PERIODS.indexOf(task.period))

    const apply = () => {
      (['fry', 'zvi', 'zac'] as const).forEach((t) => {
        models[t].periods.forEach((e, i) => {
          if (t === task.terr && i === periodIndex()) show(e); else hide(e)
        })
        if (t === task.terr && riverOn) show(models[t].river); else hide(models[t].river)
      })
      if (marker) { try { world.deleteEntity(marker) } catch (err) { console.error(err) } marker = null }
      const parent = models[task.terr].periods[periodIndex()]
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
      refreshUi()
    }

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
    const VISIBLE_SETS = [0, 2, 3, 4]   // sada 1 (Landuse) odebrána, čísla ostatních sad zůstávají
    const setBtns = SETS.map((n, i) => mk(rowSets, `${i} · ${n}`, 80, () => { task = TEST_TASKS.find(t => t.set === i)!; period = 0; riverOn = false; apply() }))
    setBtns.forEach((b, i) => { if (!VISIBLE_SETS.includes(i)) b.style.display = 'none' })
    const taskBtns = [0, 1, 2, 3, 4, 5].map(i => mk(rowTasks, `Úloha ${i + 1}`, 64, () => {
      const t = TEST_TASKS.find(x => x.set === task.set && x.id.endsWith('-' + (i + 1)))
      if (t) { task = t; period = 0; riverOn = false; apply() }
    }))
    const riverBtn = mk(root, 'Řeka', 80, () => { riverOn = !riverOn; apply() })
    riverBtn.style.cssText += ';position:absolute;right:8px;top:calc(10px + env(safe-area-inset-top,0px))'
    const perBtns = PERIOD_LABELS.map((n, i) => mk(bottom, n, 110, () => { period = i; apply() }))

    const refreshUi = () => {
      setBtns.forEach((b, i) => { b.style.background = task.set === i ? RED_HI : RED })   // sada 1 je skrytá natrvalo
      taskBtns.forEach((b, i) => {
        b.style.background = task.id.endsWith('-' + (i + 1)) ? RED_HI : RED
        b.style.display = TEST_TASKS.some(x => x.set === task.set && x.id.endsWith('-' + (i + 1))) ? 'flex' : 'none'   // zácvik má jen 4 úlohy
      })
      info.textContent = `${task.id} · ${({zvi: 'Zvíkov', fry: 'Frymburk', zac: 'Zácvik'} as Record<string, string>)[task.terr]}`
      riverBtn.textContent = task.terr === 'zac' ? 'Nádrž' : 'Řeka'
      riverBtn.style.background = riverOn ? HIGHLIGHT : BASE
      bottom.style.display = isPeriodTask() ? 'flex' : 'none'
      perBtns.forEach((b, i) => { b.style.background = i === period ? HIGHLIGHT : BASE })
    }
    apply()
    // pojistka: ve scéně je Frymburk_RUIAN ve výchozím stavu viditelný, proto po načtení stav ještě dvakrát vynutíme
    setTimeout(apply, 1500)
    setTimeout(apply, 5000)
  },
  remove: () => {
    document.querySelectorAll('body > div[data-period-switcher]').forEach(el => el.remove())
  },
})
