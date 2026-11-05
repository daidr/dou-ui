/* oxlint-disable no-underscore-dangle -- comparing with the app context the library keeps */
import { afterEach, describe, expect, it } from 'vitest'
import { createApp } from 'vue'
import { DouUI, en, provideGlobalConfig } from '../../index'
import { installedAppContext, setInstalledAppContext } from '../app-context'

afterEach(() => setInstalledAppContext(null))

describe('installedAppContext', () => {
  it('is null until an app sets DouUI up', () => {
    expect(installedAppContext()).toBe(null)
  })

  it('keeps the app of app.use(DouUI), and of provideGlobalConfig with an app (as Nuxt does)', () => {
    const first = createApp({ render: () => null }).use(DouUI)
    expect(installedAppContext()).toBe(first._context)
    const second = createApp({ render: () => null })
    provideGlobalConfig({ locale: en }, second)
    // the last one wins
    expect(installedAppContext()).toBe(second._context)
  })
})
