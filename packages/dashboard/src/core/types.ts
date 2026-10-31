/** Where a widget sits on one breakpoint's grid, in columns and rows. */
export interface DashboardPlace {
  x: number
  y: number
  w: number
  h: number
}

/** One widget of a dashboard. Everything in it must survive `JSON.stringify`. */
export interface DashboardWidget<P extends object = Record<string, unknown>> {
  id: string
  /** The `type` of a widget registered with `defineDashboardWidget`. */
  type: string
  /** Shown in the widget's title bar; without one, the type's label is. */
  title?: string
  /** The widget's own settings, read by its component. */
  props?: P
  /**
   * Where it sits, by breakpoint name. The widest breakpoint's place is the
   * main one; a narrower breakpoint without one is laid out from it.
   */
  place: Partial<Record<string, DashboardPlace>>
}

/** A dashboard: a JSON document the app saves and loads itself. */
export interface DashboardDocument {
  version: 1
  widgets: DashboardWidget[]
}
