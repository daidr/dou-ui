# DouUI

为自己打造的 Vue 3 组件库。

> 早期阶段：项目骨架、工具链与视觉语言已就绪，组件正在逐个补齐。

- 淡雅、克制的视觉：黑白灰为主体，色彩只表达语义
- 结构与外观分离：组件只消费语义 Token，主题可整体替换
- 正交、克制的 API：`variant` × `tone` × `size`
- 默认可访问、类型完备、支持按需引入

设计取舍见 [设计哲学](./docs/guide/philosophy.md)，视觉规范见 [视觉语言](./docs/guide/visual-language.md)。

## 仓库结构

```
packages/
  dou-ui/        组件（结构与行为），对外发布的主包
  theme/         设计 Token 与全部样式（@dou-ui/theme）
playground/      本地调试用的 Vite 应用
docs/            文档站（VitePress）
```

## 开发

需要 [Bun](https://bun.sh) ≥ 1.4。

```sh
bun install

bun run dev          # 启动 playground
bun run docs:dev     # 启动文档站

bun fmt              # 格式化（Bun 内置）
bun run lint         # oxlint
bun run typecheck    # vue-tsc
bun run test         # vitest
bun run check        # 以上全部（CI 同款）

bun run build        # 构建 @dou-ui/theme 与 dou-ui
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
