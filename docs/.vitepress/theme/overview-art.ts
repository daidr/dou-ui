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
const chevronDown = (x: number, y: number, c = 'lk') => path(`M${x - 3} ${y - 1.5}l3 3l3 -3`, c)
const chevronRight = (x: number, y: number, c = 'lk') => path(`M${x - 1.5} ${y - 3}l3 3l-3 3`, c)
const check = (x: number, y: number, c = 'lk') => path(`M${x - 3.5} ${y}l2.5 2.5l4.5 -5`, c)
const cross = (x: number, y: number, c = 'lk', s = 3) =>
  path(`M${x - s} ${y - s}l${s * 2} ${s * 2}M${x + s} ${y - s}l${-s * 2} ${s * 2}`, c)
const plus = (x: number, y: number, c = 'lk', s = 4) =>
  path(`M${x - s} ${y}h${s * 2}M${x} ${y - s}v${s * 2}`, c)
/** Rows of text lines, one per width. */
const lines = (x: number, y: number, widths: number[], gap = 10, c = 's') =>
  widths.map((w, i) => bar(x, y + i * gap, w, c)).join('')
const avatar = (cx: number, cy: number, r: number, c = 'm') =>
  circle(cx, cy, r, c) +
  circle(cx, cy - r * 0.18, r * 0.34, 's') +
  path(`M${cx - r * 0.6} ${cy + r * 0.62}a${r * 0.6} ${r * 0.5} 0 0 1 ${r * 1.2} 0`, 'ln w15')
const star = (cx: number, cy: number, r: number, c: string) => {
  const points = Array.from({ length: 10 }, (_, i) => {
    const angle = (Math.PI / 5) * i - Math.PI / 2
    const radius = i % 2 ? r * 0.48 : r
    return `${(cx + Math.cos(angle) * radius).toFixed(2)},${(cy + Math.sin(angle) * radius).toFixed(2)}`
  })
  return `<polygon points="${points.join(' ')}" class="${c} round"/>`
}
const spinner = (cx: number, cy: number, r: number) =>
  circle(cx, cy, r, 'lb w2') + path(`M${cx} ${cy - r}a${r} ${r} 0 0 1 ${r} ${r}`, 'lk w2')
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
  rect(x, y, 21, 21, 'k', 3) +
  rect(x + 3, y + 3, 15, 15, 'bg', 1.5) +
  rect(x + 6, y + 6, 9, 9, 'k', 1)

/** A tiny pseudo-random generator, so drawings stay the same between builds. */
function random(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

const arts: Record<string, string | ((id: string) => string)> = {
  // basics
  button: button(36, 48, 60) + button(104, 48, 60, 'p'),
  toggle:
    rect(52, 44, 96, 32, 'p', 7) +
    rect(56, 48, 28, 24, 'm', 5) +
    text(70, 65, 'B', 'tx bold') +
    text(100, 65, 'I', 'tx2 italic') +
    text(130, 65, 'U', 'tx2 underline'),
  icon:
    [0, 1, 2, 3].map((i) => rect(36 + i * 34, 44, 28, 28, i === 1 ? 'pm' : 'p', 6)).join('') +
    circle(49, 57, 5, 'lk w15') +
    path('M53 61l3 3', 'lk w15') +
    path('M78 63v-6l6 -5l6 5v6z', 'lk w15 join') +
    star(118, 58, 7, 'lk w15') +
    plus(152, 58, 'lk w15', 6),
  text:
    bar(40, 38, 72, 'k', 6) +
    lines(40, 54, [120, 104], 10) +
    bar(40, 78, 36, 't') +
    bar(80, 78, 36, 'g') +
    bar(120, 78, 36, 'r'),
  ellipsis:
    rect(36, 46, 128, 28, 'p', 6) +
    bar(48, 58, 80) +
    circle(136, 60, 1.6, 't') +
    circle(142, 60, 1.6, 't') +
    circle(148, 60, 1.6, 't'),
  highlight:
    rect(78, 46, 40, 12, 'ws', 3) +
    bar(40, 50, 32) +
    bar(82, 50, 32, 'w') +
    bar(124, 50, 36) +
    lines(40, 66, [120, 84], 10),
  link:
    bar(52, 50, 76, 'a') +
    path('M52 60h76', 'la') +
    path('M138 58l8 -8M140 50h6v6', 'la w15') +
    lines(52, 72, [96], 10),
  typography:
    text(44, 76, 'Aa', 'tx display', 'start') +
    bar(110, 44, 48, 'k', 6) +
    lines(110, 58, [52, 44, 50], 9),
  'copy-button':
    rect(32, 46, 136, 28, 'pm', 6) +
    bar(44, 58, 72, 't') +
    rect(138, 50, 20, 20, 'p', 5) +
    rect(144, 56, 8, 9, 'lk', 1.5) +
    path('M146 56v-2h7v9h-1', 'lk'),
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
    rect(36, 44, 36, 32, 'pm', 6) +
    rect(82, 44, 36, 32, 'pm', 6) +
    rect(128, 44, 36, 32, 'pm', 6) +
    rect(72, 44, 10, 32, 'as') +
    rect(118, 44, 10, 32, 'as') +
    path('M74 86h6M120 86h6', 'la'),
  toolbar:
    rect(32, 44, 136, 32, 'p', 8) +
    [0, 1, 2].map((i) => rect(38 + i * 24, 48, 20, 24, i === 0 ? 'm' : 'p0', 5)).join('') +
    path('M45 56v8M53 56v8M45 60h8', 'lk w15') +
    circle(72, 60, 4, 'lk w15') +
    path('M90 56h8M90 60h8M90 64h5', 'lk w15') +
    path('M114 52v16', 'lb') +
    bar(122, 58, 20) +
    chevronDown(152, 60),
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
    path('M136 31l4 4M138 29l5 5l-3 1l-3 3l-1 -1l-3 -3l3 -3z', 'lk join'),

  // form
  input:
    bar(44, 38, 28, 't') +
    rect(44, 48, 112, 28, 'ps', 6) +
    bar(54, 60, 44, 'k') +
    path('M102 55v14', 'lk'),
  textarea:
    rect(40, 28, 120, 64, 'p', 6) +
    lines(50, 40, [92, 100, 64], 11) +
    path('M151 85l4 -4M146 85l9 -9', 'ln'),
  'input-number':
    rect(52, 46, 96, 28, 'p', 6) +
    path('M76 46v28M124 46v28', 'lb') +
    path('M59 60h10', 'lk w15') +
    plus(136, 60, 'lk w15', 5) +
    text(100, 64.5, '128', 'tx mono'),
  'input-tag':
    rect(32, 46, 136, 28, 'ps', 6) +
    rect(38, 51, 40, 18, 'm', 4) +
    bar(44, 58, 18, 't') +
    cross(70, 60, 'ln', 2) +
    rect(82, 51, 44, 18, 'm', 4) +
    bar(88, 58, 22, 't') +
    cross(118, 60, 'ln', 2) +
    path('M132 54v12', 'lk'),
  'input-otp': [0, 1, 2, 3, 4, 5]
    .map((i) => {
      const x = 37 + i * 22
      const c = i === 3 ? 'ps la' : 'p'
      return (
        rect(x, 46, 18, 28, c, 5) +
        (i < 3 ? text(x + 9, 64.5, String([4, 8, 1][i]), 'tx mono') : '') +
        (i === 3 ? path(`M${x + 9} 54v12`, 'lk') : '')
      )
    })
    .join(''),
  checkbox: [0, 1, 2]
    .map((i) => {
      const y = 36 + i * 20
      const on = i !== 1
      return (
        rect(56, y, 14, 14, on ? 'k' : 'p', 4) +
        (on ? check(63, y + 7, 'lon w15') : '') +
        bar(80, y + 5, [56, 44, 64][i]!)
      )
    })
    .join(''),
  radio: [0, 1, 2]
    .map((i) => {
      const y = 43 + i * 20
      const on = i === 0
      return (
        circle(63, y, 7, on ? 'k' : 'p') +
        (on ? circle(63, y, 2.5, 'on') : '') +
        bar(80, y - 2, [52, 64, 40][i]!)
      )
    })
    .join(''),
  switch:
    bar(48, 44, 52) +
    rect(124, 39, 28, 16, 'k', 8) +
    circle(144, 47, 6, 'on') +
    bar(48, 72, 40) +
    rect(124, 67, 28, 16, 'm lb', 8) +
    circle(132, 75, 6, 'p f'),
  slider:
    bar(36, 44, 128, 'b') +
    bar(36, 44, 76, 'k') +
    circle(112, 46, 8, 'p f') +
    bar(36, 78, 128, 'b') +
    bar(64, 78, 60, 'k') +
    circle(64, 80, 6, 'p f') +
    circle(124, 80, 6, 'p f'),
  rate:
    [0, 1, 2, 3, 4].map((i) => star(52 + i * 24, 58, 10, i < 3 ? 'k' : 'b')).join('') +
    bar(84, 80, 32, 't'),
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
    rect(36, 46, 128, 28, 'ps', 6) +
    rect(84, 50, 22, 20, 'as', 4) +
    text(62, 64.5, '2026', 'tx mono') +
    text(95, 64.5, '10', 'tx mono') +
    text(119, 64.5, '29', 'tx mono') +
    text(81, 64.5, '/', 'tx3 mono') +
    text(108, 64.5, '/', 'tx3 mono') +
    rect(144, 54, 12, 12, 'lk', 2) +
    path('M144 58h12', 'lk'),
  'input-time':
    rect(52, 46, 96, 28, 'ps', 6) +
    rect(64, 50, 22, 20, 'as', 4) +
    text(75, 64.5, '09', 'tx mono') +
    text(89, 64, ':', 'tx3 mono') +
    text(103, 64.5, '30', 'tx mono') +
    circle(134, 60, 6, 'lk') +
    path('M134 57v3l2 2', 'lk'),
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
          rect(34, 34 + i * 14, 8, 8, i === 1 ? 'k' : 'p', 2) +
          bar(48, 36 + i * 14, [26, 30, 22, 28][i]!) +
          (i < 2 ? rect(122, 34 + i * 14, 8, 8, 'p', 2) + bar(136, 36 + i * 14, [28, 22][i]!) : ''),
      )
      .join('') +
    check(38, 52, 'lon') +
    rect(92, 42, 16, 16, 'k', 4) +
    chevronRight(100, 50, 'lon') +
    rect(92, 62, 16, 16, 'p', 4) +
    path('M101.5 67l-3 3l3 3', 'ln'),
  'segmented-control':
    rect(32, 46, 136, 28, 'm', 7) +
    rect(36, 50, 42, 20, 'p f', 5) +
    bar(46, 58, 22, 'k') +
    bar(89, 58, 22, 't') +
    bar(134, 58, 22, 't') +
    path('M123 54v12', 'lb'),
  'check-tag':
    rect(34, 40, 40, 20, 'k', 10) +
    bar(44, 48, 20, 'on') +
    rect(80, 40, 48, 20, 'p', 10) +
    bar(90, 48, 28) +
    rect(134, 40, 32, 20, 'p', 10) +
    bar(142, 48, 16) +
    rect(54, 66, 44, 20, 'p', 10) +
    bar(64, 74, 24) +
    rect(104, 66, 44, 20, 'k', 10) +
    bar(114, 74, 24, 'on'),
  upload:
    rect(36, 16, 128, 54, 'pm dash', 8) +
    path('M93 46h-6a7 7 0 0 1 0 -14a9 9 0 0 1 17 -2a7 7 0 0 1 3 16h-6', 'lk w15') +
    path('M100 52v-14M95 42l5 -5l5 5', 'lk w15') +
    rect(36, 78, 128, 26, 'p', 6) +
    rect(44, 85, 10, 12, 'lk', 2) +
    bar(62, 86, 48) +
    bar(62, 94, 88, 'b', 3) +
    bar(62, 94, 60, 'k', 3),
  'image-cropper': (id) =>
    `<defs><mask id="${id}-m"><rect width="200" height="120" fill="#fff"/><rect x="68" y="32" width="64" height="56" fill="#000"/></mask></defs>` +
    image(36, 18, 128, 84, 8) +
    `<rect x="36" y="18" width="128" height="84" rx="8" class="dim2" mask="url(#${id}-m)"/>` +
    rect(68, 32, 64, 56, 'lon') +
    path('M68 40v-8h8M124 32h8v8M132 80v8h-8M76 88h-8v-8', 'lon w2') +
    path('M89.3 32v56M110.7 32v56M68 50.7h64M68 69.3h64', 'lon thin'),
  'field-group':
    rect(28, 46, 144, 28, 'p', 6) +
    rect(28, 46, 44, 28, 'm', 6) +
    rect(64, 46, 8, 28, 'm') +
    path('M72 46v28', 'lb') +
    bar(36, 58, 18, 't') +
    chevronDown(62, 60) +
    bar(82, 58, 40) +
    rect(132, 46, 40, 28, 'k', 6) +
    rect(132, 46, 8, 28, 'k') +
    bar(142, 58, 20, 'on'),
  form:
    bar(48, 18, 24, 't') +
    field(48, 26, 104, 22, 48) +
    bar(48, 56, 24, 't') +
    field(48, 64, 104, 22, 36) +
    button(48, 94, 44, 'k', 20) +
    button(98, 94, 44, 'p', 20),

  // overlays
  tooltip:
    button(70, 68, 60, 'p') +
    rect(64, 28, 72, 26, 'k f', 6) +
    path('M95 54l5 5l5 -5z', 'k') +
    bar(76, 39, 48, 'on'),
  popover:
    button(70, 84, 60, 'p', 22) +
    rect(46, 14, 108, 58, 'p f', 8) +
    path('M94 72l6 6l6 -6', 'p lb') +
    rect(94, 70, 12, 3, 'p0s') +
    bar(58, 26, 40, 'k') +
    lines(58, 40, [80, 64], 10) +
    button(118, 50, 28, 'k', 16),
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
    circle(58, 30, 6, 'ws') +
    path('M58 27v3', 'lw w15') +
    circle(58, 33, 0.6, 'lw w15') +
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
    circle(46, 42, 6, 'la w15') +
    path('M46 41v4', 'la w15') +
    circle(46, 38.5, 0.6, 'la w15') +
    bar(58, 40, 64, 'a') +
    rect(32, 64, 136, 28, 'gs', 6) +
    circle(46, 78, 6, 'lg w15') +
    check(46, 78, 'lg w15') +
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
    circle(48, 83, 7, 'gs') +
    check(48, 83, 'lg w15') +
    bar(62, 76, 52, 'k') +
    bar(62, 86, 76),
  spinner: spinner(100, 60, 18),
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
    bar(40, 82, 44, 'a', 6),
  'progress-group':
    rect(32, 48, 136, 10, 'b', 5) +
    `<path d="M37 48h43v10h-43a5 5 0 0 1 0 -10z" class="a"/>` +
    rect(82, 48, 32, 10, 'g') +
    rect(116, 48, 20, 10, 'w') +
    circle(38, 76, 3, 'a') +
    bar(45, 74, 22) +
    circle(80, 76, 3, 'g') +
    bar(87, 74, 22) +
    circle(122, 76, 3, 'w') +
    bar(129, 74, 22),
  skeleton:
    circle(54, 44, 14, 'sk') +
    rect(76, 34, 68, 8, 'sk', 4) +
    rect(76, 48, 44, 8, 'sk', 4) +
    rect(40, 72, 120, 8, 'sk', 4) +
    rect(40, 86, 92, 8, 'sk', 4),
  result:
    circle(100, 42, 16, 'gs') +
    path('M93 42l5 5l9 -10', 'lg w2') +
    bar(76, 68, 48, 'k', 6) +
    bar(84, 80, 32, 't') +
    button(80, 92, 40, 'k', 18),

  // data display
  card:
    rect(44, 16, 112, 88, 'p', 10) +
    bar(56, 28, 40, 'k', 6) +
    path('M44 44h112', 'lb') +
    lines(56, 54, [88, 72, 80], 10) +
    button(116, 84, 30, 'p', 14),
  avatar:
    avatar(72, 60, 18) +
    circle(100, 60, 19, 'bg') +
    circle(100, 60, 18, 'k') +
    text(100, 66, '戴', 'tx on-text big') +
    circle(128, 60, 19, 'bg') +
    avatar(128, 60, 18, 'pm'),
  user:
    avatar(64, 60, 18) +
    circle(77, 73, 4.5, 'g ring2') +
    bar(92, 50, 52, 'k', 6) +
    bar(92, 64, 40, 't'),
  badge:
    rect(56, 44, 32, 32, 'p', 8) +
    path('M66 64v-5a6 6 0 0 1 12 0v5l2 2h-16z M70 68a2 2 0 0 0 4 0', 'lk w15 join') +
    circle(87, 45, 7, 'r') +
    text(87, 48.5, '3', 'tx on-tone small') +
    button(108, 48, 44, 'p') +
    circle(152, 48, 4, 'r ring2'),
  tag:
    rect(36, 40, 40, 18, 'as', 5) +
    bar(44, 47, 24, 'a') +
    rect(82, 40, 48, 18, 'gs', 5) +
    bar(90, 47, 32, 'g') +
    rect(136, 40, 28, 18, 'm', 5) +
    bar(142, 47, 16, 't') +
    rect(54, 64, 44, 18, 'p', 5) +
    bar(62, 71, 28) +
    rect(104, 64, 40, 18, 'rs', 5) +
    bar(112, 71, 24, 'r'),
  kbd:
    rect(58, 42, 36, 36, 'p kbd', 7) +
    text(76, 66, '⌘', 'tx big') +
    text(104, 65, '+', 'tx3') +
    rect(114, 42, 36, 36, 'p kbd', 7) +
    text(132, 66, 'K', 'tx big'),
  empty:
    path('M76 52l8 -16h32l8 16v20a4 4 0 0 1 -4 4h-40a4 4 0 0 1 -4 -4z', 'm lk join') +
    path('M76 52h14l3 6h14l3 -6h14', 'lk join') +
    bar(80, 88, 40, 't'),
  statistic:
    bar(48, 30, 40, 't') +
    text(48, 66, '128,430', 'tx stat', 'start') +
    path('M50 84l4 -4l4 4M54 80v8', 'lg w15') +
    bar(64, 82, 32, 'g'),
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
    circle(64, 60, 14, 'lk w15') +
    path('M64 52v8l5 4', 'lk w15') +
    text(88, 65, '3 分钟前', 'tx big', 'start'),
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
    [0, 1, 2, 3, 4]
      .map((i) => rect(4 + i * 44, 34, 38, 20, 'p', 10) + bar(14 + i * 44, 42, 18))
      .join('') +
    [0, 1, 2, 3, 4]
      .map((i) => rect(-14 + i * 44, 64, 38, 20, 'p', 10) + bar(-4 + i * 44, 72, 18))
      .join('') +
    '</g>',
  qrcode: () => {
    const next = random(7)
    let cells = ''
    for (let row = 0; row < 11; row++) {
      for (let col = 0; col < 11; col++) {
        const inFinder = (row < 4 && col < 4) || (row < 4 && col > 6) || (row > 6 && col < 4)
        if (!inFinder && next() > 0.52) cells += rect(67 + col * 6, 27 + row * 6, 5, 5, 'k', 1)
      }
    }
    return finder(67, 27) + finder(112, 27) + finder(67, 72) + cells
  },
  watermark: (id) =>
    `<defs><clipPath id="${id}-c"><rect x="36" y="18" width="128" height="84" rx="8"/></clipPath></defs>` +
    rect(36, 18, 128, 84, 'p', 8) +
    `<g clip-path="url(#${id}-c)">` +
    group(
      'rotate(-20 100 60)',
      [0, 1, 2]
        .map((row) =>
          [0, 1, 2]
            .map((col) => bar(32 + col * 52 + (row % 2) * 24, 34 + row * 24, 30, 'mark'))
            .join(''),
        )
        .join(''),
    ) +
    '</g>' +
    lines(48, 30, [72, 96, 60], 30, 's'),
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
    bar(76, 22, 56, 'k') +
    bar(76, 31, 36, 't') +
    bar(76, 54, 48, 'k') +
    bar(76, 63, 40, 't') +
    bar(76, 86, 60, 'k') +
    bar(76, 95, 32, 't'),
  'flow-graph':
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
      rect(114, 62, 32, 7, 'gs', 2) +
      rect(114, 62, 2, 7, 'g') +
      rect(31, 80, 40, 7, 'ws', 2) +
      rect(31, 80, 2, 7, 'w') +
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
  sparkline: (id) =>
    `<defs><linearGradient id="${id}-a" x2="0" y2="1"><stop offset="0" class="stop-ink" stop-opacity=".16"/><stop offset="1" class="stop-ink" stop-opacity="0"/></linearGradient></defs>` +
    bar(40, 26, 28, 't') +
    text(40, 52, '2,846', 'tx stat-sm', 'start') +
    `<path d="M40 92l12 -8l12 4l12 -12l12 6l12 -14l12 4l12 -16l12 8l12 -10v38h-120z" fill="url(#${id}-a)"/>` +
    path('M40 92l12 -8l12 4l12 -12l12 6l12 -14l12 4l12 -16l12 8l12 -10', 'lk w15 join') +
    circle(160, 64, 3, 'k'),
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
    lines(52, 10, [72, 56], 10, 'b') +
    rect(44, 30, 112, 60, 'p', 8) +
    [0, 1, 2, 3]
      .map((i) => bar(56, 40 + i * 12, [72, 56, 64, 48][i]!) + bar(136, 40 + i * 12, 10, 't'))
      .join('') +
    lines(52, 98, [64, 72], 10, 'b'),
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
    path('M60 24v72', 'lb') +
    rect(59, 44, 2, 16, 'k', 1) +
    bar(72, 26, 48) +
    bar(72, 50, 56, 'k') +
    bar(84, 66, 40) +
    bar(84, 82, 32) +
    bar(72, 98, 44),
  breadcrumb:
    path('M34 63v-5l5 -4l5 4v5z', 'ln join') +
    bar(50, 58, 24) +
    text(84, 64, '/', 'tx3') +
    bar(94, 58, 28) +
    text(132, 64, '/', 'tx3') +
    bar(142, 58, 24, 'k'),
  'page-header':
    path('M40 46l-6 6l6 6M34 52h14', 'lk w15') +
    bar(58, 46, 44, 'k', 8) +
    bar(58, 64, 64, 't') +
    button(124, 44, 26, 'p', 18) +
    button(154, 44, 26, 'k', 18) +
    path('M28 82h152', 'lb'),
  pagination:
    path('M39.5 57l-3 3l3 3', 'ln') +
    ['1', '2', '3', '…', '9']
      .map((value, i) => {
        const x = 52 + i * 22
        const active = i === 1
        return (
          (active ? rect(x - 10, 49, 20, 22, 'k', 5) : '') +
          text(x, 64, value, active ? 'tx on-text small' : 'tx2 small')
        )
      })
      .join('') +
    chevronRight(162, 60),
  command:
    rect(32, 14, 136, 92, 'p f', 10) +
    circle(46, 30, 4, 'lk') +
    path('M49 33l3 3', 'lk') +
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
    path('M131 86l5 -5l5 5M136 81v9', 'lk w15'),

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
    rect(40, 70, 14, 14, 'ln', 4) +
    plus(47, 77, 'lk', 3) +
    bar(62, 75, 28, 't') +
    circle(152, 77, 9, 'k') +
    path('M152 81v-8M148.5 76.5l3.5 -3.5l3.5 3.5', 'lon w15'),
  'stream-text':
    lines(36, 34, [128, 116, 124], 13) + bar(36, 73, 64) + rect(104, 70, 6, 10, 'k', 1),
  'chat-steps':
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
    path('M56 66a6 6 0 0 1 6 6', 'lk w15') +
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
    path('M48 33l-3 3l3 3M52 33l3 3l-3 3', 'lk') +
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
    circle(48, 42, 6, 'ws') +
    path('M48 39v3', 'lw w15') +
    circle(48, 45, 0.6, 'lw w15') +
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
      const x = 30 + i * 48
      const tone = ['rs', 'm', 'm'][i]!
      const ink = ['r', 't', 't'][i]!
      return (
        rect(x, 40, 44, 40, 'p', 7) +
        rect(x + 6, 46, 14, 16, tone, 3) +
        bar(x + 9, 52, 8, ink, 3) +
        bar(x + 6, 68, 30) +
        bar(x + 6, 74, 18, 't', 2)
      )
    })
    .join(''),
  'chat-context-meter':
    circle(70, 60, 16, 'lb w4') +
    path('M70 44a16 16 0 1 1 -15.2 21', 'lk w4') +
    text(98, 58, '62%', 'tx big', 'start') +
    bar(98, 68, 40, 't'),
  shimmer: (id) =>
    `<defs><linearGradient id="${id}-g" x1="40" x2="160" gradientUnits="userSpaceOnUse"><stop offset=".2" class="stop-mute"/><stop offset=".5" class="stop-t"/><stop offset=".8" class="stop-mute"/></linearGradient></defs>` +
    `<rect x="40" y="52" width="120" height="6" rx="3" fill="url(#${id}-g)"/>` +
    `<rect x="40" y="66" width="80" height="6" rx="3" fill="url(#${id}-g)"/>`,
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
    rect(36, 22, 54, 14, 'p', 4) +
    bar(42, 27, 30, 't') +
    button(40, 50, 48, 'k', 20) +
    field(96, 50, 64, 20, 28) +
    rect(40, 80, 24, 14, 'k', 7) +
    circle(57, 87, 5, 'on') +
    lines(72, 82, [56], 10),
  'color-mode':
    `<path d="M100 22h-64a8 8 0 0 0 -8 8v60a8 8 0 0 0 8 8h64z" class="light-frame"/>` +
    `<path d="M100 22h64a8 8 0 0 1 8 8v60a8 8 0 0 1 -8 8h-64z" class="dark-frame"/>` +
    circle(52, 44, 7, 'sun') +
    path('M52 31v3M52 54v3M39 44h3M62 44h3', 'sun-ray') +
    path('M154 38a9 9 0 1 0 6 12a7 7 0 0 1 -6 -12z', 'moon') +
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
