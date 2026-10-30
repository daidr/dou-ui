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
    neutral: { DEFAULT: '#171717', on: '#ffffff', text: '#171717' },
    primary: { DEFAULT: '#3f56b5', on: '#ffffff', text: '#3f56b5' },
    success: { DEFAULT: '#2e7d5b', on: '#ffffff', text: '#2c7756' },
    warning: { DEFAULT: '#92651d', on: '#ffffff', text: '#8b5f1c' },
    danger: { DEFAULT: '#b2423e', on: '#ffffff', text: '#b2423e' },
    bg: {
      canvas: '#fafafa',
      surface: '#ffffff',
      muted: '#f2f2f2',
    },
    text: {
      DEFAULT: '#171717',
      secondary: '#5c5c5c',
      tertiary: '#737373',
      disabled: '#b5b5b5',
    },
    border: {
      subtle: '#f0f0f0',
      DEFAULT: '#e6e6e6',
      strong: '#d1d1d1',
    },
    focus: '#6a82cf',
    edge: '#000000',
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
  space: { sm: '8px', md: '12px', lg: '20px' },
  shadow: {
    sm: '0 1px 1px rgb(0 0 0 / 0.03), 0 1px 2px rgb(0 0 0 / 0.05)',
    md: '0 1px 2px rgb(0 0 0 / 0.04), 0 4px 12px -2px rgb(0 0 0 / 0.06)',
    lg: '0 2px 4px rgb(0 0 0 / 0.04), 0 16px 32px -8px rgb(0 0 0 / 0.1)',
    highlight: 'inset 0 1px 0 rgb(255 255 255 / 0.14)',
  },
  motion: {
    duration: { instant: '100ms', fast: '150ms', normal: '220ms', slow: '320ms' },
    easing: {
      DEFAULT: 'cubic-bezier(0.2, 0, 0, 1)',
      enter: 'cubic-bezier(0.16, 1, 0.3, 1)',
      exit: 'cubic-bezier(0.4, 0, 1, 1)',
      // a damped spring that overshoots by about 14% and settles
      spring:
        'linear(0, 0.192, 0.408, 0.616, 0.797, 0.94, 1.043, 1.107, 1.138, 1.145, 1.133, 1.111, 1.084, 1.057, 1.033, 1.013, 0.998, 0.989, 0.983, 0.982, 0.983, 0.985, 0.988, 0.992, 1)',
    },
    distance: { sm: '4px', md: '8px' },
    scale: '0.98',
    loop: { spin: '0.8s', pulse: '1.6s', sweep: '2s' },
  },
}
