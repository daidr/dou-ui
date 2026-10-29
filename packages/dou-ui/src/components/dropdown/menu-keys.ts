/** The enabled items of a menu, in order. */
export const menuItems = (menu: HTMLElement | null | undefined) =>
  [...(menu?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])].filter(
    (item) => item.getAttribute('aria-disabled') !== 'true',
  )

/**
 * Keyboard handling inside a menu: arrows, `Home` and `End` move between
 * items, `Enter` and `Space` choose one, typing jumps to the next item
 * starting with the typed text. `onTab` decides where focus goes on `Tab`.
 */
export function useMenuKeys(menu: () => HTMLElement | null | undefined, onTab: () => void) {
  let typed = ''
  let typedTimer: ReturnType<typeof setTimeout> | undefined

  return function onMenuKeydown(event: KeyboardEvent) {
    const list = menuItems(menu())
    const index = list.indexOf(document.activeElement as HTMLElement)
    const focus = (next: number) => list[(next + list.length) % list.length]?.focus()

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        focus(index + 1)
        return
      case 'ArrowUp':
        event.preventDefault()
        focus(index < 0 ? -1 : index - 1)
        return
      case 'Home':
        event.preventDefault()
        focus(0)
        return
      case 'End':
        event.preventDefault()
        focus(-1)
        return
      case 'Enter':
      case ' ':
        event.preventDefault()
        list[index]?.click()
        return
      case 'Tab':
        onTab()
        return
    }

    if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return
    clearTimeout(typedTimer)
    typed += event.key.toLowerCase()
    typedTimer = setTimeout(() => (typed = ''), 500)
    const ordered = [...list.slice(index + 1), ...list.slice(0, index + 1)]
    const repeat = typed.length > 1 && [...typed].every((char) => char === typed[0])
    const match = ordered.find((item) =>
      item.textContent
        ?.trim()
        .toLowerCase()
        .startsWith(repeat ? typed[0]! : typed),
    )
    match?.focus()
  }
}
