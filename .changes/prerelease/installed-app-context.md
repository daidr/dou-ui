---
type: 新增
packages: [dou-ui]
pr: 350
version: 0.1.0-alpha.4
---

新增 `installedAppContext()` 和 `setInstalledAppContext()`：记下配置了 DouUI 的应用（`app.use(DouUI)`、`provideGlobalConfig(config, app)`、Nuxt 模块），`dialog()`、`toast()` 和在组件树之外渲染的内容都从这里沿用应用的语言包和全局配置。`provideGlobalConfig` 传入 `app` 时，`dialog()` 和 `toast()` 也会沿用这份配置。
