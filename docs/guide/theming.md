# 主题与 Token

DouUI 的视觉风格尚未定稿。当前内置的 `light` / `dark` 只是验证管线用的草稿值，**会变**。
但 Token 的结构，也就是"组件能问主题要什么"，是稳定下来的部分。

## Token 从哪里来

唯一的数据源是 `@dou-ui/theme` 里的 TypeScript 对象（`ThemeTokens`）。构建时它被转换成 CSS 自定义属性：

| Token 路径              | CSS 变量                  |
| ----------------------- | ------------------------- |
| `color.primary.DEFAULT` | `--dou-color-primary`     |
| `color.primary.on`      | `--dou-color-primary-on`  |
| `color.bg.surface`      | `--dou-color-bg-surface`  |
| `control.height.md`     | `--dou-control-height-md` |
| `radius.control`        | `--dou-radius-control`    |

规则：路径用 `-` 连接，camelCase 转为 kebab-case，`DEFAULT` 省略。

## Token 只描述角色

Token 命名的是**用途**而不是色板位置：`color.primary`、`color.bg.surface`、`radius.control`，
而不是 `blue-500`、`gray-100`。组件只读角色，所以主题可以自由决定每个角色长什么样。

每个语气（tone）只需要两个值：颜色本身 `DEFAULT` 与压在它上面的前景色 `on`。
悬停、按下、浅色背景等派生状态由组件用 `color-mix()` 计算，因此改一个颜色，所有状态一起跟着变。

## 覆盖单个 Token

Token 只是 CSS 变量，任何非 layer 的样式都能直接覆盖：

```css
:root {
  --dou-color-primary: #7c3aed;
}
```

也可以只作用于某个区域：

```css
.sidebar {
  --dou-radius-control: 0;
}
```

## 定义完整主题

```ts
import { defineTheme, light, themeToCss } from '@dou-ui/theme'

const brand = defineTheme(light, {
  color: { primary: { DEFAULT: '#7c3aed', on: '#ffffff' } },
  radius: { control: '999px' },
})

// 生成一段 CSS，挂到任意选择器上
const css = themeToCss(brand, '[data-dou-theme="brand"]')
```

## 层叠顺序

DouUI 的所有样式都放在级联层（cascade layers）中：

```css
@layer dou.tokens, dou.base, dou.components;
```

不在任何 layer 中的业务样式天然优先级更高，覆盖组件样式时不需要堆选择器、也不需要 `!important`。
