import { describe, expect, it } from 'vitest'
import { Comment, Fragment, createTextVNode, h } from 'vue'
import { filled, rendersSomething } from '../slot'

describe('rendersSomething', () => {
  it('counts only what shows', () => {
    expect(rendersSomething(undefined)).toBe(false)
    expect(rendersSomething([])).toBe(false)
    expect(rendersSomething([h(Comment, 'v-if')])).toBe(false)
    expect(rendersSomething([createTextVNode('  \n ')])).toBe(false)
    expect(rendersSomething([h(Fragment, [false, true, null, undefined, ''])])).toBe(false)
    expect(rendersSomething([h(Fragment, [h(Fragment, [])])])).toBe(false)
    expect(rendersSomething([h(Fragment, [0])])).toBe(true)
    expect(rendersSomething(['保存'])).toBe(true)
    expect(rendersSomething([h('svg')])).toBe(true)
    // a component may render nothing, but that is known only once it renders
    expect(rendersSomething([h({ render: () => null })])).toBe(true)
  })

  it('hands back what a slot rendered, or nothing', () => {
    expect(filled(undefined)).toBeUndefined()
    expect(filled(() => [h(Comment)])).toBeUndefined()
    const nodes = [h('i')]
    expect(filled(() => nodes)).toBe(nodes)
  })
})
