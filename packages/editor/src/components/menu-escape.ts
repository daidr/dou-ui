import { isComposing } from 'dou-ui'
import { onScopeDispose, watch, type Ref } from 'vue'

/**
 * Menus opened from the editor's own controls leave the focus in the text,
 * where the editor would take `Escape` for itself (selecting the block).
 * While one is open, `Escape` closes it first.
 */
export function useMenuEscape(open: Ref<boolean>, close: () => void) {
  const onKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || isComposing(event)) return
    event.preventDefault()
    event.stopPropagation()
    close()
  }
  const listen = (on: boolean) => {
    if (on) window.addEventListener('keydown', onKeydown, true)
    else window.removeEventListener('keydown', onKeydown, true)
  }
  watch(open, (value) => listen(value))
  onScopeDispose(() => listen(false))
}
