import { defineTheme } from './define'
import { light } from './light'

/**
 * Dark theme. Same restraint, inverted: off-white ink on a near-black
 * page, with surfaces separated by hairline borders rather than shadow.
 */
export const dark = defineTheme(light, {
  color: {
    neutral: { DEFAULT: '#ededed', on: '#0a0a0a' },
    primary: { DEFAULT: '#6f8fdc', on: '#0a0a0a' },
    success: { DEFAULT: '#5fae80', on: '#0a0a0a' },
    warning: { DEFAULT: '#d69e45', on: '#0a0a0a' },
    danger: { DEFAULT: '#e06c62', on: '#0a0a0a' },
    bg: {
      canvas: '#0a0a0a',
      surface: '#111111',
      muted: '#1c1c1c',
    },
    text: {
      DEFAULT: '#ededed',
      secondary: '#a3a3a3',
      tertiary: '#737373',
      disabled: '#4d4d4d',
    },
    border: {
      subtle: '#1a1a1a',
      DEFAULT: '#262626',
      strong: '#3a3a3a',
    },
    focus: '#5a73b3',
  },
  shadow: {
    sm: '0 1px 2px rgb(0 0 0 / 0.5)',
    md: '0 1px 2px rgb(0 0 0 / 0.5), 0 4px 12px -2px rgb(0 0 0 / 0.5)',
    lg: '0 2px 4px rgb(0 0 0 / 0.5), 0 16px 32px -8px rgb(0 0 0 / 0.7)',
  },
})
