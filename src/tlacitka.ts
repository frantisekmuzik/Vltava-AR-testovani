import * as ecs from '@8thwall/ecs'
import {ensureFont, FONT_FAMILY} from './fonts'

// Tlačítka jako HTML (DOM) prvky: česká diakritika a přesné vycentrování textu.
// Komponenta "period-switcher" zůstává na Camera. Tlačítka a texty ve Studiu už nejsou potřeba.

const HIGHLIGHT_COLOR = '#26408C'
const ORIG_COLOR = '#7894E8'

const LABELS = {
  fry: ['rok 1826', 'rok 1952', 'rok 2026', 'přehrada\nLipno'],
  zvi: ['rok 1830', 'rok 1952', 'rok 2026', 'přehrada\nOrlík'],
}

type Territory = 'fry' | 'zvi'

ecs.registerComponent({
  name: 'period-switcher',
  schema: {
    // modely Frymburku
    fryModel1: ecs.eid, fryModel2: ecs.eid, fryModel3: ecs.eid, fryRiver: ecs.eid,
    // modely Zvíkova
    zviModel1: ecs.eid, zviModel2: ecs.eid, zviModel3: ecs.eid, zviRiver: ecs.eid,
  },

  add: (world, component) => {
    const s = component.schema
    console.log('period-switcher v10 (DOM) add', component.eid)
    ensureFont()

    const models = {
      fry: {periods: [s.fryModel1, s.fryModel2, s.fryModel3], river: s.fryRiver},
      zvi: {periods: [s.zviModel1, s.zviModel2, s.zviModel3], river: s.zviRiver},
    }
    const state = {
      fry: {period: 0, river: false},
      zvi: {period: 1, river: false},   // Zvíkov začíná modelem SMO5 (rok 1952)
    }
    let active: Territory | null = null

    // ---------- líné načítání modelů terénu ----------
    // Při startu se z modelů terénu odebere komponenta GltfModel (nic se nestahuje).
    // Model se načte až když je potřeba: vybrané období po nalezení mapy, ostatní s odstupem na pozadí.
    const FALLBACK: Record<string, string> = {
      fry0: 'assets/modely/Frymburk_CO_stylized_v5.glb',
      fry1: 'assets/modely/Frymburk_SMO5_stylized_v5.glb',
      fry2: 'assets/modely/Frymburk_RUIAN_stylized_v6.glb',
      zvi0: 'assets/modely/Zvikov_CO_stylized_v4.glb',
      zvi1: 'assets/modely/Zvikov_SMO5_stylized_v4.glb',
      zvi2: 'assets/modely/Zvikov_RUIAN_stylized_v4.glb',
    }
    const PRELOAD_DELAY_MS = 4000
    const urls = new Map<ecs.Eid, string>()
    const loaded = new Set<ecs.Eid>()
    ;(['fry', 'zvi'] as Territory[]).forEach((t) => {
      models[t].periods.forEach((e, i) => {
        if (!e) return
        let url = ''
        try { if (ecs.GltfModel.has(world, e)) url = ecs.GltfModel.get(world, e).url || '' } catch (err) { console.error(err) }
        urls.set(e, url || FALLBACK[`${t}${i}`])
        try { if (ecs.GltfModel.has(world, e)) ecs.GltfModel.remove(world, e) } catch (err) { console.error(err) }
      })
    })
    // ---------- úvodní obrazovka se stahováním modelů ----------
    // Všechny modely terénu se stáhnou najednou (do mezipaměti prohlížeče) a uživatel vidí průběh.
    // Potom je stažení modelů do scény okamžité a úvodní obrazovka se skryje.
    const buildLoader = () => {
      const MB = 1024 * 1024
      const box = document.createElement('div')
      box.setAttribute('data-loading-screen', '')
      box.style.cssText = [
        'position:fixed', 'inset:0', 'z-index:20', 'display:flex', 'flex-direction:column',
        'align-items:center', 'justify-content:center', 'text-align:center', 'padding:24px',
        'box-sizing:border-box', 'background:#3b3a5c', 'color:#fff', `font-family:${FONT_FAMILY}`,
        'transition:opacity 0.4s ease',
      ].join(';')
      box.innerHTML =
        '<div style="font-size:34px;font-weight:700;letter-spacing:0.04em">VLTAVA</div>' +
        '<div style="font-size:16px;opacity:0.85;margin:6px 0 34px">Příběh řeky na mapách a plánech</div>' +
        '<div data-t style="font-size:20px;font-weight:700;margin-bottom:14px">Načítám 3D modely…</div>' +
        '<div style="width:min(80vw,360px);height:12px;border-radius:6px;background:rgba(255,255,255,0.2);overflow:hidden">' +
        '<div data-b style="width:0%;height:100%;border-radius:6px;background:#7894e8;transition:width 0.2s ease"></div></div>' +
        '<div data-p style="font-size:16px;opacity:0.85;margin-top:12px">0 %</div>'
      document.body.appendChild(box)
      const bar = box.querySelector('[data-b]') as HTMLElement
      const pct = box.querySelector('[data-p]') as HTMLElement
      const title = box.querySelector('[data-t]') as HTMLElement

      const list = Array.from(urls.values())
      const total = new Array(list.length).fill(0)
      const got = new Array(list.length).fill(0)
      const render = () => {
        const g = got.reduce((a, b) => a + b, 0)
        const t = total.reduce((a, b) => a + b, 0)
        const f = t > 0 ? Math.min(1, g / t) : 0
        bar.style.width = `${(f * 100).toFixed(0)}%`
        pct.textContent = t > 0 ? `${(f * 100).toFixed(0)} %  ·  ${(g / MB).toFixed(1)} / ${(t / MB).toFixed(1)} MB` : '0 %'
      }

      const fetchOne = async (url: string, i: number) => {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            got[i] = 0
            const res = await fetch(url)
            if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
            total[i] = Number(res.headers.get('content-length')) || 6 * MB
            const reader = res.body.getReader()
            for (;;) {
              const {done, value} = await reader.read()
              if (done) break
              got[i] += value.length
              render()
            }
            total[i] = got[i]
            render()
            return
          } catch (err) {
            console.error('stažení modelu selhalo', url, err)
            await new Promise(r => window.setTimeout(r, 1000))
          }
        }
      }

      Promise.all(list.map(fetchOne)).then(() => {
        title.textContent = 'Hotovo'
        bar.style.width = '100%'
        box.style.opacity = '0'
        box.style.pointerEvents = 'none'
        window.setTimeout(() => box.remove(), 450)
      })
    }
    buildLoader()

    const ensureLoaded = (e: ecs.Eid) => {
      if (!e || loaded.has(e)) return
      loaded.add(e)
      try { ecs.GltfModel.set(world, e, {url: urls.get(e) || '', loop: true}) } catch (err) { console.error(err) }
    }
    const preloadOthers = (t: Territory) => {
      models[t].periods.forEach((e, i) => {
        if (i === state[t].period) return
        window.setTimeout(() => ensureLoaded(e), PRELOAD_DELAY_MS * (1 + i))
      })
    }

    const hide = (e: ecs.Eid) => {
      try { if (e && !ecs.Hidden.has(world, e)) ecs.Hidden.set(world, e, {}) } catch (err) { console.error(err) }
    }
    const show = (e: ecs.Eid) => {
      try { if (e && ecs.Hidden.has(world, e)) ecs.Hidden.remove(world, e) } catch (err) { console.error(err) }
    }

    const applyModels = (t: Territory) => {
      const m = models[t]
      // nejdřív zobrazit vybraný model, pak skrýt ostatní (bez mezery)
      m.periods.forEach((e, i) => { if (i === state[t].period) { ensureLoaded(e); show(e) } })
      m.periods.forEach((e, i) => { if (i !== state[t].period) hide(e) })
      if (state[t].river) show(m.river); else hide(m.river)
    }

    // ---------- DOM ----------
    const BTN_CSS = [
      'display:flex', 'align-items:center', 'justify-content:center',
      'text-align:center', 'white-space:pre-line', 'box-sizing:border-box',
      'width:114px', 'height:56px', 'padding:0 6px', 'border:0', 'border-radius:10px',
      'color:#fff', `font:700 18px/1.2 ${FONT_FAMILY}`,
      'cursor:pointer', 'pointer-events:auto', 'touch-action:manipulation',
      '-webkit-tap-highlight-color:transparent', `background:${ORIG_COLOR}`, 'opacity:0.9',
    ].join(';')

    const root = document.createElement('div')
    root.setAttribute('data-period-switcher', '')
    root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:11;opacity:0;transition:opacity 0.3s ease'

    const bottom = document.createElement('div')
    bottom.style.cssText = [
      'position:absolute', 'left:0', 'right:0',
      'bottom:calc(50px + env(safe-area-inset-bottom, 0px))',
      'display:flex', 'justify-content:space-evenly', 'align-items:center',
      'padding:0 3%', 'pointer-events:none',
    ].join(';')

    const top = document.createElement('div')
    top.style.cssText = [
      'position:absolute', 'top:calc(50px + env(safe-area-inset-top, 0px))', 'right:10%',
      'pointer-events:none',
    ].join(';')

    const makeBtn = (parent: HTMLElement, onClick: () => void) => {
      const b = document.createElement('button')
      b.type = 'button'
      b.style.cssText = BTN_CSS
      b.addEventListener('click', (ev) => { ev.stopPropagation(); if (active) onClick() })
      parent.appendChild(b)
      return b
    }

    const select = (i: number) => () => { state[active!].period = i; applyModels(active!); applyButtons() }
    const btns = [
      makeBtn(bottom, select(0)),
      makeBtn(bottom, select(1)),
      makeBtn(bottom, select(2)),
      makeBtn(top, () => { state[active!].river = !state[active!].river; applyModels(active!); applyButtons() }),
    ]
    root.appendChild(bottom)
    root.appendChild(top)
    document.body.appendChild(root)

    const applyButtons = () => {
      if (!active) { root.style.opacity = '0'; root.style.visibility = 'hidden'; return }
      root.style.visibility = 'visible'
      root.style.opacity = '1'
      const st = state[active]
      LABELS[active].forEach((t, i) => { btns[i].textContent = t })
      ;[0, 1, 2].forEach((i) => { btns[i].style.background = i === st.period ? HIGHLIGHT_COLOR : ORIG_COLOR })
      btns[3].style.background = st.river ? HIGHLIGHT_COLOR : ORIG_COLOR
    }

    // na začátku vše skryto, nic se nenačítá
    ;(['fry', 'zvi'] as Territory[]).forEach((t) => {
      models[t].periods.forEach(hide)
      hide(models[t].river)
    })
    applyButtons()

    const preloaded = new Set<Territory>()
    const nameOf = (event: {data?: unknown}) =>
      String((event.data as {name?: string} | undefined)?.name || '').toLowerCase()

    world.events.addListener(world.events.globalId, ecs.events.REALITY_IMAGE_FOUND, (event) => {
      const name = nameOf(event)
      console.log('image found:', name)
      if (name.includes('zvikov') || name.includes('zvíkov')) active = 'zvi'
      else if (name.includes('frymburk')) active = 'fry'
      else return
      applyModels(active)
      if (!preloaded.has(active)) { preloaded.add(active); preloadOthers(active) }
      applyButtons()
    })
    // po ztrátě targetu zůstanou tlačítka dál viditelná u posledního území (plynulé přepínání)
  },

  remove: () => {
    document.querySelectorAll('body > div[data-period-switcher], body > div[data-loading-screen]').forEach(el => el.remove())
  },
})