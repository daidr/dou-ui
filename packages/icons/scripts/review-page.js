// Runs inside a review sheet. For every card it measures:
// - the bounding box: the body belongs in 3–21, wide/tall/special shapes may reach 2.5–21.5;
// - gaps: the closest spots where two strokes come near without joining. Two
//   centerlines d apart leave d × 0.667 − 1.25px of white at 16px, so under
//   3.5 the gap closes to less than 1px, and under 2.5 the strokes merge.
//   Under 1.2 the strokes already look joined: the endpoint misses the other
//   centerline, or two strokes meet at a sharp angle;
// - ink: the share of the 24px canvas the icon covers, against the set's median;
// and draws the 16px render at 1× device pixels, enlarged, so blur shows.
const stroke = (size) => 0.75 + size / 32

const coverage = (canvas) => {
  const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)
  let ink = 0
  for (let i = 3; i < data.length; i += 4) ink += data[i] / 255
  return ink / (canvas.width * canvas.height)
}

;(async () => {
  const NS = 'http://www.w3.org/2000/svg'
  const STEP = 0.12
  const TOUCH = 0.2
  const MIN_GAP = 3.5
  const MERGE = 2.5
  const JOINT = 1.2
  // 24px coverage median of the whole set; heavier than 1.45× needs a reason
  const INK_MEDIAN = 0.172
  const INK_LIMIT = 1.45

  const render = async (body, size) => {
    const width = (stroke(size) * 24) / size
    const inner = body
      .replaceAll('class="dot"', `stroke-width="${width * 1.5}"`)
      .replaceAll('class="fill"', 'fill="#111"')
    const img = new Image()
    img.src =
      'data:image/svg+xml;charset=utf-8,' +
      encodeURIComponent(
        `<svg xmlns="${NS}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`,
      )
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    canvas.getContext('2d').drawImage(img, 0, 0)
    return canvas
  }

  // Points along every stroke: [x, y, curve, length along it, extra radius of a dot]
  const sample = (group) => {
    const points = []
    let curve = 0
    for (const el of group.children) {
      curve++
      const dot = el.getAttribute('class') === 'dot'
      const length = el.getTotalLength()
      if (dot || length < 0.05) {
        const b = el.getBBox()
        points.push([b.x + b.width / 2, b.y + b.height / 2, curve, 0, dot ? 0.375 : 0])
        continue
      }
      const n = Math.max(2, Math.ceil(length / STEP))
      let prev
      for (let i = 0; i <= n; i++) {
        const s = (length * i) / n
        const p = el.getPointAtLength(s)
        // a jump means a new subpath
        if (prev && Math.hypot(p.x - prev.x, p.y - prev.y) > STEP * 3) curve++
        points.push([p.x, p.y, curve, s, 0])
        prev = p
      }
    }
    return points
  }

  const gaps = (group) => {
    const P = sample(group)
    const candidates = []
    for (let i = 0; i < P.length; i++)
      for (let j = i + 1; j < P.length; j++) {
        const p = P[i]
        const q = P[j]
        if (Math.abs(p[0] - q[0]) > MIN_GAP || Math.abs(p[1] - q[1]) > MIN_GAP) continue
        const d = Math.hypot(p[0] - q[0], p[1] - q[1]) - p[4] - q[4]
        if (d >= MIN_GAP || d < TOUCH) continue
        // the same stroke bending round a corner is not a gap
        if (p[2] === q[2] && Math.abs(p[3] - q[3]) < d * 1.6 + 0.3) continue
        candidates.push([d, i, j])
      }
    candidates.sort((a, b) => a[0] - b[0])
    // Points near a real joint (where the strokes touch) are the joint itself.
    const window = (i, reach) => {
      const out = []
      for (const dir of [-1, 1])
        for (
          let k = i;
          k >= 0 && k < P.length && P[k][2] === P[i][2] && Math.abs(P[k][3] - P[i][3]) <= reach;
          k += dir
        )
          out.push(k)
      return out
    }
    const joined = (i, j, reach) => {
      const near = window(j, reach)
      return window(i, reach).some((a) =>
        near.some(
          (b) =>
            Math.hypot(P[a][0] - P[b][0], P[a][1] - P[b][1]) < TOUCH &&
            !(P[a][2] === P[b][2] && Math.abs(P[a][3] - P[b][3]) < 0.3),
        ),
      )
    }
    const spots = []
    for (const [d, i, j] of candidates) {
      if (spots.length >= 6) break
      const close = (a, b) => Math.hypot(P[a][0] - P[b][0], P[a][1] - P[b][1]) < 2.5
      if (spots.some((s) => close(s.i, i) || close(s.j, j))) continue
      if (joined(i, j, Math.max(2.5, d * 1.8))) continue
      spots.push({ d: Math.round(d * 100) / 100, i, j })
    }
    return spots.map(({ d, i, j }) => ({
      d,
      x: Math.round((P[i][0] + P[j][0]) * 5) / 10,
      y: Math.round((P[i][1] + P[j][1]) * 5) / 10,
    }))
  }

  window.boxes = {}
  for (const card of document.querySelectorAll('.card')) {
    const icon = card.querySelector('.ic')
    const b = icon.getBBox()
    const right = b.x + b.width
    const bottom = b.y + b.height
    const out = b.x < 2.49 || b.y < 2.49 || right > 21.51 || bottom > 21.51
    const edge = !out && (b.x < 2.98 || b.y < 2.98 || right > 21.02 || bottom > 21.02)

    const found = gaps(icon)
    const marks = card.querySelector('.gaps')
    for (const g of found) {
      const ring = document.createElementNS(NS, 'circle')
      ring.setAttribute('cx', g.x)
      ring.setAttribute('cy', g.y)
      ring.setAttribute('r', 1.6)
      ring.setAttribute('class', g.d < MERGE ? 'merge' : 'tight')
      marks.append(ring)
    }

    const body = card.dataset.body
    const ink = coverage(await render(body, 24)) / INK_MEDIAN
    const pixels = await render(body, 16)
    pixels.className = 'px'
    card.querySelector('.pixels').append(pixels)

    const merge = found.filter((g) => g.d < MERGE)
    const heavy = ink > INK_LIMIT
    window.boxes[card.dataset.name] = {
      x: b.x,
      y: b.y,
      w: b.width,
      h: b.height,
      out,
      edge,
      gaps: found,
      ink: Math.round(ink * 100) / 100,
    }

    const lines = [
      `bbox x ${b.x.toFixed(2)}–${right.toFixed(2)}  y ${b.y.toFixed(2)}–${bottom.toFixed(2)}  (${b.width.toFixed(2)}×${b.height.toFixed(2)})${out ? '  超出 2.5–21.5' : edge ? '  越过 3–21' : ''}`,
      `墨量 ${ink.toFixed(2)}×${heavy ? '  偏重' : ''}`,
      found.length
        ? `间隙 ${found.map((g) => `${g.d}@${g.x},${g.y}`).join('  ')}${found.some((g) => g.d < JOINT) ? '  接点未对准' : ''}${merge.some((g) => g.d >= JOINT) ? '  粘连' : merge.length ? '' : '  偏紧'}`
        : '间隙 ≥ 3.5',
    ]
    const note = card.querySelector('.b')
    note.innerHTML = lines.map((line) => `<div>${line}</div>`).join('')
    if (out || merge.length) note.classList.add('bad')
  }
  window.done = true
})()
