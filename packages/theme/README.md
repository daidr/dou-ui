# @dou-ui/theme

[DouUI](https://github.com/daidr/dou-ui) 的设计 Token、主题 API 与样式。通常不需要单独安装，`dou-ui` 已经依赖它。

## 样式文件

| 路径                                  | 内容                                     |
| ------------------------------------- | ---------------------------------------- |
| `@dou-ui/theme/index.css`             | 全部样式（等同于 `dou-ui/style.css`）    |
| `@dou-ui/theme/core.css`              | 级联层顺序、Token 与基础层，不含任何组件 |
| `@dou-ui/theme/components/<name>.css` | 单个组件的样式，需要先引入 `core.css`    |
| `@dou-ui/theme/tokens.css`            | 只有 Token（CSS 变量）                   |

## 定制主题

```ts
import { defineTheme, light, themeToCss } from '@dou-ui/theme'

const brand = defineTheme(light, {
  color: { primary: { DEFAULT: '#6d5bd0', on: '#ffffff', text: '#6d5bd0', soft: '#f4f4fd' } },
})

const css = themeToCss(brand, '[data-dou-theme="brand"]')
```

详见 [主题与 Token](https://github.com/daidr/dou-ui/blob/main/docs/guide/theming.md)。

许可证：MIT
