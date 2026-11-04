---
type: 不兼容
packages: [theme]
---

`--dou-layout-main-padding` 和 `--dou-layout-padding-x` 的默认值改为声明在 `.dou-layout-main` 和 `.dou-layout-header` / `.dou-layout-footer` 上，和其他组件变量一样；原来设在 `:root` 或外层容器上的，要改到这些类上。
