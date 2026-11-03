# DouUI

为自己打造的 Vue 3 组件库。

- 以黑白灰为主的简洁风格，颜色只用于表达语义；1px 细描边，只有浮起的元素才有层叠阴影
- 样式基于设计 Token，可以整体替换主题，也可以局部覆盖；所有样式都在级联层里，页面上的样式总能覆盖
- 统一的 Props 约定：`variant`、`tone`、`size` 可以任意组合
- 内置无障碍支持，文字对比度按 WCAG AA 取值；提供完整的 TypeScript 类型，支持按需引入

设计取舍见 [设计原则](./docs/guide/philosophy.md)，视觉规范见 [视觉语言](./docs/guide/visual-language.md)，组件计划见 [路线图](./ROADMAP.md)。

UI 设计与组件由内部组件库演化而来，代码由 Claude Code 与 Codex 编写。

> 仍处于早期阶段：`1.0.0` 之前，次版本号（`0.x.0`）的变化可能包含不兼容的改动，变化记录在 [更新日志](./CHANGELOG.md)。

## 安装

```sh
bun add dou-ui
```

想提前试用新功能，可以安装预发布版本：`bun add dou-ui@beta` 或 `bun add dou-ui@alpha`。正式版文档在 [ui.daidr.me](https://ui.daidr.me)，主分支的开发版文档在 [next.ui.daidr.me](https://next.ui.daidr.me)。

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

也可以用 `@dou-ui/resolver` 配合按需组件插件自动导入，详见 [Vite](./docs/integrations/vite.md)；Nuxt 应用用 `@dou-ui/nuxt`，详见 [Nuxt](./docs/integrations/nuxt.md)。

### 主题

内置亮色与暗色主题。给任意元素加上 `data-dou-theme` 即可切换这棵子树的主题：

```html
<html data-dou-theme="dark"></html>
```

Token 都是 CSS 变量，可以直接覆盖，也可以用 `@dou-ui/theme` 的 `defineTheme` 生成一整套主题，详见 [主题与 Token](./docs/guide/theming.md)。

## 包

| 包                     | 内容                            |
| ---------------------- | ------------------------------- |
| `dou-ui`               | 组件，附带全量样式 `style.css`  |
| `@dou-ui/theme`        | 设计 Token、主题 API 与全部样式 |
| `@dou-ui/icons`        | 线性图标库，可以单独使用        |
| `@dou-ui/resolver`     | 按需自动导入的解析器            |
| `@dou-ui/nuxt`         | Nuxt 模块                       |
| `@dou-ui/editor`       | 块编辑器                        |
| `@dou-ui/sheet`        | 电子表格                        |
| `@dou-ui/sheet-xlsx`   | 电子表格的 .xlsx 导入导出       |
| `@dou-ui/code`         | 代码编辑器                      |
| `@dou-ui/chart`        | 图表                            |
| `@dou-ui/flow`         | 流程编辑器与白板                |
| `@dou-ui/gantt`        | 甘特图与资源排期                |
| `@dou-ui/pivot`        | 数据透视表                      |
| `@dou-ui/dashboard`    | 仪表盘                          |
| `@dou-ui/form-builder` | 表单设计器                      |

所有包使用同一个版本号，一起发布。

## 仓库结构

```
packages/
  dou-ui/        组件（结构与行为），对外发布的主包
  theme/         设计 Token 与全部样式（@dou-ui/theme）
  icons/         线性图标库（@dou-ui/icons），可独立使用
  resolver/      按需自动导入的解析器（@dou-ui/resolver）
  nuxt/          Nuxt 模块（@dou-ui/nuxt），playground/ 是调试用的 Nuxt 应用
playground/      本地调试用的 Vite 应用
docs/            文档站（VitePress）
```

## 开发

需要 [Bun](https://bun.sh) ≥ 1.4。

```sh
bun install

bun run dev          # 启动 playground
bun run --filter @dou-ui/nuxt play   # 启动 Nuxt playground（先 bun run build）
bun run docs:dev     # 启动文档站

bun fmt              # 格式化（Bun 内置）
bun run lint         # oxlint
bun run typecheck    # vue-tsc
bun run test         # vitest
bun run check        # 以上全部（CI 同款）

bun run build        # 构建全部包
```

### 工具链

| 用途          | 工具                         | 说明                                               |
| ------------- | ---------------------------- | -------------------------------------------------- |
| 包管理 / 脚本 | Bun workspaces               |                                                    |
| 格式化        | `bun fmt`                    | Bun 内置，支持 `.vue`                              |
| Lint          | oxlint                       | Bun 暂无内置 lint                                  |
| 类型检查      | vue-tsc                      | `bun check` 尚不支持 `.vue`                        |
| 组件构建      | Vite（库模式，保留模块结构） | 编译单文件组件                                     |
| 样式 / Token  | `Bun.build` + 自定义脚本     | Token 由 TypeScript 生成 CSS 变量，CSS 由 Bun 打包 |
| 测试          | Vitest + @vue/test-utils     | 需要编译单文件组件                                 |
| 文档          | VitePress                    |                                                    |

> TypeScript 固定在 6.x：7.x 不再提供单文件组件编译与 vue-tsc 依赖的 JS API。

### 新增组件

1. `packages/dou-ui/src/components/<name>/`：`<name>.ts`（类型）、`<name>.vue`、`index.ts`、`__tests__/`
2. `packages/theme/src/components/<name>.css`：只引用 `--dou-*` Token，写在 `@layer dou.components` 内，并在 `src/index.css` 中引入
3. 在 `packages/dou-ui/src/components/index.ts` 与 `src/plugin.ts` 中注册
4. 在 `docs/components/<name>.md` 编写文档并加入侧边栏

### 新增图标

1. 在 `packages/icons/icons/` 中添加 `<name>.json`（`label`、`categories`）与 `<name>.stroke.svg`
2. `bun run gen` 校验并生成组件，图标会自动出现在文档站的图标库页面

绘制规则见 [绘制规范](./docs/icons/design.md)。

### 改动记录与发布

改动了包的 PR 要在 `.changes/` 里加一条说明（`bun run changelog add`），写法见 [.changes/README.md](./.changes/README.md)。发版由 GitHub Actions 完成，带 npm 的透明度证明，流程见 [RELEASING.md](./RELEASING.md)。
