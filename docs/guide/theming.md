# 主题与 Token

DouUI 内置 `light` 与 `dark` 两套主题，具体取值见 [视觉语言](./visual-language)。
本页介绍 Token 的结构和定制方法。

## Token 的来源

所有 Token 都定义在 `@dou-ui/theme` 的 TypeScript 对象（`ThemeTokens`）中，构建时转换为 CSS 自定义属性：

| Token 路径              | CSS 变量                  |
| ----------------------- | ------------------------- |
| `color.primary.DEFAULT` | `--dou-color-primary`     |
| `color.primary.on`      | `--dou-color-primary-on`  |
| `color.bg.surface`      | `--dou-color-bg-surface`  |
| `control.height.md`     | `--dou-control-height-md` |
| `radius.control`        | `--dou-radius-control`    |

规则：路径用 `-` 连接，camelCase 转为 kebab-case，`DEFAULT` 省略。

## 按用途命名

Token 名称表示**用途**，例如 `color.primary`、`color.bg.surface`、`radius.control`，
而不是 `blue-500`、`gray-100` 这样的色板编号。组件只引用用途，具体的值由主题决定。

每种语气色（tone）只需要两个值：颜色本身 `DEFAULT`，以及显示在它上面的文字颜色 `on`。
悬停、按下、浅色背景等状态由组件通过 `color-mix()` 计算，修改一个颜色后相关状态会一起更新。

## 覆盖单个 Token

Token 就是普通的 CSS 变量，不在级联层中的样式可以直接覆盖：

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
  color: { primary: { DEFAULT: '#6d5bd0', on: '#ffffff' } },
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

不在级联层中的业务样式优先级总是更高，覆盖组件样式时不需要提高选择器权重，也不需要 `!important`。

::: tip 与全局重置样式共存
如果页面里有**不在 layer 中**的全局重置（例如 `button { background: transparent; padding: 0 }`），
它会覆盖 DouUI 的组件样式。建议把这类重置也放进一个更早的级联层；如果做不到，
可以用 `revert-layer` 让相关属性恢复使用 DouUI 的样式：

```css
.dou-button {
  padding: revert-layer;
  border: revert-layer;
  background-color: revert-layer;
  color: revert-layer;
  line-height: revert-layer;
}
```

:::
