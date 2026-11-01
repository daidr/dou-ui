/**
 * The shape every DouUI theme must satisfy.
 *
 * Tokens describe *roles* (what a value is for), never raw palette steps.
 * Components only ever read these roles, so a theme can change the whole
 * look without touching a single component.
 *
 * A nested key becomes a CSS custom property by joining the path with `-`
 * and converting camelCase to kebab-case. The special key `DEFAULT` is
 * dropped from the path:
 *
 *   color.primary.DEFAULT  -> --dou-color-primary
 *   color.primary.on       -> --dou-color-primary-on
 *   control.height.md      -> --dou-control-height-md
 */
export interface ThemeTokens {
  /**
   * Which side of the light / dark split the theme is on, as a number so
   * styles can mix between a light and a dark value with it:
   * `calc(4% * var(--dou-scheme-dark))` is `0%` in a light theme and `4%`
   * in a dark one. Components take their light and dark variants from this
   * token rather than from `color-scheme`, so a theme is decided by its
   * tokens alone, under any selector.
   */
  scheme: {
    /** `'0'` in light themes, `'1'` in dark ones. */
    dark: '0' | '1'
  }

  color: {
    /** Brand / main call to action. */
    primary: ToneTokens
    /** Default tone for everyday, low-emphasis actions. */
    neutral: ToneTokens
    success: ToneTokens
    warning: ToneTokens
    danger: ToneTokens

    bg: {
      /** The page itself. */
      canvas: string
      /** Cards, popovers, inputs: anything sitting on the canvas. */
      surface: string
      /** Recessed or disabled areas. */
      muted: string
    }
    text: {
      /** Headings and body copy. */
      DEFAULT: string
      /** Supporting copy, labels, descriptions. */
      secondary: string
      /** Placeholders, hints, meta information. */
      tertiary: string
      disabled: string
    }
    border: {
      /** Hairlines between areas, e.g. dividers and table rows. */
      subtle: string
      /** Outlines of controls and containers. */
      DEFAULT: string
      /** Hovered outlines and emphasis. */
      strong: string
    }
    /** Focus ring color. */
    focus: string
    /**
     * Mixed into a tone to draw the edge of filled controls, so a solid
     * button reads as a pressed-in shape rather than a flat block.
     */
    edge: string
    /**
     * Categorical colors for chart series, in the order they are used. The
     * first is neutral, so a chart with one series is not colored for no
     * reason; the rest are low-saturation hues told apart by lightness as
     * well, so they stay distinct for common color-vision deficiencies.
     */
    chart: ChartPalette
    /**
     * Code colors by token kind (`--dou-color-syntax-keyword`, …), shared by
     * the code editor and code blocks. Deep, low-saturation hues on the
     * surface; plain names and punctuation stay in the text colors, so the
     * hue lands on what tells code apart.
     */
    syntax: SyntaxPalette
  }

  font: {
    family: string
    familyMono: string
    size: SizeScale
    weight: {
      regular: string
      medium: string
      bold: string
    }
    lineHeight: string
  }

  radius: {
    /** Buttons, inputs and other interactive controls. */
    control: string
    /** Cards, dialogs and other containers. */
    container: string
    full: string
  }

  /** Shared sizing of interactive controls so they line up in a row. */
  control: {
    height: SizeScale
    paddingX: SizeScale
    gap: SizeScale
  }

  /** Gaps between neighbouring elements, e.g. items in a row of buttons. */
  space: SizeScale

  /**
   * Elevation. Hierarchy comes from surface and border first; shadows
   * stay faint and are reserved for things that float above the page.
   */
  shadow: {
    /** Resting controls such as outlined buttons and inputs. */
    sm: string
    /** Cards and menus. */
    md: string
    /** Dialogs and other overlays. */
    lg: string
    /** Inner top light on filled controls, a hint of bevel. */
    highlight: string
  }

  /**
   * Motion. Things that appear decelerate into place, things that leave
   * accelerate away and take less time. Distances stay small, and
   * reduced-motion settings override these values page-wide.
   */
  motion: {
    duration: {
      /** Color and opacity feedback, and every fade under reduced motion. */
      instant: string
      /** Hover and press, small rotations, popups leaving. */
      fast: string
      /** Popups and dialogs entering, disclosure, indicators moving. */
      normal: string
      /** Panels that travel across the screen, such as drawers. */
      slow: string
    }
    easing: {
      /** Changes between two states of something already on screen. */
      DEFAULT: string
      /** Something appearing: fast start, gentle stop. */
      enter: string
      /** Something leaving: gentle start, fast finish. */
      exit: string
      /**
       * Overshoots and settles back. Only for direct manipulation, where
       * the element answers a finger or pointer that is still on it.
       */
      spring: string
    }
    /** How far things travel when entering or leaving. */
    distance: {
      sm: string
      md: string
    }
    /** The scale things start from when they appear. */
    scale: string
    /** Periods of looping animations. */
    loop: {
      /** Spinners and indeterminate progress. */
      spin: string
      /** Breathing, blinking and typing dots. */
      pulse: string
      /** Placeholder sweeps and ripples. */
      sweep: string
    }
  }
}

/** A tone is a single color plus the color that reads on top of it. */
export interface ToneTokens {
  DEFAULT: string
  /** Foreground (text / icon) color used on a solid `DEFAULT` background. */
  on: string
  /**
   * The tone used as text on the page or on a faint tint of itself (soft
   * buttons and tags, links, toned text). Usually `DEFAULT`; dark themes
   * lighten it, because one color cannot both carry white text and read
   * as text on a dark page.
   */
  text: string
}

/** Eight series colors, `--dou-color-chart-1` to `--dou-color-chart-8`. */
export interface ChartPalette {
  1: string
  2: string
  3: string
  4: string
  5: string
  6: string
  7: string
  8: string
}

/** One color per kind of code token. */
export interface SyntaxPalette {
  keyword: string
  string: string
  number: string
  comment: string
  function: string
  type: string
  variable: string
  property: string
  operator: string
  punctuation: string
  tag: string
  attribute: string
  meta: string
  invalid: string
}

export interface SizeScale {
  sm: string
  md: string
  lg: string
}

/** Recursively optional version of a token tree, for partial overrides. */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K]
}
