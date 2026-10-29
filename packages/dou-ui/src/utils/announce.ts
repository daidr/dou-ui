let region: HTMLElement | undefined

/** Read a message out through one live region shared by the whole page. */
export function announce(text: string) {
  if (!region?.isConnected) {
    region = document.createElement('div')
    region.className = 'dou-sortable-live'
    region.setAttribute('aria-live', 'assertive')
    region.setAttribute('aria-atomic', 'true')
    // Hidden inline, so it works whichever stylesheets are loaded.
    Object.assign(region.style, {
      position: 'absolute',
      width: '1px',
      height: '1px',
      overflow: 'hidden',
      clipPath: 'inset(50%)',
      whiteSpace: 'nowrap',
    })
    document.body.append(region)
  }
  // Clear first, so the same message twice is read twice.
  region.textContent = ''
  requestAnimationFrame(() => region && (region.textContent = text))
}
