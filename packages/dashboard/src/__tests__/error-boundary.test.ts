import { describe, expect, it } from 'vitest'
import { breaksView } from '../dashboard/error-boundary'

const code = (value: string) => `https://vuejs.org/error-reference/#runtime-${value}`

describe('breaksView', () => {
  it('reads Vue’s words while developing', () => {
    expect(breaksView('render function')).toBe(true)
    expect(breaksView('mounted hook')).toBe(true)
    expect(breaksView('setup function')).toBe(true)
    expect(breaksView('native event handler')).toBe(false)
    expect(breaksView('component event handler')).toBe(false)
    expect(breaksView('watcher callback')).toBe(false)
  })

  it('reads Vue’s codes in production', () => {
    expect(breaksView(code('1'))).toBe(true)
    expect(breaksView(code('m'))).toBe(true)
    expect(breaksView(code('0'))).toBe(true)
    expect(breaksView(code('5'))).toBe(false)
    expect(breaksView(code('6'))).toBe(false)
    expect(breaksView(code('3'))).toBe(false)
    // a code that only looks like a name doesn't count
    expect(breaksView(code('render function'))).toBe(false)
  })
})
