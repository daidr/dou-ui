/**
 * Small drawings for the component overview, one per component page.
 *
 * Each drawing sits on a 200 × 120 canvas and is built from a few shared
 * shapes. Shapes only carry class names; the colors come from the theme
 * tokens in the stylesheet, so every drawing follows light and dark mode.
 *
 *   p  surface with a border      pm muted surface with a border
 *   m  muted fill                 b / s  light / strong gray fill
 *   t  tertiary text fill         k  ink fill    on  text on ink
 *   a / g / w / r                 primary / success / warning / danger
 *   as / gs / ws / rs             the same tones, soft
 *   ln / lb / lk / la / lg        strokes: strong gray, border, ink, primary, success
 *   f  floating (drop shadow)     dash  dashed stroke
 */

const rect = (x: number, y: number, w: number, h: number, c: string, r = 0) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" class="${c}"/>`
const bar = (x: number, y: number, w: number, c = 's', h = 4) => rect(x, y, w, h, c, h / 2)
const circle = (cx: number, cy: number, r: number, c: string) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" class="${c}"/>`
const path = (d: string, c = 'lk') => `<path d="${d}" class="${c}"/>`
const text = (x: number, y: number, value: string, c = 'tx', anchor = 'middle') =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${c}">${value}</text>`
const group = (transform: string, inner: string) => `<g transform="${transform}">${inner}</g>`

/** Icons come from @dou-ui/icons itself, so the drawings use the real set. */
const iconSources = import.meta.glob<string>(
  [
    '../../../packages/icons/icons/alert-circle.stroke.svg',
    '../../../packages/icons/icons/alert-triangle.stroke.svg',
    '../../../packages/icons/icons/arrow-up-right.stroke.svg',
    '../../../packages/icons/icons/minus.stroke.svg',
    '../../../packages/icons/icons/close.stroke.svg',
    '../../../packages/icons/icons/check.stroke.svg',
    '../../../packages/icons/icons/chevron-right.stroke.svg',
    '../../../packages/icons/icons/chevron-down.stroke.svg',
    '../../../packages/icons/icons/arrow-left.stroke.svg',
    '../../../packages/icons/icons/arrow-up.stroke.svg',
    '../../../packages/icons/icons/bell.stroke.svg',
    '../../../packages/icons/icons/bold.stroke.svg',
    '../../../packages/icons/icons/calendar.stroke.svg',
    '../../../packages/icons/icons/check-circle.stroke.svg',
    '../../../packages/icons/icons/clock.stroke.svg',
    '../../../packages/icons/icons/cloud-upload.stroke.svg',
    '../../../packages/icons/icons/code.stroke.svg',
    '../../../packages/icons/icons/grip-vertical.stroke.svg',
    '../../../packages/icons/icons/heading.stroke.svg',
    '../../../packages/icons/icons/heart.stroke.svg',
    '../../../packages/icons/icons/home.stroke.svg',
    '../../../packages/icons/icons/inbox.stroke.svg',
    '../../../packages/icons/icons/info.stroke.svg',
    '../../../packages/icons/icons/italic.stroke.svg',
    '../../../packages/icons/icons/list.stroke.svg',
    '../../../packages/icons/icons/mail.stroke.svg',
    '../../../packages/icons/icons/moon.stroke.svg',
    '../../../packages/icons/icons/pin.stroke.svg',
    '../../../packages/icons/icons/plus.stroke.svg',
    '../../../packages/icons/icons/search.stroke.svg',
    '../../../packages/icons/icons/settings.stroke.svg',
    '../../../packages/icons/icons/sliders.stroke.svg',
    '../../../packages/icons/icons/sparkle.stroke.svg',
    '../../../packages/icons/icons/star.stroke.svg',
    '../../../packages/icons/icons/sun.stroke.svg',
    '../../../packages/icons/icons/underline.stroke.svg',
    '../../../packages/icons/icons/user.stroke.svg',
  ],
  { query: '?raw', import: 'default', eager: true },
)
/** An icon from the set, centered on (cx, cy) at `size` units. */
const icon = (name: string, cx: number, cy: number, size: number, c = 'ico') => {
  const source = iconSources[`../../../packages/icons/icons/${name}.stroke.svg`]!
  const inner = source.replace(/^[\s\S]*?<svg[^>]*>|<\/svg>\s*$/g, '')
  return `<g transform="translate(${cx - size / 2} ${cy - size / 2}) scale(${size / 24})" class="${c}">${inner}</g>`
}

/** An input-like box with a placeholder line. */
const field = (x: number, y: number, w: number, h = 24, fill = w * 0.4, c = 'p') =>
  rect(x, y, w, h, c, 5) + (fill ? bar(x + 10, y + h / 2 - 2, fill) : '')
/** A solid (ink) or outlined button with a label line. */
const button = (x: number, y: number, w: number, c = 'k', h = 24) => {
  const label = c === 'k' ? 'on' : c === 'p' ? 's' : 'on'
  const lw = Math.min(w - 20, 28)
  return rect(x, y, w, h, c, 5) + bar(x + (w - lw) / 2, y + h / 2 - 2, lw, label)
}
const popup = (x: number, y: number, w: number, h: number) => rect(x, y, w, h, 'p f', 8)
/** The line classes of the drawings, as the matching icon colors. */
const iconTone = (c: string) =>
  ({ lk: 'ico', lon: 'ico-on', ln: 'ico-3', la: 'ico-a', lg: 'ico-g', lw: 'ico-w' })[
    c.split(' ')[0]!
  ] ?? 'ico'
const chevronDown = (x: number, y: number, c = 'lk') => icon('chevron-down', x, y, 12, iconTone(c))
const chevronRight = (x: number, y: number, c = 'lk') =>
  icon('chevron-right', x, y, 12, iconTone(c))
const check = (x: number, y: number, c = 'lk') => icon('check', x, y, 13, iconTone(c))
const cross = (x: number, y: number, c = 'lk', s = 3) => icon('close', x, y, s * 4, iconTone(c))
/** Rows of text lines, one per width. */
const lines = (x: number, y: number, widths: number[], gap = 10, c = 's') =>
  widths.map((w, i) => bar(x, y + i * gap, w, c)).join('')
const avatar = (cx: number, cy: number, r: number, c = 'm') =>
  circle(cx, cy, r, c) + icon('user', cx, cy + r * 0.06, r * 1.3, 'ico-3')
const star = (cx: number, cy: number, r: number, c: string) => {
  const points = Array.from({ length: 10 }, (_, i) => {
    const angle = (Math.PI / 5) * i - Math.PI / 2
    const radius = i % 2 ? r * 0.48 : r
    return `${(cx + Math.cos(angle) * radius).toFixed(2)},${(cy + Math.sin(angle) * radius).toFixed(2)}`
  })
  return `<polygon points="${points.join(' ')}" class="${c} round"/>`
}
const spinner = (cx: number, cy: number, r: number) =>
  circle(cx, cy, r, 'lb w2 data') + path(`M${cx} ${cy - r}a${r} ${r} 0 0 1 ${r} ${r}`, 'lk w2 data')
const image = (x: number, y: number, w: number, h: number, r = 6) =>
  rect(x, y, w, h, 'pm', r) +
  circle(x + w * 0.7, y + h * 0.3, Math.min(w, h) * 0.1, 'b') +
  path(
    `M${x + 1} ${y + h - 1}l${w * 0.32} ${-h * 0.42}l${w * 0.2} ${h * 0.24}l${w * 0.14} ${-h * 0.14}l${w * 0.34 - 2} ${h * 0.32}z`,
    's',
  )
const hue = (id: string) =>
  `<linearGradient id="${id}-h">${[
    '#c45a5a',
    '#c4a35a',
    '#6fae6a',
    '#5aa9c4',
    '#5a6ec4',
    '#a35ac4',
    '#c45a5a',
  ]
    .map((color, i) => `<stop offset="${i / 6}" stop-color="${color}"/>`)
    .join('')}</linearGradient>`
/** A QR code position marker. */
const finder = (x: number, y: number) =>
  rect(x, y, 28, 28, 'k', 4) +
  rect(x + 4, y + 4, 20, 20, 'bg', 2) +
  rect(x + 8, y + 8, 12, 12, 'k', 2)

/** The position markers and their quiet edges in a 21 × 21 QR code. */
const qrReserved = (row: number, col: number) =>
  (row < 8 && col < 8) || (row < 8 && col > 12) || (row > 12 && col < 8)

/** A tiny pseudo-random generator, so drawings stay the same between builds. */
function random(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

const arts: Record<string, string | ((id: string) => string)> = {
  // basics
  button:
    rect(36, 32, 72, 28, 'k', 6) +
    icon('plus', 50, 46, 16, 'ico-on') +
    bar(60, 44, 36, 'on') +
    button(116, 32, 48, 'p', 28) +
    rect(36, 68, 56, 28, 'as', 6) +
    bar(50, 80, 28, 'a') +
    bar(104, 80, 24, 't') +
    rect(136, 68, 28, 28, 'p', 6) +
    icon('search', 150, 82, 16),
  toggle:
    rect(36, 38, 128, 44, 'p', 8) +
    rect(40, 42, 36, 36, 'm', 5) +
    icon('bold', 58, 60, 20) +
    icon('italic', 100, 60, 20, 'ico-2') +
    icon('underline', 142, 60, 20, 'ico-2'),
  icon: [
    ['home', 'search', 'heart', 'bell'],
    ['star', 'settings', 'calendar', 'mail'],
  ]
    .flatMap((row, r) => row.map((name, i) => icon(name, 52 + i * 32, 44 + r * 32, 24)))
    .join(''),
  text:
    bar(40, 38, 72, 'k', 6) +
    lines(40, 54, [120, 104], 10) +
    bar(40, 78, 36, 't') +
    bar(80, 78, 36, 'g') +
    bar(120, 78, 36, 'r'),
  ellipsis:
    rect(32, 30, 136, 26, 'p', 6) +
    bar(44, 41, 92) +
    circle(144, 43, 1.6, 't') +
    circle(150, 43, 1.6, 't') +
    circle(156, 43, 1.6, 't') +
    rect(32, 64, 136, 34, 'p', 6) +
    bar(44, 73, 112) +
    bar(44, 85, 72) +
    circle(122, 87, 1.6, 't') +
    circle(128, 87, 1.6, 't') +
    circle(134, 87, 1.6, 't'),
  highlight:
    bar(40, 36, 30) +
    rect(74, 32, 40, 12, 'ws', 3) +
    bar(78, 36, 32, 'w') +
    bar(118, 36, 42) +
    bar(40, 50, 120) +
    bar(40, 64, 56) +
    rect(100, 60, 36, 12, 'ws', 3) +
    bar(104, 64, 28, 'w') +
    bar(140, 64, 20) +
    bar(40, 78, 84),
  link:
    bar(36, 34, 128) +
    bar(36, 48, 40) +
    bar(80, 48, 44, 'a') +
    path('M80 56h44', 'la') +
    bar(128, 48, 36) +
    bar(36, 62, 96) +
    bar(36, 84, 52, 'a') +
    icon('arrow-up-right', 96, 86, 12, 'ico-a'),
  typography:
    text(44, 76, 'Aa', 'tx display', 'start') +
    bar(110, 44, 48, 'k', 6) +
    lines(110, 58, [52, 44, 50], 9),
  'copy-button':
    rect(28, 52, 144, 36, 'pm', 6) +
    bar(40, 68, 24, 't') +
    bar(68, 68, 52) +
    rect(138, 58, 24, 24, 'p', 5) +
    check(150, 70, 'lk w15') +
    rect(122, 22, 56, 22, 'k f', 6) +
    path('M145 44l5 5l5 -5z', 'k') +
    text(150, 37, '已复制', 'tx on-text small'),
  'code-block':
    rect(30, 26, 140, 68, 'pm', 8) +
    [0, 1, 2, 3, 4].map((i) => bar(40, 38 + i * 10, 6, 'b')).join('') +
    bar(54, 38, 24, 'a') +
    bar(82, 38, 40) +
    bar(64, 48, 30, 'g') +
    bar(98, 48, 34, 't') +
    bar(64, 58, 44, 's') +
    bar(54, 68, 20, 'a') +
    bar(78, 68, 52, 't') +
    bar(54, 78, 12),

  // layout
  divider:
    lines(40, 30, [120, 90], 10) +
    path('M40 60h44M116 60h44', 'ln') +
    bar(90, 58, 20, 't') +
    lines(40, 80, [120, 70], 10),
  space:
    rect(32, 40, 36, 36, 'pm', 6) +
    rect(82, 40, 36, 36, 'pm', 6) +
    rect(132, 40, 36, 36, 'pm', 6) +
    rect(68, 40, 14, 36, 'as') +
    rect(118, 40, 14, 36, 'as') +
    path('M68 86h14M68 83v6M82 83v6M118 86h14M118 83v6M132 83v6', 'la'),
  toolbar:
    rect(28, 40, 144, 40, 'p', 8) +
    rect(32, 44, 28, 32, 'm', 5) +
    icon('heading', 46, 60, 18) +
    icon('bold', 78, 60, 18, 'ico-2') +
    icon('list', 110, 60, 18, 'ico-2') +
    path('M132 48v24', 'lb') +
    bar(140, 58, 16) +
    chevronDown(164, 60),
  grid:
    rect(32, 28, 136, 18, 'pm', 4) +
    rect(32, 51, 66, 18, 'pm', 4) +
    rect(102, 51, 66, 18, 'pm', 4) +
    rect(32, 74, 42, 18, 'pm', 4) +
    rect(79, 74, 42, 18, 'pm', 4) +
    rect(126, 74, 42, 18, 'pm', 4),
  masonry:
    rect(40, 20, 36, 44, 'pm', 5) +
    rect(40, 68, 36, 32, 'pm', 5) +
    rect(82, 20, 36, 26, 'pm', 5) +
    rect(82, 50, 36, 50, 'pm', 5) +
    rect(124, 20, 36, 56, 'pm', 5) +
    rect(124, 80, 36, 20, 'pm', 5),
  splitter:
    rect(32, 26, 136, 68, 'p', 8) +
    rect(32, 26, 56, 68, 'm', 8) +
    rect(80, 26, 8, 68, 'm') +
    path('M88 26v68', 'lb') +
    rect(85, 50, 6, 20, 'p', 3) +
    lines(42, 38, [32, 24, 28], 10) +
    lines(100, 38, [56, 48, 52, 36], 10),
  layout:
    rect(32, 22, 136, 76, 'p', 8) +
    path('M32 40h136M66 40v58', 'lb') +
    bar(42, 29, 18, 'k') +
    circle(156, 31, 4, 'm') +
    lines(40, 50, [18, 14, 18], 10) +
    rect(76, 50, 82, 20, 'm', 4) +
    lines(76, 78, [70, 52], 9),
  scrollbar:
    rect(46, 22, 108, 76, 'p', 8) +
    lines(58, 34, [72, 60, 76, 52, 68, 44], 10) +
    rect(142, 30, 4, 28, 's', 2),
  affix:
    rect(46, 18, 108, 84, 'p', 8) +
    lines(58, 52, [80, 64, 76, 52], 11) +
    rect(52, 26, 96, 18, 'p f', 5) +
    bar(60, 33, 40, 'k') +
    icon('pin', 138, 35, 14),

  // form
  input:
    bar(36, 30, 32, 't') +
    rect(36, 40, 128, 32, 'ps', 6) +
    bar(48, 54, 52, 'k') +
    path('M104 48v20', 'lk') +
    bar(36, 82, 72),
  textarea:
    rect(40, 28, 120, 64, 'p', 6) +
    lines(50, 40, [92, 100, 64], 11) +
    path('M151 85l4 -4M146 85l9 -9', 'ln'),
  editable:
    bar(40, 24, 64) +
    bar(140, 24, 24, 't') +
    path('M32 38h136M32 82h136', 'lb') +
    rect(32, 46, 96, 28, 'ps', 6) +
    rect(40, 53, 72, 14, 'as', 3) +
    bar(44, 58, 64, 'k') +
    bar(140, 58, 24, 't') +
    bar(40, 92, 52) +
    bar(140, 92, 24, 't'),
  'input-number':
    rect(40, 40, 120, 40, 'p', 6) +
    path('M76 40v40M124 40v40', 'lb') +
    icon('minus', 58, 60, 20) +
    icon('plus', 142, 60, 20) +
    text(100, 66, '128', 'tx mono big'),
  'input-tag':
    rect(32, 32, 136, 56, 'ps', 6) +
    rect(38, 38, 44, 20, 'm', 4) +
    bar(44, 46, 22, 't') +
    cross(74, 48, 'ln', 2) +
    rect(86, 38, 52, 20, 'm', 4) +
    bar(92, 46, 30, 't') +
    cross(130, 48, 'ln', 2) +
    rect(38, 62, 36, 20, 'm', 4) +
    bar(44, 70, 14, 't') +
    cross(66, 72, 'ln', 2) +
    path('M80 65v14', 'lk'),
  'input-otp': [0, 1, 2, 3, 4, 5]
    .map((i) => {
      const x = 25 + i * 26
      return (
        rect(x, 42, 20, 36, i === 3 ? 'ps la' : 'p', 5) +
        (i < 3 ? text(x + 10, 66.5, String([4, 8, 1][i]), 'tx mono big') : '') +
        (i === 3 ? path(`M${x + 10} 52v16`, 'lk') : '')
      )
    })
    .join(''),
  checkbox: [0, 1, 2]
    .map((i) => {
      const y = 30 + i * 26
      const on = i !== 1
      return (
        rect(52, y, 16, 16, on ? 'k' : 'ps', 4) +
        (on ? check(60, y + 8, 'lon w15') : '') +
        bar(80, y + 6, [64, 52, 72][i]!)
      )
    })
    .join(''),
  radio: [0, 1, 2]
    .map((i) => {
      const y = 38 + i * 26
      const on = i === 0
      return (
        circle(60, y, 8, on ? 'k' : 'ps') +
        (on ? circle(60, y, 3, 'on') : '') +
        bar(80, y - 2, [56, 68, 44][i]!)
      )
    })
    .join(''),
  switch:
    bar(44, 44, 52) +
    rect(120, 36, 36, 20, 'k', 10) +
    circle(146, 46, 7, 'on') +
    bar(44, 76, 40) +
    rect(120, 68, 36, 20, 'b', 10) +
    circle(130, 78, 7, 'p f'),
  slider:
    bar(36, 44, 128, 'b') +
    bar(36, 44, 76, 'k') +
    circle(112, 46, 8, 'p f') +
    bar(36, 78, 128, 'b') +
    bar(64, 78, 60, 'k') +
    circle(64, 80, 6, 'p f') +
    circle(124, 80, 6, 'p f'),
  rate: [0, 1, 2, 3, 4].map((i) => star(44 + i * 28, 61, 14, i < 3 ? 'k' : 'b')).join(''),
  select:
    field(48, 22, 104, 26, 40, 'ps') +
    chevronDown(140, 35) +
    popup(48, 54, 104, 48) +
    rect(52, 58, 96, 18, 'm', 4) +
    bar(60, 65, 44, 'k') +
    check(138, 67) +
    bar(60, 87, 52),
  listbox:
    rect(52, 22, 96, 76, 'p', 8) +
    [0, 1, 2, 3].map((i) => bar(64, 35 + i * 16, [40, 52, 34, 46][i]!)).join('') +
    rect(56, 45, 88, 16, 'm', 4) +
    bar(64, 51, 52, 'k') +
    check(134, 53),
  autocomplete:
    rect(48, 22, 104, 26, 'ps', 5) +
    bar(58, 33, 24, 'k') +
    path('M86 29v12', 'lk') +
    popup(48, 54, 104, 48) +
    rect(52, 58, 96, 18, 'm', 4) +
    bar(60, 65, 24, 'k') +
    bar(86, 65, 30) +
    bar(60, 87, 24, 'k') +
    bar(86, 87, 40),
  cascader:
    field(36, 18, 128, 24, 52, 'ps') +
    chevronDown(152, 30) +
    popup(36, 48, 128, 56) +
    path('M100 48v56', 'lb') +
    rect(40, 52, 56, 16, 'm', 4) +
    bar(46, 58, 28, 'k') +
    chevronRight(88, 60) +
    bar(46, 78, 32) +
    chevronRight(88, 80, 'ln') +
    rect(104, 52, 56, 16, 'm', 4) +
    bar(110, 58, 30, 'k') +
    bar(110, 78, 36) +
    bar(110, 92, 26),
  'tree-select':
    field(44, 18, 112, 24, 44, 'ps') +
    chevronDown(144, 30) +
    popup(44, 48, 112, 56) +
    chevronDown(56, 60) +
    bar(64, 58, 40, 'k') +
    path('M57 66v24M57 76h8M57 90h8', 'lb') +
    rect(68, 70, 80, 14, 'm', 4) +
    bar(74, 75, 36, 'k') +
    bar(74, 88, 44),
  'date-picker': () => {
    let cells = ''
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 7; col++) {
        const x = 54 + col * 14
        const y = 54 + row * 11
        const day = row * 7 + col
        if (day === 17) cells += circle(x, y, 5, 'k')
        else if (day > 13 && day < 17) cells += rect(x - 7, y - 5, 14, 10, 'm')
        cells += circle(x, y, 1.4, day === 17 ? 'on' : day > 24 ? 'b' : 's')
      }
    }
    return (
      rect(40, 14, 120, 92, 'p f', 8) +
      bar(52, 24, 44, 'k') +
      chevronRight(142, 26) +
      path('M50 38h100', 'lb') +
      cells
    )
  },
  'time-picker':
    rect(52, 18, 96, 84, 'p f', 8) +
    rect(56, 50, 88, 20, 'm', 5) +
    path('M84 22v76M116 22v76', 'lb') +
    [0, 1, 2]
      .map(
        (col) =>
          text(68 + col * 32, 41, ['08', '29', '00'][col]!, 'tx3 mono') +
          text(68 + col * 32, 64.5, ['09', '30', '15'][col]!, 'tx mono bold') +
          text(68 + col * 32, 88, ['10', '31', '30'][col]!, 'tx3 mono'),
      )
      .join(''),
  'input-date':
    rect(28, 42, 144, 36, 'ps', 6) +
    rect(83, 47, 24, 26, 'as', 4) +
    text(56, 65.5, '2026', 'tx mono mid') +
    text(80, 65.5, '/', 'tx3 mono mid') +
    text(95, 65.5, '10', 'tx mono mid') +
    text(110, 65.5, '/', 'tx3 mono mid') +
    text(125, 65.5, '29', 'tx mono mid') +
    icon('calendar', 156, 60, 18),
  'input-time':
    rect(44, 42, 112, 36, 'ps', 6) +
    rect(54, 46, 28, 28, 'as', 4) +
    text(68, 66.5, '09', 'tx mono big') +
    text(86, 66, ':', 'tx3 mono big') +
    text(104, 66.5, '30', 'tx mono big') +
    icon('clock', 138, 60, 18),
  'color-picker': (id) =>
    `<defs><linearGradient id="${id}-s"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#4a63c4"/></linearGradient><linearGradient id="${id}-v" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000"/></linearGradient>${hue(id)}</defs>` +
    rect(48, 14, 32, 24, 'ps', 5) +
    rect(53, 19, 22, 14, 'a', 3) +
    rect(48, 44, 104, 62, 'p f', 8) +
    `<rect x="54" y="50" width="92" height="36" rx="4" fill="url(#${id}-s)"/>` +
    `<rect x="54" y="50" width="92" height="36" rx="4" fill="url(#${id}-v)"/>` +
    circle(116, 60, 4, 'ring') +
    `<rect x="54" y="93" width="92" height="6" rx="3" fill="url(#${id}-h)"/>` +
    circle(104, 96, 5, 'ring'),
  'color-panel': (id) =>
    `<defs><linearGradient id="${id}-s"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#2e7d5b"/></linearGradient><linearGradient id="${id}-v" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000"/></linearGradient>${hue(id)}</defs>` +
    rect(48, 14, 104, 92, 'p', 8) +
    `<rect x="56" y="22" width="88" height="44" rx="4" fill="url(#${id}-s)"/>` +
    `<rect x="56" y="22" width="88" height="44" rx="4" fill="url(#${id}-v)"/>` +
    circle(118, 34, 4, 'ring') +
    `<rect x="56" y="74" width="88" height="6" rx="3" fill="url(#${id}-h)"/>` +
    circle(86, 77, 5, 'ring') +
    ['k', 'a', 'g', 'w', 'r', 'b'].map((c, i) => rect(56 + i * 15.6, 88, 10, 10, c, 3)).join(''),
  transfer:
    rect(26, 24, 60, 72, 'p', 8) +
    rect(114, 24, 60, 72, 'p', 8) +
    [0, 1, 2, 3]
      .map(
        (i) =>
          rect(34, 34 + i * 14, 8, 8, i === 1 ? 'k' : 'ps', 2) +
          bar(48, 36 + i * 14, [26, 30, 22, 28][i]!) +
          (i < 2
            ? rect(122, 34 + i * 14, 8, 8, 'ps', 2) + bar(136, 36 + i * 14, [28, 22][i]!)
            : ''),
      )
      .join('') +
    check(38, 52, 'lon') +
    rect(92, 42, 16, 16, 'k', 4) +
    chevronRight(100, 50, 'lon') +
    rect(92, 62, 16, 16, 'p', 4) +
    path('M101.5 67l-3 3l3 3', 'ln'),
  'segmented-control':
    rect(28, 42, 144, 36, 'm', 8) +
    rect(32, 46, 46, 28, 'p f', 6) +
    bar(43, 58, 24, 'k') +
    bar(88, 58, 24, 't') +
    bar(136, 58, 24, 't') +
    path('M124 50v20', 'lb'),
  'check-tag':
    rect(34, 40, 48, 20, 'k', 10) +
    check(46, 50, 'lon') +
    bar(54, 48, 20, 'on') +
    rect(88, 40, 44, 20, 'p', 10) +
    bar(98, 48, 24) +
    rect(138, 40, 30, 20, 'p', 10) +
    bar(146, 48, 14) +
    rect(54, 66, 44, 20, 'p', 10) +
    bar(64, 74, 24) +
    rect(104, 66, 48, 20, 'k', 10) +
    check(116, 76, 'lon') +
    bar(124, 74, 20, 'on'),
  upload:
    rect(36, 16, 128, 54, 'pm dash', 8) +
    icon('cloud-upload', 100, 43, 28) +
    rect(36, 78, 128, 26, 'p', 6) +
    rect(44, 85, 10, 12, 'lk', 2) +
    bar(62, 86, 48) +
    bar(62, 94, 88, 'b', 3) +
    bar(62, 94, 60, 'k', 3),
  'image-cropper': (id) =>
    `<defs><mask id="${id}-m"><rect width="200" height="120" fill="#fff"/><rect x="68" y="32" width="64" height="56" fill="#000"/></mask></defs>` +
    image(36, 18, 128, 84, 8) +
    `<rect x="36" y="18" width="128" height="84" rx="8" class="dim2" mask="url(#${id}-m)"/>` +
    rect(68, 32, 64, 56, 'lwhite') +
    path('M68 40v-8h8M124 32h8v8M132 80v8h-8M76 88h-8v-8', 'lwhite w2 data') +
    path('M89.3 32v56M110.7 32v56M68 50.7h64M68 69.3h64', 'lwhite thin'),
  'field-group':
    rect(24, 42, 152, 36, 'p', 6) +
    rect(24, 42, 48, 36, 'm', 6) +
    rect(64, 42, 8, 36, 'm') +
    path('M72 42v36', 'lb') +
    bar(34, 58, 18, 't') +
    chevronDown(62, 60) +
    bar(82, 58, 44) +
    rect(132, 42, 44, 36, 'k', 6) +
    rect(132, 42, 8, 36, 'k') +
    bar(144, 58, 20, 'on'),
  form:
    bar(36, 28, 24, 't') +
    field(68, 18, 96, 24, 40) +
    bar(36, 60, 20, 't') +
    field(68, 50, 96, 24, 32) +
    button(68, 84, 44, 'k', 22) +
    button(118, 84, 44, 'p', 22),

  // overlays
  tooltip:
    button(68, 72, 64, 'p', 26) +
    rect(52, 26, 96, 30, 'k f', 6) +
    path('M95 56l5 5l5 -5z', 'k') +
    bar(66, 39, 68, 'on'),
  popover:
    button(70, 84, 60, 'p', 22) +
    rect(46, 14, 108, 58, 'p f', 8) +
    path('M94 72l6 6l6 -6', 'p lb') +
    rect(94, 70, 12, 3, 'p0s') +
    bar(58, 26, 40, 'k') +
    lines(58, 40, [56, 44], 10) +
    button(114, 50, 32, 'k', 16),
  dropdown:
    rect(52, 14, 64, 24, 'p', 5) +
    bar(62, 24, 26, 'k') +
    chevronDown(104, 26) +
    popup(52, 44, 96, 62) +
    rect(56, 48, 88, 16, 'm', 4) +
    bar(64, 54, 40, 'k') +
    bar(64, 70, 52) +
    path('M56 82h88', 'lb') +
    bar(64, 91, 36, 'r'),
  'context-menu':
    rect(24, 14, 152, 92, 'pm dash', 8) +
    path('M58 32v14l3.5 -3.5l2.5 5.5l2 -1l-2.5 -5h5z', 'p lk join') +
    popup(70, 40, 84, 60) +
    rect(74, 44, 76, 16, 'm', 4) +
    bar(82, 50, 36, 'k') +
    bar(82, 66, 44) +
    path('M74 78h76', 'lb') +
    bar(82, 86, 30),
  dialog:
    rect(16, 10, 168, 100, 'dim', 8) +
    rect(50, 24, 100, 72, 'p f', 10) +
    bar(62, 36, 40, 'k') +
    cross(138, 38, 'ln', 2.5) +
    lines(62, 50, [76, 60], 10) +
    button(86, 72, 26, 'p', 16) +
    button(116, 72, 26, 'k', 16),
  drawer:
    rect(16, 10, 168, 100, 'dim', 8) +
    `<path d="M112 10h64a8 8 0 0 1 8 8v84a8 8 0 0 1 -8 8h-64z" class="p f"/>` +
    bar(124, 24, 32, 'k') +
    cross(170, 26, 'ln', 2.5) +
    lines(124, 42, [44, 36], 10) +
    rect(124, 64, 48, 14, 'm', 3) +
    rect(124, 84, 48, 14, 'm', 3),
  popconfirm:
    button(70, 84, 60, 'r', 22) +
    rect(42, 14, 116, 58, 'p f', 8) +
    path('M94 72l6 6l6 -6', 'p lb') +
    rect(94, 70, 12, 3, 'p0s') +
    icon('alert-triangle', 58, 30, 14, 'ico-w') +
    bar(70, 28, 56, 'k') +
    button(92, 48, 26, 'p', 16) +
    button(122, 48, 26, 'k', 16),
  tour: (id) =>
    `<defs><mask id="${id}-m"><rect width="200" height="120" fill="#fff"/><rect x="26" y="22" width="44" height="22" rx="6" fill="#000"/></mask></defs>` +
    rect(20, 16, 160, 88, 'p', 8) +
    button(30, 26, 36, 'p', 14) +
    lines(30, 56, [60, 48, 54], 10) +
    `<rect x="20" y="16" width="160" height="88" rx="8" class="dim3" mask="url(#${id}-m)"/>` +
    rect(26, 22, 44, 22, 'la', 6) +
    rect(80, 34, 88, 56, 'p f', 8) +
    path('M80 40l-5 4l5 4', 'p') +
    bar(90, 44, 40, 'k') +
    bar(90, 56, 64) +
    circle(92, 78, 2, 'k') +
    circle(99, 78, 2, 'b') +
    circle(106, 78, 2, 'b') +
    button(132, 72, 28, 'k', 12),

  // feedback
  alert:
    rect(32, 28, 136, 28, 'as', 6) +
    icon('info', 46, 42, 16, 'ico-a') +
    bar(58, 40, 64, 'a') +
    rect(32, 64, 136, 28, 'gs', 6) +
    icon('check-circle', 46, 78, 16, 'ico-g') +
    bar(58, 76, 80, 'g'),
  banner:
    rect(28, 16, 144, 88, 'p', 8) +
    `<path d="M28 42v-18a8 8 0 0 1 8 -8h128a8 8 0 0 1 8 8v18z" class="as"/>` +
    bar(70, 27, 52, 'a') +
    bar(126, 27, 16, 'a') +
    cross(160, 29, 'la', 2.5) +
    lines(40, 56, [96, 80, 88], 11),
  toast:
    rect(48, 30, 104, 24, 'p', 6) +
    rect(40, 46, 120, 28, 'p f', 7) +
    rect(32, 66, 136, 34, 'p f', 8) +
    icon('check-circle', 48, 83, 16, 'ico-g') +
    bar(62, 76, 52, 'k') +
    bar(62, 86, 76),
  spinner: spinner(60, 60, 10) + spinner(96, 60, 15) + spinner(144, 60, 22),
  loading:
    rect(36, 18, 128, 84, 'p', 8) +
    lines(48, 30, [96, 80, 104, 72, 88], 13, 'b') +
    rect(36, 18, 128, 84, 'veil', 8) +
    spinner(100, 60, 10),
  progress:
    bar(40, 34, 120, 'b', 6) +
    bar(40, 34, 84, 'k', 6) +
    bar(40, 58, 120, 'b', 6) +
    bar(40, 58, 120, 'g', 6) +
    bar(40, 82, 120, 'b', 6) +
    bar(40, 82, 44, 'k', 6),
  'progress-group': group(
    'translate(0 6)',
    bar(32, 30, 48, 'k') +
      bar(140, 30, 28, 't') +
      rect(32, 44, 136, 12, 'b', 6) +
      `<path d="M38 44h42v12h-42a6 6 0 0 1 0 -12z" class="a"/>` +
      rect(82, 44, 32, 12, 'g') +
      rect(116, 44, 20, 12, 'w') +
      circle(38, 76, 3, 'a') +
      bar(45, 74, 22) +
      circle(80, 76, 3, 'g') +
      bar(87, 74, 22) +
      circle(122, 76, 3, 'w') +
      bar(129, 74, 22),
  ),
  skeleton:
    circle(54, 44, 14, 'sk') +
    rect(76, 34, 68, 8, 'sk', 4) +
    rect(76, 48, 44, 8, 'sk', 4) +
    rect(40, 72, 120, 8, 'sk', 4) +
    rect(40, 86, 92, 8, 'sk', 4),
  result:
    icon('check-circle', 100, 36, 32, 'ico-g') +
    bar(68, 62, 64, 'k', 6) +
    bar(56, 76, 88, 't') +
    button(64, 88, 34, 'p', 18) +
    button(102, 88, 34, 'k', 18),

  // data display
  card:
    rect(44, 16, 112, 88, 'p', 10) +
    bar(56, 28, 40, 'k', 6) +
    path('M44 44h112', 'lb') +
    lines(56, 54, [88, 72, 80], 10) +
    button(116, 84, 30, 'p', 14),
  avatar:
    avatar(56, 60, 20) +
    circle(86, 60, 21.5, 'bg') +
    circle(86, 60, 20, 'k') +
    text(86, 66, '戴', 'tx on-text mid') +
    circle(116, 60, 21.5, 'bg') +
    avatar(116, 60, 20, 'pm') +
    circle(146, 60, 21.5, 'bg') +
    circle(146, 60, 20, 'm') +
    text(146, 64.5, '+3', 'tx2 small'),
  user:
    avatar(56, 60, 22) +
    circle(71, 75, 5, 'g ring2') +
    bar(90, 48, 64, 'k', 7) +
    bar(90, 64, 48, 't'),
  badge:
    rect(40, 36, 48, 48, 'p', 10) +
    icon('bell', 64, 60, 26) +
    circle(87, 37, 8, 'r') +
    text(87, 41, '3', 'tx on-tone small') +
    avatar(132, 60, 24, 'm') +
    circle(149, 43, 5, 'r ring2'),
  tag:
    rect(34, 40, 40, 20, 'm', 5) +
    bar(42, 48, 24, 't') +
    rect(80, 40, 48, 20, 'as', 5) +
    bar(88, 48, 32, 'a') +
    rect(134, 40, 32, 20, 'p', 5) +
    bar(141, 48, 18) +
    rect(52, 66, 50, 20, 'gs', 5) +
    bar(60, 74, 24, 'g') +
    cross(93, 76, 'lg', 2) +
    rect(108, 66, 40, 20, 'p', 5) +
    bar(116, 74, 24),
  kbd: ['⌘', '⇧', 'K']
    .map(
      (key, i) =>
        rect(30 + i * 50, 38, 40, 44, 'p kbd', 8) + text(50 + i * 50, 67, key, 'tx bigger'),
    )
    .join(''),
  empty: icon('inbox', 100, 50, 48) + bar(76, 84, 48, 't') + bar(56, 96, 88, 'b'),
  statistic:
    bar(40, 30, 56, 't') +
    text(40, 68, '128,430', 'tx stat-lg', 'start') +
    icon('arrow-up', 46, 86, 12, 'ico-g') +
    bar(56, 84, 32, 'g') +
    bar(94, 84, 40, 'b'),
  countdown:
    ['02', '45', '18']
      .map(
        (value, i) =>
          rect(40 + i * 44, 40, 32, 40, 'pm', 6) + text(56 + i * 44, 67, value, 'tx mono big'),
      )
      .join('') +
    text(78, 66, ':', 'tx3 big') +
    text(122, 66, ':', 'tx3 big'),
  'relative-time':
    rect(32, 24, 136, 72, 'p', 8) +
    path('M32 48h136M32 72h136', 'lb') +
    [0, 1, 2]
      .map((i) => {
        const y = 36 + i * 24
        return (
          circle(46, y, 6, 'm') +
          bar(58, y - 2, [48, 32, 40][i]!) +
          text(158, y + 4, ['刚刚', '3 分钟前', '昨天'][i]!, 'tx3 small', 'end')
        )
      })
      .join(''),
  image: image(44, 20, 112, 80, 8),
  carousel:
    rect(20, 28, 28, 60, 'pm', 6) +
    rect(152, 28, 28, 60, 'pm', 6) +
    image(54, 20, 92, 76, 8) +
    rect(88, 102, 12, 4, 'k', 2) +
    circle(108, 104, 2, 's') +
    circle(116, 104, 2, 's'),
  marquee: (id) =>
    `<defs><linearGradient id="${id}-f"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".2" stop-color="#fff"/><stop offset=".8" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><mask id="${id}-m"><rect x="20" width="160" height="120" fill="url(#${id}-f)"/></mask></defs>` +
    `<g mask="url(#${id}-m)">` +
    [0, 1, 2, 3]
      .map((i) => rect(16 + i * 42, 34, 38, 20, 'p', 10) + bar(26 + i * 42, 42, 18))
      .join('') +
    [0, 1, 2]
      .map((i) => rect(37 + i * 42, 64, 38, 20, 'p', 10) + bar(47 + i * 42, 72, 18))
      .join('') +
    '</g>',
  qrcode: () => {
    // A 21 × 21 code: three position markers, the timing lines and data.
    const next = random(11)
    const size = 4
    let modules = ''
    for (let row = 0; row < 21; row++) {
      for (let col = 0; col < 21; col++) {
        if (qrReserved(row, col)) continue
        const timing = row === 6 || col === 6
        const on = timing ? (row + col) % 2 === 0 : next() > 0.5
        if (on) modules += `M${58 + col * size} ${18 + row * size}h${size}v${size}h${-size}z`
      }
    }
    return finder(58, 18) + finder(114, 18) + finder(58, 74) + `<path d="${modules}" class="k"/>`
  },
  watermark:
    rect(36, 18, 128, 84, 'p', 8) +
    [
      [48, 44],
      [88, 44],
      [128, 44],
      [68, 68],
      [108, 68],
      [48, 92],
      [88, 92],
      [128, 92],
    ]
      .map(([x, y]) => path(`M${x} ${y}l24 -10`, 'mk'))
      .join('') +
    lines(48, 30, [72, 96, 60], 28),
  descriptions:
    rect(28, 24, 144, 72, 'p', 8) +
    path('M28 48h144M28 72h144M100 24v72', 'lb') +
    [0, 1, 2]
      .map(
        (row) =>
          bar(38, 34 + row * 24, 20, 't') +
          bar(64, 34 + row * 24, [28, 24, 30][row]!, 'k') +
          bar(110, 34 + row * 24, 20, 't') +
          bar(136, 34 + row * 24, [24, 30, 18][row]!, 'k'),
      )
      .join(''),
  collapse:
    rect(40, 14, 120, 92, 'p', 8) +
    bar(52, 24, 44, 'k') +
    chevronDown(146, 26) +
    lines(52, 38, [92, 76], 9) +
    path('M40 60h120M40 83h120', 'lb') +
    bar(52, 70, 52) +
    chevronRight(146, 72) +
    bar(52, 93, 40) +
    chevronRight(146, 95),
  timeline:
    path('M62 28v64', 'lb') +
    circle(62, 28, 4, 's') +
    circle(62, 60, 4, 's') +
    circle(62, 92, 7, 'as') +
    circle(62, 92, 4, 'a') +
    bar(76, 22, 80, 'k') +
    bar(76, 31, 48, 't') +
    bar(76, 54, 72, 'k') +
    bar(76, 63, 56, 't') +
    bar(76, 86, 84, 'k') +
    bar(76, 95, 44, 't'),
  'node-graph':
    path(
      'M62 60c14 0 14 -24 28 -24M62 60c14 0 14 24 28 24M118 36c14 0 14 24 28 24M118 84c14 0 14 -24 28 -24',
      'ln',
    ) +
    rect(26, 50, 36, 20, 'p', 5) +
    bar(34, 58, 20, 'k') +
    rect(90, 26, 28, 20, 'p', 5) +
    bar(96, 34, 16) +
    rect(90, 74, 28, 20, 'p', 5) +
    bar(96, 82, 16) +
    rect(146, 50, 32, 20, 'k', 5) +
    bar(152, 58, 20, 'on'),
  'calendar-view': () => {
    let cells = ''
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 7; col++) {
        cells += circle(37 + col * 20.8, 40 + row * 18, 1.4, 's')
      }
    }
    return (
      rect(24, 14, 152, 92, 'p', 8) +
      path('M24 30h152', 'lb') +
      bar(34, 20, 32, 'k') +
      cells +
      rect(52, 44, 52, 7, 'as', 2) +
      rect(52, 44, 2, 7, 'a') +
      rect(114, 62, 32, 7, 'm', 2) +
      rect(114, 62, 2, 7, 'k') +
      rect(31, 80, 40, 7, 'm', 2) +
      rect(31, 80, 2, 7, 't') +
      circle(120, 76, 7, 'k') +
      circle(120, 76, 1.4, 'on')
    )
  },
  'calendar-heatmap': () => {
    const next = random(3)
    let cells = ''
    for (let col = 0; col < 16; col++) {
      for (let row = 0; row < 7; row++) {
        const level = Math.floor(next() * next() * 5)
        cells += rect(29 + col * 9, 28 + row * 9, 7, 7, `heat${level}`, 1.5)
      }
    }
    return cells + bar(29, 98, 28, 't')
  },
  sparkline: (id) => {
    const values = [94, 86, 90, 80, 84, 72, 76, 62, 66, 54, 48]
    const line = values.map((y, i) => `${i ? 'L' : 'M'}${40 + i * 12} ${y}`).join('')
    return (
      `<defs><linearGradient id="${id}-a" x2="0" y2="1"><stop offset="0" class="stop-ink" stop-opacity=".16"/><stop offset="1" class="stop-ink" stop-opacity="0"/></linearGradient></defs>` +
      bar(40, 26, 28, 't') +
      text(40, 52, '2,846', 'tx stat-sm', 'start') +
      `<path d="${line}V100H40Z" fill="url(#${id}-a)"/>` +
      path(line, 'lk w15 join data') +
      circle(160, 48, 3, 'k')
    )
  },
  table:
    rect(24, 20, 152, 80, 'p', 8) +
    `<path d="M24 38v-10a8 8 0 0 1 8 -8h136a8 8 0 0 1 8 8v10z" class="m"/>` +
    path('M24 38h152M24 58h152M24 78h152', 'lb') +
    [0, 1, 2, 3]
      .map(
        (row) =>
          bar(34, 27 + row * 20, row ? 24 : 18, row ? 'k' : 't') +
          bar(80, 27 + row * 20, row ? [36, 28, 32][row - 1]! : 22, row ? 's' : 't') +
          (row
            ? rect(134, 24 + row * 20, 28, 10, ['gs', 'ws', 'gs'][row - 1]!, 3)
            : bar(134, 27, 20, 't')),
      )
      .join(''),
  tree:
    chevronDown(52, 28) +
    bar(60, 26, 44, 'k') +
    path('M53 36v54M53 46h8M53 66h8M53 90h8', 'lb') +
    chevronDown(68, 46) +
    bar(76, 44, 36) +
    rect(72, 52, 84, 16, 'm', 4) +
    bar(80, 58, 40, 'k') +
    path('M69 52v24M69 76h8', 'lb') +
    bar(80, 74, 32) +
    chevronRight(68, 90) +
    bar(76, 88, 48),
  'virtual-list':
    lines(52, 14, [72, 56], 8, 'b') +
    rect(44, 32, 112, 56, 'p', 8) +
    [0, 1, 2, 3]
      .map((i) => bar(56, 42 + i * 11, [72, 56, 64, 48][i]!) + bar(136, 42 + i * 11, 10, 't'))
      .join('') +
    lines(52, 94, [64, 72], 8, 'b'),
  'infinite-scroll':
    rect(48, 14, 104, 92, 'p', 8) +
    [0, 1, 2, 3]
      .map((i) => circle(62, 28 + i * 16, 5, 'm') + bar(72, 26 + i * 16, [56, 44, 60, 50][i]!))
      .join('') +
    spinner(100, 94, 5),
  sortable:
    [0, 1, 2]
      .map((i) => {
        const y = 22 + i * 28
        if (i === 1) return ''
        return (
          rect(44, y, 112, 22, 'p', 6) +
          [0, 1, 2]
            .map((d) => circle(55, y + 7 + d * 4, 1, 't') + circle(59, y + 7 + d * 4, 1, 't'))
            .join('') +
          bar(68, y + 9, 52)
        )
      })
      .join('') +
    rect(44, 50, 112, 22, 'pm dash', 6) +
    group(
      'rotate(-3 108 58)',
      rect(52, 44, 112, 22, 'p f', 6) +
        [0, 1, 2]
          .map((d) => circle(63, 51 + d * 4, 1, 'k') + circle(67, 51 + d * 4, 1, 'k'))
          .join('') +
        bar(76, 53, 44, 'k'),
    ),

  // navigation
  menu:
    rect(52, 14, 96, 92, 'p', 8) +
    rect(56, 39, 88, 20, 'm', 5) +
    [0, 1, 2, 3]
      .map(
        (i) =>
          rect(62, 25 + i * 20, 8, 8, i === 1 ? 'lk' : 'ln', 2) +
          bar(76, 27 + i * 20, [40, 48, 36, 44][i]!, i === 1 ? 'k' : 's'),
      )
      .join(''),
  menubar:
    rect(24, 18, 152, 24, 'p', 6) +
    rect(28, 21, 36, 18, 'm', 4) +
    bar(36, 28, 20, 'k') +
    bar(72, 28, 20) +
    bar(104, 28, 20) +
    bar(136, 28, 20) +
    popup(28, 46, 84, 58) +
    bar(38, 56, 40, 'k') +
    bar(92, 56, 12, 't') +
    bar(38, 70, 48) +
    bar(92, 70, 12, 't') +
    path('M32 82h76', 'lb') +
    bar(38, 92, 36),
  tabs:
    bar(40, 32, 28, 'k') +
    bar(84, 32, 28, 't') +
    bar(128, 32, 28, 't') +
    path('M32 46h136', 'lb') +
    rect(36, 45, 36, 2, 'k', 1) +
    lines(40, 60, [120, 96, 108], 11),
  steps:
    circle(48, 50, 10, 'k') +
    check(48, 50, 'lon w15') +
    path('M62 50h24', 'lk') +
    circle(100, 50, 10, 'k') +
    text(100, 54.5, '2', 'tx on-text small') +
    path('M114 50h24', 'ln') +
    circle(152, 50, 10, 'p') +
    text(152, 54.5, '3', 'tx3 small') +
    bar(36, 72, 24, 'k') +
    bar(88, 72, 24, 'k') +
    bar(140, 72, 24, 't'),
  anchor:
    path('M56 24v72', 'lb') +
    rect(55, 44, 2, 16, 'k', 1) +
    bar(68, 26, 72) +
    bar(68, 50, 88, 'k') +
    bar(80, 66, 64) +
    bar(80, 82, 52) +
    bar(68, 98, 60),
  breadcrumb:
    path('M36 39v-5l5 -4l5 4v5z', 'ln join') +
    bar(52, 32, 24) +
    text(84, 38, '/', 'tx3') +
    bar(92, 32, 28) +
    text(128, 38, '/', 'tx3') +
    bar(136, 32, 28, 'k') +
    bar(36, 52, 72, 'b', 8) +
    lines(36, 72, [128, 112, 96], 10, 'b'),
  'page-header':
    icon('arrow-left', 40, 52, 20) +
    bar(58, 46, 44, 'k', 8) +
    bar(58, 64, 64, 't') +
    button(124, 44, 26, 'p', 18) +
    button(154, 44, 26, 'k', 18) +
    path('M28 82h152', 'lb'),
  pagination:
    bar(24, 58, 28, 't') +
    path('M63.5 57l-3 3l3 3', 'ln') +
    ['1', '2', '3', '…', '9']
      .map((value, i) => {
        const x = 76 + i * 20
        const active = i === 1
        return (
          (active ? rect(x - 10, 48, 20, 24, 'k', 5) : '') +
          text(x, 64, value, active ? 'tx on-text small' : 'tx2 small')
        )
      })
      .join('') +
    chevronRight(172, 60),
  command:
    rect(32, 14, 136, 92, 'p f', 10) +
    icon('search', 46, 30, 16) +
    bar(58, 28, 40, 'k') +
    path('M32 44h136', 'lb') +
    bar(42, 52, 20, 't', 3) +
    rect(38, 60, 124, 18, 'm', 5) +
    rect(44, 65, 8, 8, 'lk', 2) +
    bar(58, 67, 48, 'k') +
    rect(140, 64, 14, 10, 'p', 3) +
    rect(44, 85, 8, 8, 'ln', 2) +
    bar(58, 87, 40),
  'back-top':
    rect(40, 14, 120, 92, 'p', 8) +
    lines(52, 26, [96, 80, 88, 64, 76], 12, 'b') +
    circle(136, 84, 12, 'p f') +
    icon('arrow-up', 136, 84, 16),

  // chat
  'chat-message':
    rect(96, 18, 72, 22, 'm', 10) +
    bar(106, 27, 52) +
    circle(40, 56, 7, 'k') +
    path('M40 52l1.2 2.8l2.8 1.2l-2.8 1.2l-1.2 2.8l-1.2 -2.8l-2.8 -1.2l2.8 -1.2z', 'on') +
    lines(54, 54, [112, 96, 72], 11) +
    [0, 1, 2].map((i) => rect(54 + i * 14, 90, 8, 8, 'ln', 2)).join(''),
  'chat-list':
    rect(40, 10, 120, 100, 'p', 10) +
    rect(96, 20, 54, 16, 'm', 8) +
    lines(52, 46, [88, 72], 10) +
    rect(104, 70, 46, 16, 'm', 8) +
    lines(52, 96, [60], 10) +
    circle(100, 96, 8, 'p f') +
    path('M97 95l3 3l3 -3', 'lk'),
  'chat-input':
    rect(28, 28, 144, 64, 'p f', 12) +
    bar(40, 42, 76) +
    rect(38, 68, 18, 18, 'p', 5) +
    icon('plus', 47, 77, 14) +
    bar(62, 75, 28, 't') +
    circle(152, 77, 9, 'k') +
    icon('arrow-up', 152, 77, 14, 'ico-on'),
  'stream-text':
    lines(36, 34, [128, 116, 124], 13) +
    bar(36, 73, 44) +
    bar(84, 73, 14, 'b') +
    bar(102, 73, 10, 'm') +
    rect(118, 69, 6, 12, 'k', 1),
  'chat-steps': group(
    'translate(10 0)',
    bar(40, 22, 72, 't') +
      chevronDown(120, 24, 'ln') +
      path('M46 40v52', 'lb') +
      [0, 1, 2]
        .map(
          (i) =>
            circle(46, 42 + i * 22, 5, 'gs') +
            check(46, 42 + i * 22, 'lg') +
            bar(60, 40 + i * 22, [64, 80, 52][i]!),
        )
        .join(''),
  ),
  'chat-plan':
    rect(40, 14, 120, 92, 'p', 8) +
    circle(56, 32, 6, 'k') +
    check(56, 32, 'lon') +
    bar(70, 30, 52, 't') +
    path('M70 32h52', 'ln') +
    circle(56, 52, 6, 'k') +
    check(56, 52, 'lon') +
    bar(70, 50, 64, 't') +
    path('M70 52h64', 'ln') +
    circle(56, 72, 6, 'lb') +
    path('M56 66a6 6 0 0 1 6 6', 'lk w15 data') +
    bar(70, 70, 56, 'k') +
    circle(56, 92, 6, 'p') +
    bar(70, 90, 44),
  'chat-reasoning':
    path('M44 28l1.6 3.4l3.4 1.6l-3.4 1.6l-1.6 3.4l-1.6 -3.4l-3.4 -1.6l3.4 -1.6z', 'k') +
    bar(56, 31, 52, 't') +
    chevronDown(116, 33, 'ln') +
    path('M44 50v44', 'lb') +
    lines(54, 52, [96, 80, 104, 64], 12, 'b'),
  'chat-tool-call':
    rect(32, 18, 136, 84, 'p', 8) +
    rect(42, 28, 16, 16, 'm', 4) +
    icon('code', 50, 36, 14) +
    bar(66, 34, 48, 'k') +
    circle(152, 36, 6, 'gs') +
    check(152, 36, 'lg') +
    rect(42, 54, 116, 38, 'm', 5) +
    bar(50, 62, 20, 'a') +
    bar(74, 62, 40, 't') +
    bar(50, 72, 28, 'a') +
    bar(82, 72, 32, 't') +
    bar(50, 82, 52, 't'),
  'chat-sources':
    bar(36, 26, 104) +
    circle(148, 28, 5, 'm') +
    text(148, 31, '1', 'tx tiny') +
    bar(36, 40, 84) +
    circle(128, 42, 5, 'm') +
    text(128, 45, '2', 'tx tiny') +
    rect(36, 62, 60, 36, 'p', 6) +
    circle(46, 72, 4, 'b') +
    bar(54, 70, 32, 'k') +
    lines(44, 82, [44, 32], 8, 'b') +
    rect(104, 62, 60, 36, 'p', 6) +
    circle(114, 72, 4, 'b') +
    bar(122, 70, 28, 'k') +
    lines(112, 82, [40, 28], 8, 'b'),
  'chat-artifact':
    rect(36, 34, 128, 52, 'p', 10) +
    rect(46, 44, 26, 32, 'pm', 4) +
    lines(51, 52, [16, 12, 14], 6, 'b') +
    bar(82, 50, 52, 'k') +
    bar(82, 62, 36, 't') +
    chevronRight(150, 60),
  'chat-confirm':
    rect(32, 26, 136, 68, 'p', 10) +
    icon('alert-triangle', 48, 42, 14, 'ico-w') +
    bar(60, 40, 64, 'k') +
    rect(44, 52, 112, 14, 'm', 4) +
    bar(50, 57, 60, 't') +
    button(88, 74, 32, 'p', 14) +
    button(124, 74, 32, 'k', 14),
  'chat-suggestions': [0, 1, 2]
    .map((i) => {
      const w = [104, 88, 96][i]!
      const x = 100 - w / 2
      return (
        rect(x, 26 + i * 24, w, 18, 'p', 9) +
        path(`M${x + 12} ${31 + i * 24}l1 2.2l2.2 1l-2.2 1l-1 2.2l-1 -2.2l-2.2 -1l2.2 -1z`, 't') +
        bar(x + 22, 33 + i * 24, w - 34)
      )
    })
    .join(''),
  'chat-attachments': [0, 1, 2]
    .map((i) => {
      const x = 22 + i * 54
      const tone = ['rs', 'm', 'm'][i]!
      const ink = ['r', 't', 't'][i]!
      return (
        rect(x, 34, 48, 52, 'p', 7) +
        rect(x + 8, 42, 16, 18, tone, 3) +
        bar(x + 11, 49, 10, ink, 3) +
        bar(x + 8, 68, 32) +
        bar(x + 8, 76, 20, 't', 3)
      )
    })
    .join(''),
  'chat-context-meter':
    circle(66, 60, 24, 'ln w4') +
    path('M66 36a24 24 0 1 1 -16.4 41.5', 'lk w4') +
    text(104, 60, '62%', 'tx stat', 'start') +
    bar(104, 72, 56, 't') +
    bar(104, 82, 36, 'b'),
  shimmer: (id) =>
    `<defs><linearGradient id="${id}-g" x1="30" x2="170" gradientUnits="userSpaceOnUse"><stop offset=".3" class="stop-t"/><stop offset=".5" class="stop-ink"/><stop offset=".7" class="stop-t"/></linearGradient></defs>` +
    icon('sparkle', 36, 52, 16, 'ico-solid') +
    `<text x="50" y="59" class="tx bigger" style="fill:url(#${id}-g)">正在搜索资料</text>` +
    `<text x="50" y="82" class="tx mid" style="fill:url(#${id}-g)">已阅读 3 个网页</text>`,
  'chat-bubble':
    avatar(40, 34, 10) +
    `<path d="M56 26h56a8 8 0 0 1 8 8v4a8 8 0 0 1 -8 8h-52a4 4 0 0 1 -4 -4z" class="m"/>` +
    bar(64, 34, 44) +
    circle(160, 80, 10, 'k') +
    text(160, 84, '戴', 'tx on-text small') +
    `<path d="M144 72h-56a8 8 0 0 0 -8 8v4a8 8 0 0 0 8 8h52a4 4 0 0 0 4 -4z" class="k"/>` +
    bar(92, 80, 40, 'on'),

  // config
  'config-provider':
    rect(28, 14, 144, 92, 'pm dash', 10) +
    rect(36, 22, 60, 16, 'p', 4) +
    icon('sliders', 48, 30, 13) +
    bar(60, 28, 28, 't') +
    button(40, 50, 48, 'k', 20) +
    field(96, 50, 64, 20, 28) +
    rect(40, 80, 24, 14, 'k', 7) +
    circle(57, 87, 5, 'on') +
    lines(72, 85, [56], 10),
  'color-mode':
    `<path d="M100 22h-64a8 8 0 0 0 -8 8v60a8 8 0 0 0 8 8h64z" class="light-frame"/>` +
    `<path d="M100 22h64a8 8 0 0 1 8 8v60a8 8 0 0 1 -8 8h-64z" class="dark-frame"/>` +
    icon('sun', 52, 44, 26, 'ico-sun') +
    icon('moon', 148, 44, 24, 'ico-moon') +
    bar(40, 70, 48, 'light-bar') +
    bar(40, 80, 32, 'light-bar') +
    bar(112, 70, 48, 'dark-bar') +
    bar(112, 80, 32, 'dark-bar'),
}

/** The drawing for a component page, by its file name. */
export function overviewArt(name: string) {
  const art = arts[name]
  if (!art) return ''
  return typeof art === 'function' ? art(`ov-${name}`) : art
}

/** A flow node and one of its ports. */
const flowNode = (x: number, y: number, w: number, h: number, c = 'p') => rect(x, y, w, h, c, 4)
const flowPort = (cx: number, cy: number) => circle(cx, cy, 2, 'p lk')

/** Drawings for the ecosystem overview, one per package. */
const ecosystemArts: Record<string, string | ((id: string) => string)> = {
  // a document of blocks, one hovered with its handle in the gutter
  editor:
    rect(24, 14, 152, 92, 'p', 8) +
    bar(56, 26, 64, 'k', 6) +
    lines(56, 42, [104, 84], 9) +
    rect(52, 58, 112, 16, 'm', 4) +
    bar(56, 64, 76) +
    icon('plus', 34, 66, 11, 'ico-3') +
    icon('grip-vertical', 44, 66, 11, 'ico-3') +
    rect(56, 80, 8, 8, 'k', 2) +
    icon('check', 60, 84, 8, 'ico-on') +
    bar(70, 82, 56, 't') +
    rect(56, 92, 8, 8, 'ps', 2) +
    bar(70, 94, 44),
  // nodes with ports on a dotted canvas
  flow: (id) => {
    return (
      `<defs><pattern id="${id}-d" width="8" height="8" x="24" y="14" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r=".7" class="b"/></pattern></defs>` +
      rect(24, 14, 152, 92, 'p', 8) +
      `<rect x="24" y="14" width="152" height="92" rx="8" style="fill:url(#${id}-d)"/>` +
      path(
        'M64 60c10 0 10 -20 20 -20M64 60c10 0 10 20 20 20M120 40c10 0 10 20 20 20M120 80c10 0 10 -20 20 -20',
        'ln',
      ) +
      flowNode(36, 52, 28, 16) +
      bar(42, 58, 14, 'k') +
      flowNode(84, 30, 36, 20) +
      bar(90, 36, 22, 'k') +
      flowNode(84, 70, 36, 20) +
      bar(90, 76, 18, 'k') +
      flowNode(140, 50, 28, 20, 'ps la') +
      bar(146, 58, 14, 'k') +
      flowPort(64, 60) +
      flowPort(84, 40) +
      flowPort(120, 40) +
      flowPort(84, 80) +
      flowPort(120, 80) +
      flowPort(140, 60)
    )
  },
  // a task table beside bars on a timeline, linked step by step
  gantt: () => {
    const rows = [
      { label: 36, x: 84, w: 60, summary: true },
      { label: 28, x: 84, w: 20 },
      { label: 32, x: 112, w: 26 },
      { label: 24, x: 146, w: 18 },
      { label: 20, x: 172, w: 0 },
    ]
    const top = 36
    const gap = 13
    let art =
      rect(20, 14, 160, 92, 'p', 8) +
      path('M20 30h160M72 14v92', 'lb') +
      bar(28, 20, 20, 't') +
      bar(80, 20, 24, 't') +
      bar(132, 20, 16, 't')
    rows.forEach((row, i) => {
      const y = top + i * gap
      art += bar(row.summary ? 28 : 36, y + 2, row.label, row.summary ? 'k' : 's')
      if (row.summary) art += rect(row.x, y + 2, row.w, 4, 'k', 1)
      else if (row.w) art += rect(row.x, y, row.w, 8, 'm lb', 3)
      else
        art += rect(-3, -3, 6, 6, 'k', 1).replace(
          '/>',
          ` transform="translate(${row.x} ${y + 4}) rotate(45)"/>`,
        )
      const prev = rows[i - 1]
      if (prev && !prev.summary) {
        const from = prev.x + prev.w
        const to = row.w ? row.x : row.x - 4
        art += path(`M${from} ${y - gap + 4}h4v${gap}h${to - from - 4}`, 'ln')
      }
    })
    return art + path(`M124 30v76`, 'la') + circle(124, 30, 2, 'a')
  },
  // two series over a quiet grid: a line with its area, and a second color
  chart: () => {
    const left = 48
    const right = 166
    const top = 30
    const bottom = 92
    const sales = [30, 42, 38, 56, 50, 68, 74]
    const visits = [18, 24, 32, 28, 40, 36, 48]
    const x = (i: number) => left + ((right - left) * i) / (sales.length - 1)
    const y = (v: number) => bottom - ((bottom - top) * v) / 80
    const line = (values: number[]) =>
      values.map((v, i) => `${i ? 'L' : 'M'}${x(i)} ${y(v)}`).join('')
    let art = rect(20, 14, 160, 92, 'p', 8)
    for (const v of [20, 40, 60, 80]) art += path(`M${left} ${y(v)}H${right}`, 'lb')
    art += path(`M${left} ${bottom}H${right}`, 'ln')
    for (const v of [0, 40, 80]) art += bar(left - 18, y(v) - 2, v ? 10 : 6, 't')
    art +=
      path(`${line(sales)}V${bottom}H${left}Z`, 'ac1') +
      path(line(sales), 'lk w2 join data') +
      path(line(visits), 'lc2 w2 join data')
    sales.forEach((v, i) => (art += circle(x(i), y(v), 2, 'k')))
    visits.forEach((v, i) => (art += circle(x(i), y(v), 2, 'c2')))
    return art
  },
  // the icon gallery: a search field above a grid of icons
  icons:
    field(40, 18, 120, 20, 0) +
    icon('search', 52, 28, 12, 'ico-3') +
    bar(62, 26, 40, 'b') +
    [
      ['bell', 'mail', 'calendar', 'home'],
      ['heart', 'star', 'sun', 'moon'],
    ]
      .flatMap((row, r) =>
        row.map((name, i) => {
          const x = 40 + i * 31
          const y = 46 + r * 28
          return (
            rect(x, y, 27, 24, r === 0 && i === 1 ? 'pm' : 'p', 5) +
            icon(name, x + 13.5, y + 12, 14)
          )
        }),
      )
      .join(''),
  // the module added to the Nuxt config
  nuxt:
    rect(28, 16, 144, 88, 'p', 8) +
    path('M28 34h144', 'lb') +
    text(40, 28, 'nuxt.config.ts', 'tx tx2 small mono', 'start') +
    bar(40, 44, 72, 't') +
    bar(48, 56, 36) +
    rect(42, 64, 120, 16, 'as', 4) +
    text(56, 75, "'@dou-ui/nuxt'", 'tx small mono', 'start') +
    bar(48, 88, 8) +
    bar(40, 96, 8, 't'),
}

/** The drawing for a package on the ecosystem overview. */
export function ecosystemArt(name: string) {
  const art = ecosystemArts[name]
  if (!art) return ''
  return typeof art === 'function' ? art(`ov-eco-${name}`) : art
}
