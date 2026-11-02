import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DouCodeEditor, typescript } from '../index'

const code = 'function total(orders) {\n  return orders.length\n}\n'

const make = () =>
  createSSRApp({ render: () => h(DouCodeEditor, { modelValue: code, language: typescript }) })

/** Makes the browser report a touch screen, as a phone does. */
function stubCoarsePointer() {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: query.includes('coarse'),
        media: query,
        addEventListener() {},
        removeEventListener() {},
      }) as unknown as MediaQueryList,
  )
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('server rendering', () => {
  // The server knows nothing of the pointer; a phone hydrating the page must
  // render the same markup first, and only then show its touch-only parts.
  it('hydrates on a touch screen without mismatches', async () => {
    vi.stubGlobal('matchMedia', undefined)
    const context: { teleports?: Record<string, string> } = {}
    const html = await renderToString(make(), context)
    vi.unstubAllGlobals()
    stubCoarsePointer()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const root = document.createElement('div')
    root.innerHTML = html
    document.body.append(root)
    // What the server teleported to the body, put back as the page would.
    document.body.insertAdjacentHTML('beforeend', context.teleports?.body ?? '')
    const app = make()
    app.mount(root)
    const problems = [...warn.mock.calls, ...error.mock.calls]
      .map((args) => String(args[0]))
      .filter((message) => /hydration|mismatch/i.test(message))
    for (const c of [...warn.mock.calls, ...error.mock.calls])
      process.stdout.write(
        c
          .map((x) =>
            x instanceof Node
              ? ((x as Element).outerHTML?.slice(0, 300) ?? x.textContent)
              : String(x).slice(0, 300),
          )
          .join(' | ') + '\n',
      )
    expect(problems).toEqual([])
    app.unmount()
  })
})
