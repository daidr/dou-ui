import type { ThemeTokens } from './types'

/**
 * Light theme.
 *
 * Ink on paper: the interface is built from near-black, white and a
 * narrow band of warm-neutral grays. Hue is reserved for meaning
 * (primary action, success, warning, danger) and is kept desaturated so
 * it never shouts.
 */
export const light: ThemeTokens = {
  color: {
    neutral: { DEFAULT: '#171717', on: '#ffffff' },
    primary: { DEFAULT: '#3b63c4', on: '#ffffff' },
    success: { DEFAULT: '#3d8a5f', on: '#ffffff' },
    warning: { DEFAULT: '#b7791f', on: '#ffffff' },
    danger: { DEFAULT: '#c4463d', on: '#ffffff' },
    bg: {
      canvas: '#fafafa',
      surface: '#ffffff',
      muted: '#f2f2f2',
    },
    text: {
      DEFAULT: '#171717',
      secondary: '#5c5c5c',
      tertiary: '#8f8f8f',
      disabled: '#b5b5b5',
    },
    border: {
      subtle: '#f0f0f0',
      DEFAULT: '#e6e6e6',
      strong: '#d1d1d1',
    },
    focus: '#7d97d6',
  },
  font: {
    family:
      'system-ui, -apple-system, "Segoe UI", "Helvetica Neue", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
    familyMono: 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
    size: { sm: '13px', md: '14px', lg: '16px' },
    weight: { regular: '400', medium: '500', bold: '600' },
    lineHeight: '1.6',
  },
  radius: {
    control: '6px',
    container: '12px',
    full: '9999px',
  },
  control: {
    height: { sm: '28px', md: '32px', lg: '40px' },
    paddingX: { sm: '10px', md: '12px', lg: '16px' },
    gap: { sm: '4px', md: '6px', lg: '8px' },
  },
  shadow: {
    sm: '0 1px 2px rgb(0 0 0 / 0.04)',
    md: '0 1px 2px rgb(0 0 0 / 0.04), 0 4px 12px -2px rgb(0 0 0 / 0.06)',
    lg: '0 2px 4px rgb(0 0 0 / 0.04), 0 16px 32px -8px rgb(0 0 0 / 0.1)',
  },
  motion: {
    duration: { fast: '150ms', normal: '220ms' },
    easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
  },
}
