import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { styleDeps, styleDirsFor, stylesheetOrder } from '../../scripts/style-deps'

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

  it('count a rule for the stylesheet it is written in', () => {
    // `.dou-chat-input__submit.dou-button` styles the chat input's button.
    expect(deps.get('button')).toEqual(['button'])
  })

  it('pull in the stylesheets of what a component renders', () => {
    expect(deps.get('select')).toEqual(['overlay', 'select', 'spinner', 'tag'])
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

const sheetsOf = (pkg: string, entry = 'index.ts') =>
  new Set(
    styleDirsFor(resolve(import.meta.dirname, `../../../${pkg}/src/${entry}`)).flatMap((dir) =>
      deps.get(dir)!,
    ),
  )

describe('style entries of the packages built on dou-ui', () => {
  it('cover the components each package renders', () => {
    // The chart's loading state.
    expect([...sheetsOf('chart')]).toContain('spinner')
    // The editor's toolbar, menus and buttons.
    expect([...sheetsOf('editor')]).toEqual(
      expect.arrayContaining(['button', 'dropdown', 'toolbar', 'tooltip']),
    )
    // Every field the form renderer can show.
    expect([...sheetsOf('form-builder', 'renderer/index.ts')]).toEqual(
      expect.arrayContaining(['input', 'select', 'date-picker', 'upload', 'switch', 'rate']),
    )
  })

  it('bring only what a subpath entry reaches', () => {
    const renderer = sheetsOf('form-builder', 'renderer/index.ts')
    const builder = sheetsOf('form-builder')
    // The designer's drawer and tree are not part of the renderer.
    expect(builder.size).toBeGreaterThan(renderer.size)
    for (const sheet of renderer) expect(builder.has(sheet)).toBe(true)
  })

  it('leave out entries another one already covers', () => {
    const dirs = styleDirsFor(resolve(import.meta.dirname, '../../../sheet/src/index.ts'))
    for (const dir of dirs) {
      const others = dirs.filter((other) => other !== dir)
      const covered = others.some((other) =>
        deps.get(dir)!.every((sheet) => deps.get(other)!.includes(sheet)),
      )
      expect([dir, covered]).toEqual([dir, false])
    }
  })
})
