import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouCodeDiff, DouCodeEditor } from '../index'

describe('bordered', () => {
  it('frames the editor by default and drops the frame with bordered=false', () => {
    expect(mount(DouCodeEditor, { props: { modelValue: 'a' } }).classes()).toContain('is-bordered')
    const bare = mount(DouCodeEditor, { props: { modelValue: 'a', bordered: false } })
    expect(bare.classes()).not.toContain('is-bordered')
  })

  it('frames the diff once: the inner editors never carry their own frame', () => {
    const diff = mount(DouCodeDiff, { props: { original: 'a', modelValue: 'b', mode: 'split' } })
    expect(diff.classes()).toContain('is-bordered')
    const editors = diff.findAll('.dou-code-editor')
    expect(editors.length).toBeGreaterThan(0)
    for (const editor of editors) expect(editor.classes()).not.toContain('is-bordered')
    const bare = mount(DouCodeDiff, { props: { original: 'a', modelValue: 'b', bordered: false } })
    expect(bare.classes()).not.toContain('is-bordered')
  })
})
