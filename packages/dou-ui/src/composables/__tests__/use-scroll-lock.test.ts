import { effectScope, nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useScrollLock } from '../use-scroll-lock'

describe('useScrollLock', () => {
  it('locks the page while any lock is active', async () => {
    const first = ref(true)
    const second = ref(false)
    const scope = effectScope()
    scope.run(() => {
      useScrollLock(first)
      useScrollLock(second)
    })
    expect(document.body.style.overflow).toBe('hidden')
    second.value = true
    first.value = false
    await nextTick()
    expect(document.body.style.overflow).toBe('hidden')
    second.value = false
    await nextTick()
    expect(document.body.style.overflow).toBe('')
    second.value = true
    await nextTick()
    scope.stop()
    expect(document.body.style.overflow).toBe('')
  })
})
