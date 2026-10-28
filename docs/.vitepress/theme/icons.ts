import { h } from 'vue'

/** Line icons drawn for the docs site, 16px grid, 1.5px strokes. */
const icon =
  (...paths: string[]) =>
  () =>
    h(
      'svg',
      {
        viewBox: '0 0 16 16',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': 1.5,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
      paths.map((d) => h('path', { d })),
    )

export const SearchIcon = icon('M7 11.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z', 'm10.5 10.5 3 3')
export const SunIcon = icon(
  'M8 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  'M8 1.5v1.25M8 13.25v1.25M1.5 8h1.25M13.25 8h1.25M3.4 3.4l.9.9M11.7 11.7l.9.9M3.4 12.6l.9-.9M11.7 4.3l.9-.9',
)
export const MoonIcon = icon('M13.5 9.6A5.75 5.75 0 0 1 6.4 2.5a5.75 5.75 0 1 0 7.1 7.1Z')
export const MenuIcon = icon('M2.5 4.5h11M2.5 8h11M2.5 11.5h11')
export const ArrowLeftIcon = icon('M12.5 8h-9M7 4.5 3.5 8 7 11.5')
export const ArrowRightIcon = icon('M3.5 8h9M9 4.5l3.5 3.5L9 11.5')
export const PageIcon = icon('M4 1.75h5.5L12.5 4.75v9.5H4Z', 'M9.25 1.75v3.25h3.25')

export const GitHubIcon = () =>
  h('svg', { viewBox: '0 0 16 16', fill: 'currentColor' }, [
    h('path', {
      d: 'M8 .2a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.93-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.71 1.22 1.87.87 2.33.66.07-.52.28-.87.5-1.07-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.22 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.66 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 8 .2Z',
    }),
  ])
