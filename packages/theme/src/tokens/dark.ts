import { defineTheme } from './define'
import { light } from './light'

/**
 * Dark theme. Same restraint, inverted: off-white ink on a near-black
 * page, with surfaces separated by hairline borders rather than shadow.
 */
export const dark = defineTheme(light, {
  color: {
    neutral: { DEFAULT: '#ededed', on: '#0a0a0a', text: '#ededed' },
    primary: { DEFAULT: '#4c66cb', on: '#ffffff', text: '#768ad7' },
    success: { DEFAULT: '#2f8060', on: '#ffffff', text: '#42a87d' },
    warning: { DEFAULT: '#c18a3c', on: '#1a1206', text: '#c99852' },
    danger: { DEFAULT: '#c5453e', on: '#ffffff', text: '#d4746f' },
    bg: {
      canvas: '#0a0a0a',
      surface: '#111111',
      muted: '#1c1c1c',
    },
    text: {
      DEFAULT: '#ededed',
      secondary: '#a3a3a3',
      tertiary: '#858585',
      disabled: '#4d4d4d',
    },
    border: {
      subtle: '#1a1a1a',
      DEFAULT: '#262626',
      strong: '#3a3a3a',
    },
    focus: '#5a73b3',
    edge: '#000000',
    chart: {
      1: '#d4d4d4',
      2: '#8db4e7',
      3: '#deb67f',
      4: '#36908b',
      5: '#e29ba0',
      6: '#9480b8',
      7: '#7ca573',
      8: '#ab7055',
    },
  },
  shadow: {
    sm: '0 1px 2px rgb(0 0 0 / 0.5)',
    md: '0 1px 2px rgb(0 0 0 / 0.5), 0 4px 12px -2px rgb(0 0 0 / 0.5)',
    lg: '0 2px 4px rgb(0 0 0 / 0.5), 0 16px 32px -8px rgb(0 0 0 / 0.7)',
    highlight: 'inset 0 1px 0 rgb(255 255 255 / 0.1)',
  },
})
