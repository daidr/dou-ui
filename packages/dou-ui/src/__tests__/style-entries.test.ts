import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { styleDeps, stylesheetOrder } from '../../scripts/style-deps'

const deps = styleDeps()
const theme = (name: string) =>
  resolve(import.meta.dirname, `../../../theme/src/components/${name}.css`)

describe('per-component style entries', () => {
  it('include the component’s own stylesheet', () => {
    const missing = [...deps].filter(
      ([dir, sheets]) => existsSync(theme(dir)) && !sheets.includes(dir),
    )
    expect(missing).toEqual([])
  })

  it('pull in the stylesheets of what a component renders', () => {
    expect(deps.get('select')).toEqual(['overlay', 'select', 'tag'])
    expect(deps.get('drawer')).toContain('dialog') // the shared close button
    expect(deps.get('table')).toEqual(expect.arrayContaining(['checkbox', 'empty', 'spinner']))
    expect(deps.get('dialog')).toEqual(expect.arrayContaining(['dialog-box', 'button', 'input']))
    expect(deps.get('popover')).not.toContain('popconfirm')
  })

  it('keep the cascade order of the full stylesheet', () => {
    const order = stylesheetOrder()
    for (const sheets of deps.values()) {
      expect(sheets).toEqual(sheets.toSorted((a, b) => order.indexOf(a) - order.indexOf(b)))
    }
  })

  it('leave no stylesheet unused', () => {
    const used = new Set([...deps.values()].flat())
    // `.dou-prose` styles Markdown content, not a component.
    const unused = stylesheetOrder().filter((name) => !used.has(name))
    expect(unused).toEqual(['typography'])
  })
})
