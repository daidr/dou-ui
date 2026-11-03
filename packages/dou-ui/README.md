# DouUI

为自己打造的 Vue 3 组件库。

- 以黑白灰为主的简洁风格，颜色只用于表达语义；1px 细描边，只有浮起的元素才有层叠阴影
- 样式基于设计 Token，可以整体替换主题，也可以局部覆盖；所有样式都在级联层里，页面上的样式总能覆盖
- 统一的 Props 约定：`variant`、`tone`、`size` 可以任意组合
- 内置无障碍支持，文字对比度按 WCAG AA 取值；提供完整的 TypeScript 类型，支持按需引入

设计取舍见 [设计原则](https://github.com/daidr/dou-ui/blob/main/docs/guide/philosophy.md)，视觉规范见 [视觉语言](https://github.com/daidr/dou-ui/blob/main/docs/guide/visual-language.md)，组件计划见 [路线图](https://github.com/daidr/dou-ui/blob/main/ROADMAP.md)。

UI 设计与组件由内部组件库演化而来，代码由 Claude Code 与 Codex 编写。文档见 [ui.daidr.me](https://ui.daidr.me)。

> 仍处于早期阶段：`1.0.0` 之前，次版本号（`0.x.0`）的变化可能包含不兼容的改动，变化记录在 [更新日志](https://github.com/daidr/dou-ui/blob/main/CHANGELOG.md)。

## 安装

```sh
bun add dou-ui
```

需要 Vue 3.5 及以上。样式用到了级联层、`color-mix()` 等特性，面向近两年的主流浏览器。

## 使用

### 全量引入

```ts
import { createApp } from 'vue'
import DouUI from 'dou-ui'
import 'dou-ui/style.css'
import App from './App.vue'

createApp(App).use(DouUI).mount('#app')
```

### 按需引入

组件从 `dou-ui` 具名导入，打包工具会摇掉没有用到的部分。样式按组件引入，会自动带上它内部用到的组件的样式：

```ts
import { DouSelect } from 'dou-ui'
import 'dou-ui/components/select/style'
```

也可以用 `@dou-ui/resolver` 配合按需组件插件自动导入，详见 [快速开始](https://github.com/daidr/dou-ui/blob/main/docs/guide/getting-started.md)。

### 主题

内置亮色与暗色主题。给任意元素加上 `data-dou-theme` 即可切换这棵子树的主题：

```html
<html data-dou-theme="dark"></html>
```

Token 都是 CSS 变量，可以直接覆盖，也可以用 `@dou-ui/theme` 的 `defineTheme` 生成一整套主题，详见 [主题与 Token](https://github.com/daidr/dou-ui/blob/main/docs/guide/theming.md)。

## 包

| 包                 | 内容                            |
| ------------------ | ------------------------------- |
| `dou-ui`           | 组件，附带全量样式 `style.css`  |
| `@dou-ui/theme`    | 设计 Token、主题 API 与全部样式 |
| `@dou-ui/icons`    | 线性图标库，可以单独使用        |
| `@dou-ui/resolver` | 按需自动导入的解析器            |

四个包使用同一个版本号，一起发布。

许可证：MIT
