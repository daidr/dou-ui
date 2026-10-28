import { computed } from 'vue'
import { useData, useRoute } from 'vitepress'

export interface NavLink {
  text: string
  link: string
}

export interface SidebarGroup {
  text: string
  items: NavLink[]
}

interface ThemeConfig {
  nav?: NavLink[]
  sidebar?: Record<string, SidebarGroup[]>
  socialLinks?: { icon: string; link: string }[]
}

/** `/components/button.html` and `/components/button` are the same page. */
export const normalize = (path: string) =>
  path.replace(/(index)?\.html$/, '').replace(/\/$/, '') || '/'

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
          list.push({ ...item, group: group.text })
        }
      }
    }
    return list
  })

  return {
    path,
    nav,
    sidebar,
    prev,
    next,
    allPages,
    social: computed(() => theme.value.socialLinks ?? []),
  }
}
