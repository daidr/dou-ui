import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouGantt } from '../index'
import { DouScheduler } from '../scheduler'

describe('bordered', () => {
  for (const [name, component, props] of [
    ['DouGantt', DouGantt, {}],
    ['DouScheduler', DouScheduler, { resources: [{ id: 'dai', title: '戴兜' }] }],
  ] as const) {
    it(`${name} is framed by default and drops the frame with bordered=false`, () => {
      expect(mount(component as any, { props }).classes()).toContain('is-bordered')
      const bare = mount(component as any, { props: { ...props, bordered: false } })
      expect(bare.classes()).not.toContain('is-bordered')
    })
  }
})
