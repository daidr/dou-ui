import { computed } from 'vue'
import { useData, useRoute } from 'vitepress'

export interface NavLink {
  text: string
  link: string
  /** Pages outside the link's own section that belong to this entry. */
  activeMatch?: string
}

export interface SidebarGroup {
  text: string
  items: NavLink[]
}

/** Which release line the site documents, set at build time. */
export interface ReleaseInfo {
  /** `stable` is the current release; `next` follows the main branch. */
  channel: 'stable' | 'next'
  /** Version of the packages the pages were built from. */
  version: string
  /** Origins of the two sites. */
  sites: { stable: string; next: string }
  /** Where the release notes are listed. */
  changelog: string
}

interface ThemeConfig {
  release?: ReleaseInfo
  nav?: NavLink[]
  sidebar?: Record<string, SidebarGroup[]>
  socialLinks?: { icon: string; link: string }[]
}

/** `/components/button.html` and `/components/button` are the same page. */
export const normalize = (path: string) =>
  path.replace(/(index)?\.html$/, '').replace(/\/$/, '') || '/'

const sectionOf = (link: string) => link.split('/').slice(0, 2).join('/')

/** The navigation shared by the header, the sidebar, search and the page footer. */
export function useDocs() {
  const { theme } = useData<ThemeConfig>()
  const route = useRoute()

  const path = computed(() => normalize(route.path))
  const nav = computed(() => theme.value.nav ?? [])
  const sidebars = computed(() => theme.value.sidebar ?? {})

  /** The sidebar whose prefix the current page sits under. */
  const sidebar = computed<SidebarGroup[]>(() => {
    const prefix = Object.keys(sidebars.value)
      .filter((key) => path.value.startsWith(key))
      .toSorted((a, b) => b.length - a.length)[0]
    return prefix ? sidebars.value[prefix]! : []
  })

  /** The header entry the current page belongs to, by its link. */
  const activeNav = computed(
    () =>
      nav.value.find((item) =>
        item.activeMatch
          ? new RegExp(item.activeMatch).test(path.value)
          : sectionOf(item.link) === sectionOf(path.value),
      )?.link,
  )

  const pages = computed(() => sidebar.value.flatMap((group) => group.items))
  const index = computed(() => pages.value.findIndex((page) => normalize(page.link) === path.value))
  const prev = computed(() => (index.value > 0 ? pages.value[index.value - 1] : undefined))
  const next = computed(() => (index.value >= 0 ? pages.value[index.value + 1] : undefined))

  /** Every page of every sidebar, for search. */
  const allPages = computed(() => {
    const seen = new Set<string>()
    const list: (NavLink & { group: string })[] = []
    for (const groups of Object.values(sidebars.value)) {
      for (const group of groups) {
        for (const item of group.items) {
          if (seen.has(item.link)) continue
          seen.add(item.link)
          // An untitled group (the overview) is listed under its section.
          const section = nav.value.find((entry) =>
            entry.activeMatch
              ? new RegExp(entry.activeMatch).test(normalize(item.link))
              : sectionOf(entry.link) === sectionOf(item.link),
          )
          list.push({ ...item, group: group.text || (section?.text ?? '') })
        }
      }
    }
    return list
  })

  return {
    path,
    nav,
    activeNav,
    sidebar,
    prev,
    next,
    allPages,
    social: computed(() => theme.value.socialLinks ?? []),
    release: computed(() => theme.value.release),
  }
}
