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
  }

  motion: {
    duration: {
      fast: string
      normal: string
    }
    easing: string
  }
}

/** A tone is a single color plus the color that reads on top of it. */
export interface ToneTokens {
  DEFAULT: string
  /** Foreground (text / icon) color used on a solid `DEFAULT` background. */
  on: string
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
