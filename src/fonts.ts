// Načte písmo Merriweather Sans (400 a 700, latin + latin-ext pro českou diakritiku).
// Soubory musí být v src/assets/fonts/.
let injected = false

export const FONT_FAMILY = '"Merriweather Sans", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif'

export const ensureFont = () => {
  if (injected) return
  injected = true
  const face = (weight: number, subset: string, range: string) => `
@font-face{font-family:"Merriweather Sans";font-style:normal;font-weight:${weight};font-display:swap;
src:url("assets/fonts/merriweather-sans-${subset}-${weight}-normal.woff2") format("woff2");unicode-range:${range}}`
  const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'
  const EXT = 'U+0100-02AF,U+0304,U+0308,U+0329,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF'
  const style = document.createElement('style')
  style.textContent = [400, 700].map(w => face(w, 'latin', LATIN) + face(w, 'latin-ext', EXT)).join('\n')
  document.head.appendChild(style)
}