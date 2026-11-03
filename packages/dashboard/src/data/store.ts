import { shallowRef } from 'vue'
import type { ShallowRef } from 'vue'
import { pickFilters, stableKey } from './filters'
import type {
  DashboardFilters,
  DashboardSourceLoad,
  DashboardSourceOptions,
  DashboardSources,
} from './types'

export type SourceState =
  | { status: 'idle' }
  | { status: 'loading'; data?: unknown; error?: unknown }
  | { status: 'ready'; data: unknown }
  | { status: 'error'; data?: unknown; error: unknown }

/** One source loaded with one set of filters, shared by every widget showing it. */
export interface SourceEntry {
  readonly key: string
  readonly name: string
  readonly filters: DashboardFilters
  readonly state: ShallowRef<SourceState>
  /** Whether a load is running for data already shown (a refresh), not for new data. */
  readonly refreshing: ShallowRef<boolean>
}

interface Entry extends SourceEntry {
  users: number
  controller?: AbortController
  loadedAt: number
  timer?: ReturnType<typeof setTimeout>
  /** A refresh came due while the page was hidden. */
  due: boolean
  /** When it was last let go, for dropping the oldest unused entries. */
  idleSince: number
}

/** How many loaded results nobody shows are kept, to come back to without loading. */
const KEEP = 32

export function optionsOf(
  source: DashboardSourceLoad<any> | DashboardSourceOptions<any>,
): DashboardSourceOptions<any> {
  return typeof source === 'function' ? { load: source } : source
}

/** Whether two definitions of a source load the same way. */
export function sameSource(
  a: DashboardSourceLoad<any> | DashboardSourceOptions<any> | undefined,
  b: DashboardSourceLoad<any> | DashboardSourceOptions<any> | undefined,
) {
  if (!a || !b) return a === b
  const x = optionsOf(a)
  const y = optionsOf(b)
  return (
    x.load === y.load &&
    x.interval === y.interval &&
    (x.filters ?? []).join('\u0000') === (y.filters ?? []).join('\u0000')
  )
}

const isAbort = (error: unknown) =>
  !!error && typeof error === 'object' && (error as { name?: string }).name === 'AbortError'

/**
 * Loads the dashboard's sources: once for each source and set of filters,
 * however many widgets show it. Results nobody shows any more are kept a
 * while; loads nobody waits for are aborted.
 */
export function createSourceStore(sources: () => DashboardSources | undefined) {
  const entries = new Map<string, Entry>()
  // nothing loads while rendering on the server: the page is sent before a
  // load could finish, and a refresh timer would keep the server process alive
  const server = typeof window === 'undefined'
  let hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden'

  function onVisibility() {
    hidden = document.visibilityState === 'hidden'
    if (hidden) return
    for (const entry of entries.values()) {
      if (entry.due && entry.users > 0) {
        entry.due = false
        load(entry, true)
      }
    }
  }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility)

  function schedule(entry: Entry) {
    clearTimeout(entry.timer)
    entry.timer = undefined
    const every = optionsOf(sources()?.[entry.name] ?? (() => undefined)).interval
    if (!every || every <= 0 || entry.users === 0) return
    const wait = Math.max(0, entry.loadedAt + every - Date.now())
    entry.timer = setTimeout(() => {
      entry.timer = undefined
      if (entry.users === 0) return
      if (hidden) entry.due = true
      else load(entry, true)
    }, wait)
  }

  function load(entry: Entry, refresh = false) {
    const source = sources()?.[entry.name]
    entry.controller?.abort()
    clearTimeout(entry.timer)
    const previous = entry.state.value
    const data = 'data' in previous ? previous.data : undefined
    if (!source) {
      entry.state.value = {
        status: 'error',
        error: new Error(`[@dou-ui/dashboard] no source is named "${entry.name}"`),
      }
      return
    }
    const controller = new AbortController()
    entry.controller = controller
    entry.refreshing.value = refresh && previous.status === 'ready'
    if (!entry.refreshing.value) entry.state.value = { status: 'loading', data }
    const done = (next: SourceState) => {
      if (entry.controller !== controller) return
      entry.controller = undefined
      entry.loadedAt = Date.now()
      entry.refreshing.value = false
      entry.state.value = next
      schedule(entry)
    }
    let result: unknown
    try {
      result = optionsOf(source).load({
        filters: entry.filters,
        signal: controller.signal,
        source: entry.name,
      })
    } catch (error) {
      done({ status: 'error', data, error })
      return
    }
    Promise.resolve(result).then(
      (value) => done({ status: 'ready', data: value }),
      (error) => {
        if (controller.signal.aborted && isAbort(error)) return
        done({ status: 'error', data, error })
      },
    )
  }

  /** Drops the oldest results nobody shows, past `KEEP`. */
  function trim() {
    const idle: Entry[] = []
    for (const entry of entries.values()) if (entry.users === 0) idle.push(entry)
    if (idle.length <= KEEP) return
    idle.sort((a, b) => a.idleSince - b.idleSince)
    for (const entry of idle.slice(0, idle.length - KEEP)) entries.delete(entry.key)
  }

  /** The key a source and the filters in effect load under. */
  function keyOf(name: string, filters: DashboardFilters) {
    const source = sources()?.[name]
    const scoped = pickFilters(filters, source ? optionsOf(source).filters : undefined)
    return { key: `${name}\u0000${stableKey(scoped)}`, scoped }
  }

  /** Loads a newly shown entry, or schedules the refresh of a kept result. */
  function start(entry: Entry) {
    const status = entry.state.value.status
    if (status === 'idle' || (status === 'error' && !entry.controller)) load(entry)
    else if (entry.users === 1 && !entry.controller) {
      const every = optionsOf(sources()?.[entry.name] ?? (() => undefined)).interval
      // a kept result older than its refresh interval loads again
      if (every && Date.now() - entry.loadedAt >= every) load(entry, true)
      else schedule(entry)
    }
  }

  /**
   * Starts showing a source with the filters in effect; loads it unless a
   * result (or a load) for the same source and filters is there already.
   * Call `release` when it is no longer shown.
   */
  function use(name: string, filters: DashboardFilters) {
    const { key, scoped } = keyOf(name, filters)
    let entry = entries.get(key)
    if (!entry) {
      entry = {
        key,
        name,
        filters: scoped,
        state: shallowRef<SourceState>({ status: 'idle' }),
        refreshing: shallowRef(false),
        users: 0,
        loadedAt: 0,
        due: false,
        idleSince: 0,
      }
      entries.set(key, entry)
    }
    entry.users++
    // on the server it stays loading until the browser takes over
    if (!server) start(entry)
    const used = entry
    let released = false
    return {
      entry: used as SourceEntry,
      release() {
        if (released) return
        released = true
        used.users--
        if (used.users > 0) return
        used.idleSince = Date.now()
        clearTimeout(used.timer)
        used.timer = undefined
        used.due = false
        if (used.controller) {
          // nobody waits for it: stop it, and forget a result that never came
          used.controller.abort()
          used.controller = undefined
          used.refreshing.value = false
          if (used.state.value.status === 'loading') entries.delete(used.key)
        }
        trim()
      },
    }
  }

  /** Loads again: one source, or every source; results nobody shows are dropped. */
  function reload(name?: string) {
    for (const entry of entries.values()) {
      if (name !== undefined && entry.name !== name) continue
      if (entry.users > 0) load(entry, true)
      else entries.delete(entry.key)
    }
  }

  /** Loads one entry again, e.g. after an error. */
  function retry(entry: SourceEntry) {
    const own = entries.get(entry.key)
    if (own) load(own)
  }

  /** Whether a source shown is loading. */
  function busy() {
    for (const entry of entries.values()) if (entry.users > 0 && entry.controller) return true
    return false
  }

  function dispose() {
    if (typeof document !== 'undefined')
      document.removeEventListener('visibilitychange', onVisibility)
    for (const entry of entries.values()) {
      clearTimeout(entry.timer)
      entry.controller?.abort()
    }
    entries.clear()
  }

  return { use, reload, retry, busy, dispose, keyOf }
}

export type SourceStore = ReturnType<typeof createSourceStore>
