import { defineTheme } from './define'
import { light } from './light'

/** Draft dark theme. Only colors differ from the light theme. */
export const dark = defineTheme(light, {
  color: {
    primary: { DEFAULT: '#5b8cff', on: '#0b1020' },
    neutral: { DEFAULT: '#d5d9df', on: '#16181c' },
    success: { DEFAULT: '#3ccf7c', on: '#06140c' },
    warning: { DEFAULT: '#f2b445', on: '#1a1200' },
    danger: { DEFAULT: '#ff6b70', on: '#1c0607' },
    bg: {
      canvas: '#101215',
      surface: '#181b20',
      muted: '#22262c',
    },
    text: {
      DEFAULT: '#e8eaed',
      secondary: '#a2a8b1',
      disabled: '#5d636c',
    },
    border: {
      DEFAULT: '#2c3138',
      strong: '#454c55',
    },
    focus: '#5b8cff',
    stateMix: '#ffffff',
  },
  shadow: {
    sm: '0 1px 2px rgb(0 0 0 / 0.4)',
    md: '0 4px 12px rgb(0 0 0 / 0.5)',
    lg: '0 12px 32px rgb(0 0 0 / 0.6)',
  },
})
