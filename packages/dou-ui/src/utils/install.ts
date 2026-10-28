import type { App, Component, Plugin } from 'vue'

export type WithInstall<T> = T & Plugin

/** Attach an `install` method so a component can be used with `app.use()`. */
export function withInstall<T extends Component>(component: T): WithInstall<T> {
  const target = component as WithInstall<T>
  target.install = (app: App) => {
    const { name } = component as { name?: string }
    if (!name) throw new Error('[dou-ui] component registered with app.use() must have a name')
    app.component(name, component)
  }
  return target
}
