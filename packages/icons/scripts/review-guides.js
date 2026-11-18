{
  // Coordinates describe the bottom-right orientation. The other corners mirror it.
  const profiles = {
    simple: ['基础符号', 18, 18, 5],
    direction: ['书写方向 · 箭头', 16.5, 18, 8, 5],
    snowflake: ['冻结行列 · 雪花', 18, 18, 6],
    dial: ['表盘角标', 17, 17, 8],
    gear: ['齿轮角标', 17, 17, 8],
    lens: ['放大镜 · 镜片', 16.5, 16.5, 6],
    person: ['人物 · 基础符号', 18.5, 13.5, 5],
    list: ['列表 · 基础符号', 18, 17.5, 5],
    clock: ['时钟 / 表情 · 基础符号', 17.5, 17.5, 5],
  }
  const corners = ['左上', '右上', '左下', '右下']
  const ns = 'http://www.w3.org/2000/svg'

  // The boundary is for the host centerline. Filled shapes reserve their interiors.
  // Round strokes expand the geometry in every direction. Subtract the union
  // of the inner strokes from the union of the outer ones to avoid seams.
  function envelope(parts, radius, color) {
    const group = document.createElementNS(ns, 'g')
    group.setAttribute('stroke', color)
    group.setAttribute('stroke-linecap', 'round')
    group.setAttribute('stroke-linejoin', 'round')
    for (const part of parts) {
      const shape = part.cloneNode(false)
      const extra = part.classList.contains('dot') ? 0.375 : 0
      shape.removeAttribute('class')
      shape.setAttribute('fill', part.classList.contains('fill') ? color : 'none')
      shape.setAttribute('stroke-width', 2 * (radius + extra))
      group.append(shape)
    }
    return group
  }

  for (const [index, card] of document.querySelectorAll('.card').entries()) {
    const corner = card.querySelector('.corner')
    const profile = card.querySelector('.profile')
    const pick = card.querySelector('.pick')
    const icon = card.querySelector('.ic')
    const parts = new Set(icon.querySelectorAll('[data-badge]'))
    corner.add(new Option('四角总览', 'all'))
    corners.forEach((label, i) => corner.add(new Option(label, String(i))))
    for (const [key, [label]] of Object.entries(profiles)) profile.add(new Option(label, key))
    if (parts.size) {
      const boxes = [...parts].map((part) => part.getBBox())
      const center = (axis, length) =>
        (Math.min(...boxes.map((b) => b[axis])) +
          Math.max(...boxes.map((b) => b[axis] + b[length]))) /
        2
      corner.value = String(
        (center('x', 'width') > 12 ? 1 : 0) + (center('y', 'height') > 12 ? 2 : 0),
      )
      const preset = [...parts][0].dataset.badge
      if (Object.hasOwn(profiles, preset)) profile.value = preset
    }

    function draw() {
      const [, x, y, width, height = width] = profiles[profile.value]
      const marks = card.querySelector('.badge-guides')
      marks.replaceChildren()
      let anchor = '四角镜像'
      for (const i of corners.keys()) {
        if (corner.value !== 'all' && corner.value !== String(i)) continue
        const cx = i % 2 === 0 ? 24 - x : x
        const cy = i < 2 ? 24 - y : y
        if (corner.value !== 'all') anchor = '(' + cx + ', ' + cy + ')'
        marks.insertAdjacentHTML(
          'beforeend',
          `<g transform="translate(${cx} ${cy})"><rect x="${-width / 2}" y="${-height / 2}" width="${width}" height="${height}"/><path d="M-.6 0H.6M0-.6V.6"/></g>`,
        )
      }
      const layer = card.querySelector('.badge-clearance')
      layer.replaceChildren()
      if (parts.size) {
        const mask = document.createElementNS(ns, 'mask')
        mask.id = 'clearance-' + index
        mask.setAttribute('maskUnits', 'userSpaceOnUse')
        mask.setAttribute('x', 0)
        mask.setAttribute('y', 0)
        mask.setAttribute('width', 24)
        mask.setAttribute('height', 24)
        mask.innerHTML = '<rect width="24" height="24" fill="white"/>'
        mask.append(envelope(parts, BADGE_CLEARANCE - 0.065, 'black'))
        const outline = envelope(parts, BADGE_CLEARANCE + 0.065, '#087353')
        outline.setAttribute('mask', 'url(#' + mask.id + ')')
        const tint = envelope(parts, BADGE_CLEARANCE, '#188760')
        tint.setAttribute('opacity', '.09')
        layer.append(mask, tint, outline)
      }
      card.querySelector('.guide-note').textContent =
        `${anchor} · ${width}×${height}` +
        (parts.size ? ` · 轮廓避让 ${BADGE_CLEARANCE} 格` : ' · 基础定位')
    }
    corner.addEventListener('change', draw)
    profile.addEventListener('change', draw)
    pick.addEventListener('click', () => {
      const active = card.classList.toggle('picking')
      pick.setAttribute('aria-pressed', String(active))
    })
    icon.addEventListener('click', (event) => {
      if (!card.classList.contains('picking') || event.target.parentNode !== icon) return
      if (!parts.delete(event.target)) parts.add(event.target)
      event.target.toggleAttribute('data-badge', parts.has(event.target))
      draw()
      card.dispatchEvent(new Event('badgechange'))
    })
    draw()
  }
}
