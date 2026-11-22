import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import { DouCodeDiff, DouCodeEditor, type CodeEditorExpose } from '../index'

const lines = Array.from({ length: 40 }, (_, i) => `const line${i + 1} = ${i + 1}`).join('\n')

afterEach(() => {
  document.body.innerHTML = ''
})

describe('scrollY', () => {
  it('enables vertical scroll by default and disables it on DouCodeEditor when scrollY is false', async () => {
    const scrollY = ref(true)
    const editor = ref<CodeEditorExpose>()
    const wrapper = mount(
      defineComponent(
        () => () =>
          h(DouCodeEditor, {
            ref: editor,
            modelValue: `${lines}\n${'x'.repeat(200)}`,
            scrollY: scrollY.value,
          }),
      ),
      { attachTo: document.body },
    )
    await nextTick()

    const root = wrapper.find('.dou-code-editor')
    const scroller = wrapper.get('.dou-code-editor__scroller').element as HTMLElement
    expect(root.classes()).toContain('is-scroll-y')

    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 200 })
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 900 })
    Object.defineProperty(scroller, 'clientWidth', { configurable: true, value: 300 })
    Object.defineProperty(scroller, 'scrollWidth', { configurable: true, value: 1200 })

    scroller.scrollTop = 180
    scroller.scrollLeft = 90
    await wrapper.get('.dou-code-editor__scroller').trigger('scroll')
    expect(scroller.scrollTop).toBe(180)
    expect(scroller.scrollLeft).toBe(90)

    // Turning scrollY off resets scrollTop to 0 while keeping scrollLeft intact.
    scrollY.value = false
    await nextTick()
    expect(root.classes()).not.toContain('is-scroll-y')
    expect(scroller.scrollTop).toBe(0)
    expect(scroller.scrollLeft).toBe(90)

    // Calling scrollIntoView or receiving a scroll event must not retain vertical scroll.
    editor.value!.scrollIntoView(editor.value!.doc.length)
    await nextTick()
    expect(scroller.scrollTop).toBe(0)

    scroller.scrollTop = 120
    scroller.scrollLeft = 140
    await wrapper.get('.dou-code-editor__scroller').trigger('scroll')
    expect(scroller.scrollTop).toBe(0)
    expect(scroller.scrollLeft).toBe(140)

    const css = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '../style.css'),
      'utf8',
    ).replace(/\/\*[\s\S]*?\*\//g, '')
    const ruleStart = css.indexOf(
      '.dou-code-editor:not(.is-scroll-y) > .dou-code-editor__body > .dou-code-editor__scroller {',
    )
    expect(ruleStart).toBeGreaterThan(-1)
    const ruleBlock = css.slice(ruleStart, css.indexOf('}', ruleStart))
    expect(ruleBlock).toMatch(/overflow-x:\s*auto/)
    expect(ruleBlock).toMatch(/overflow-y:\s*hidden/)
  })

  it('forwards scrollY to inner editors of DouCodeDiff in both split and inline modes', async () => {
    const mode = ref<'split' | 'inline'>('split')
    const scrollY = ref(true)
    const wrapper = mount(
      defineComponent(
        () => () =>
          h(DouCodeDiff, {
            original: `${lines}\nconst originalLong = '${'a'.repeat(180)}'`,
            modelValue: `${lines}\nconst modifiedLong = '${'b'.repeat(180)}'`,
            mode: mode.value,
            scrollY: scrollY.value,
            collapseUnchanged: false,
            widgets: [
              {
                id: 'review-1',
                side: 'modified',
                line: 2,
                span: 'both',
                render: () => h('div', { class: 'review-note' }, '批注'),
              },
            ],
          }),
      ),
      { attachTo: document.body },
    )
    await nextTick()

    expect(wrapper.find('.dou-code-diff').classes()).toContain('is-scroll-y')
    expect(wrapper.findAll('.dou-code-editor')).toHaveLength(2)
    for (const editor of wrapper.findAll('.dou-code-editor')) {
      expect(editor.classes()).toContain('is-scroll-y')
    }

    scrollY.value = false
    await nextTick()
    expect(wrapper.find('.dou-code-diff').classes()).not.toContain('is-scroll-y')
    for (const editor of wrapper.findAll('.dou-code-editor')) {
      expect(editor.classes()).not.toContain('is-scroll-y')
    }

    // In split mode with scrollY=false, horizontal scroll syncs across sides while vertical stays 0.
    const scrollers = wrapper.findAll('.dou-code-editor__scroller')
    const [scrollerA, scrollerB] = scrollers.map((s) => s.element as HTMLElement)
    for (const scroller of [scrollerA!, scrollerB!]) {
      Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 200 })
      Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 800 })
      Object.defineProperty(scroller, 'clientWidth', { configurable: true, value: 240 })
      Object.defineProperty(scroller, 'scrollWidth', { configurable: true, value: 900 })
    }
    scrollerA!.scrollLeft = 110
    scrollerA!.scrollTop = 60
    await scrollers[0]!.trigger('scroll')
    expect(scrollerA!.scrollTop).toBe(0)
    expect(scrollerB!.scrollTop).toBe(0)
    expect(scrollerB!.scrollLeft).toBe(110)

    // Wheel over a spanning widget lets vertical wheel pass through when scrollY=false,
    // while horizontal wheel still scrolls the inner editor.
    const span = wrapper.get('.dou-code-diff__span')
    const verticalWheel = new WheelEvent('wheel', {
      deltaY: 60,
      bubbles: true,
      cancelable: true,
    })
    span.element.dispatchEvent(verticalWheel)
    expect(verticalWheel.defaultPrevented).toBe(false)
    expect(scrollerB!.scrollTop).toBe(0)

    const horizontalWheel = new WheelEvent('wheel', {
      deltaX: 40,
      bubbles: true,
      cancelable: true,
    })
    span.element.dispatchEvent(horizontalWheel)
    expect(horizontalWheel.defaultPrevented).toBe(true)
    expect(scrollerB!.scrollLeft).toBe(150)

    // Inline mode also receives scrollY=false.
    mode.value = 'inline'
    await nextTick()
    const inlineEditors = wrapper.findAll('.dou-code-editor')
    expect(inlineEditors).toHaveLength(1)
    expect(inlineEditors[0]!.classes()).not.toContain('is-scroll-y')
  })
})
