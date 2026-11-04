---
type: 新增
packages: [theme]
---

写死的内边距改为 CSS 变量：`--dou-layout-aside-padding`（侧栏正文和底部，默认 8px，设在 `.dou-layout-aside` 和窄屏抽屉 `.dou-layout-aside-drawer` 上）、`--dou-color-panel-padding`、`--dou-qrcode-padding`、`--dou-result-padding`。

`--dou-layout-main-padding` 和 `--dou-layout-padding-x` 的默认值改为声明在 `.dou-layout-main` 和 `.dou-layout-header` / `.dou-layout-footer` 上，和其他组件变量一样；原来设在 `:root` 或外层容器上的，要改到这些类上。
