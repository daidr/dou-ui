import { fitPixelRatio, svgToPNG } from 'dou-ui'

/** Options of a dashboard's `exportPNG`. */
export interface DashboardImageOptions {
  /** Pixels per CSS px. 2 by default, sharp on most screens. */
  pixelRatio?: number
  /** Fill the background with the page's color. On by default; `false` leaves it clear. */
  background?: boolean
  /** Room around the dashboard, in px. 16 by default. */
  padding?: number
}

const SKIP = new Set(['SCRIPT', 'STYLE', 'LINK', 'TEMPLATE', 'NOSCRIPT'])

/** Every computed property of an element, as an inline style. */
function styleText(el: Element) {
  const style = getComputedStyle(el)
  let text = ''
  for (let i = 0; i < style.length; i++) {
    const name = style[i]!
    text += `${name}:${style.getPropertyValue(name)};`
  }
  // no scrollbars in the picture
  return `${text}scrollbar-width:none;`
}

/**
 * A copy of an element and what is in it, each with its computed style
 * inline, so it looks the same without the page's stylesheets; canvases
 * become images of what they show.
 */
function cloneStyled(source: Node): Node | null {
  if (source.nodeType === Node.TEXT_NODE) return source.cloneNode()
  if (source.nodeType !== Node.ELEMENT_NODE) return null
  const el = source as HTMLElement
  if (SKIP.has(el.tagName)) return null
  if (el.tagName === 'CANVAS') {
    const img = document.createElement('img')
    try {
      img.src = (el as HTMLCanvasElement).toDataURL()
    } catch {
      // a canvas with pixels from elsewhere can't be read: leave it blank
    }
    img.setAttribute('style', styleText(el))
    return img
  }
  const copy = el.cloneNode(false) as HTMLElement
  copy.setAttribute('style', styleText(el))
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
    const value = (el as HTMLInputElement).value
    if (el.tagName === 'TEXTAREA') copy.textContent = value
    else copy.setAttribute('value', value)
  }
  for (const child of el.childNodes) {
    const next = cloneStyled(child)
    if (next) copy.appendChild(next)
  }
  return copy
}

const PNG_SOURCE = { scope: '@dou-ui/dashboard', hint: 'use print(), which splits it into pages' }

/** Draws an element as it is shown into a PNG image. */
export async function elementToPNG(el: HTMLElement, options: DashboardImageOptions = {}) {
  const { pixelRatio, background = true, padding = 16 } = options
  const width = el.scrollWidth
  const height = el.scrollHeight
  const outerWidth = width + padding * 2
  const outerHeight = height + padding * 2
  // too big for a canvas: fail before copying every element's style
  fitPixelRatio(outerWidth, outerHeight, pixelRatio, PNG_SOURCE)
  const copy = cloneStyled(el) as HTMLElement
  copy.style.margin = '0'
  copy.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml')
  const html = new XMLSerializer().serializeToString(copy)
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${outerWidth}" height="${outerHeight}">` +
    `<foreignObject x="${padding}" y="${padding}" width="${width}" height="${height}">${html}</foreignObject></svg>`
  return svgToPNG(svg, {
    width: outerWidth,
    height: outerHeight,
    pixelRatio,
    ...PNG_SOURCE,
    background: background ? getComputedStyle(document.body).backgroundColor || '#fff' : undefined,
  })
}
