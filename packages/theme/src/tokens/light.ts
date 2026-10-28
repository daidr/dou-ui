import type { ThemeTokens } from './types'

/**
 * Draft light theme.
 *
 * The visual direction of DouUI is not decided yet. These values are
 * deliberately plain placeholders that prove the token pipeline; expect
 * them to change.
 */
export const light: ThemeTokens = {
  color: {
    primary: { DEFAULT: '#2f6bff', on: '#ffffff' },
    neutral: { DEFAULT: '#3a3f47', on: '#ffffff' },
    success: { DEFAULT: '#1f9d55', on: '#ffffff' },
    warning: { DEFAULT: '#d98a00', on: '#ffffff' },
    danger: { DEFAULT: '#e5484d', on: '#ffffff' },
    bg: {
      canvas: '#f7f8fa',
      surface: '#ffffff',
      muted: '#eef0f3',
    },
    text: {
      DEFAULT: '#1c1f24',
      secondary: '#5b616b',
      disabled: '#a4a9b1',
    },
    border: {
      DEFAULT: '#dde1e6',
      strong: '#b9bfc7',
    },
    focus: '#2f6bff',
    stateMix: '#000000',
  },
  font: {
    family:
      'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif',
    familyMono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    size: { sm: '12px', md: '14px', lg: '16px' },
    weight: { regular: '400', medium: '500', bold: '600' },
    lineHeight: '1.5',
  },
  radius: {
    control: '6px',
    container: '10px',
    full: '9999px',
  },
  control: {
    height: { sm: '28px', md: '34px', lg: '40px' },
    paddingX: { sm: '10px', md: '14px', lg: '18px' },
    gap: { sm: '4px', md: '6px', lg: '8px' },
  },
  shadow: {
    sm: '0 1px 2px rgb(0 0 0 / 0.06)',
    md: '0 4px 12px rgb(0 0 0 / 0.08)',
    lg: '0 12px 32px rgb(0 0 0 / 0.12)',
  },
  motion: {
    duration: { fast: '120ms', normal: '200ms' },
    easing: 'cubic-bezier(0.2, 0, 0, 1)',
  },
}
