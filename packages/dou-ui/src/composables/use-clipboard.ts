import { onScopeDispose, readonly, ref, toValue } from 'vue'
import type { MaybeRefOrGetter, Ref } from 'vue'
import { copyText } from '../utils/clipboard'

export interface UseClipboardOptions {
  /** How long `copied` stays `true` after a copy, in ms. Defaults to 2000. */
  duration?: MaybeRefOrGetter<number>
}

export interface UseClipboardReturn {
  /**
   * Put text on the clipboard. Uses the async clipboard API, and a hidden
   * text box where that is missing or refused. Rejects when both fail.
   */
  copy: (text: string) => Promise<void>
  /** `true` for `duration` ms after a successful copy. */
  copied: Readonly<Ref<boolean>>
}

/** Copy text to the clipboard and know for a moment that it worked, e.g. to swap an icon. */
export function useClipboard(options: UseClipboardOptions = {}): UseClipboardReturn {
  const copied = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  async function copy(text: string) {
    await copyText(text)
    copied.value = true
    clearTimeout(timer)
    timer = setTimeout(() => (copied.value = false), toValue(options.duration) ?? 2000)
  }

  onScopeDispose(() => clearTimeout(timer))
  return { copy, copied: readonly(copied) }
}
