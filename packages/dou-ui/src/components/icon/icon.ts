export interface IconProps {
  /**
   * Rendered size. A number is read as pixels. Defaults to `1em`, so the
   * icon follows the surrounding font size.
   */
  size?: number | string
  /**
   * Accessible name. Without one the icon is treated as decoration and
   * hidden from assistive technology.
   */
  label?: string
  /** Rotate continuously, e.g. for a loading indicator. */
  spin?: boolean
}

export interface IconSlots {
  /** The graphic itself, usually an inline `<svg>`. */
  default?: () => unknown
}
