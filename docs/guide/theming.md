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

每种语气色（tone）有三个值：颜色本身 `DEFAULT`、显示在它上面的文字颜色 `on`，以及把它当作文字使用时的颜色 `text`（浅色按钮与标签、链接、带语气色的文字）。
亮色主题里 `text` 基本等于 `DEFAULT`；暗色主题里同一个颜色无法既衬托白字、又在深色页面上作为文字清晰可读，所以 `text` 更亮一些。三者的对比度都按 WCAG AA（正文 4.5:1）取值。
悬停、按下、浅色背景等状态由组件通过 `color-mix()` 计算，修改一个颜色后相关状态会一起更新。

## 亮色与暗色

`scheme.dark`（`--dou-scheme-dark`）表示主题属于亮色还是暗色：亮色主题是 `0`，暗色主题是 `1`。少数样式在两种主题下取不同的值，比如暗色主题里浮层要比页面稍亮才能分出层次，组件用这个 Token 在两个值之间取舍：

```css
.my-panel {
  /* 亮色主题里是表面色，暗色主题里混入 4% 的文字颜色 */
  background: color-mix(
    in oklab,
    var(--dou-color-text) calc(4% * var(--dou-scheme-dark)),
    var(--dou-color-bg-surface)
  );
}
```

主题完全由 Token 决定，不依赖页面的 `color-scheme`，所以用 `themeToCss` 挂到任意选择器上的主题都能直接使用。从 `dark` 派生的主题（包括 `createTheme` 生成的暗色主题）会带上 `1`。

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

### 输入文字的最小字号

`--dou-font-size-input-min` 是所有可输入文字的地方的最小字号，默认 `0px`，在触屏设备（`pointer: coarse`）上是 `16px`，用来避免手机浏览器聚焦输入框时自动放大页面。
它不属于主题 Token，`defineTheme` 不会改动它。设为 `0px` 可以关闭这个行为，输入框在手机上也使用原本的字号：

```css
:root {
  --dou-font-size-input-min: 0px !important;
}
```

自己写的输入控件可以这样使用它：

```css
.my-input {
  font-size: max(var(--dou-font-size-input-min), 14px);
}
```

## 定义完整主题

```ts
import { defineTheme, light, themeToCss } from '@dou-ui/theme'

const brand = defineTheme(light, {
  color: { primary: { DEFAULT: '#6d5bd0', on: '#ffffff', text: '#6d5bd0' } },
  radius: { control: '999px' },
})

// 生成一段 CSS，挂到任意选择器上
const css = themeToCss(brand, '[data-dou-theme="brand"]')
```

## 从品牌色生成

只想换品牌色时，用 `createTheme` 传入颜色，会同时得到亮色和暗色两套主题。每个颜色会生成一组语气 Token：

- `DEFAULT`：按钮等实心填充的颜色，尽量保持传入的颜色。
- `on`：填充色上的文字，从白色和深色中选择对比度足够的一个。
- `text`：在页面上当作文字使用的颜色。

如果传入的颜色在某套主题里对比度不足，会在 OKLCH 里只调整明度，直到所有文字对比度都不低于 4.5:1，色相保持不变。焦点环的颜色由 `primary` 推出，对页面的对比度不低于 3:1。

```ts
import { createTheme, themeToCss } from '@dou-ui/theme'

const { light, dark } = createTheme({ primary: '#7c3aed', danger: '#e11d48' })

const css =
  themeToCss(light, ':root, [data-dou-theme="light"]') + themeToCss(dark, '[data-dou-theme="dark"]')
```

下面换一个颜色试试，示例只把生成的颜色用在预览区域里：

<DocDemo src="theming/create-theme" />

想同时调整中性色、圆角和字号，可以用 [主题编辑器](./theme-editor)。

没有传入的语气保持默认值。颜色接受 `#rrggbb`、`#rgb` 与 `rgb()` 写法。第二个参数可以换掉起点主题，比如 `createTheme({ primary }, { light: myLight, dark: myDark })`。

只需要单个语气时可以用 `createTone(color, base)`，`base` 决定按亮色还是暗色处理。`contrastRatio(a, b)` 返回两个颜色的对比度，可以用来检查自己定义的 Token。`mixColors(color, base, amount)` 按 OKLab 把 `amount`（0–1）的 `color` 混进 `base`，和 CSS 的 `color-mix(in oklab, color amount%, base)` 一致，返回 `#rrggbb`，适合在画布、导出的文件这类用不了 CSS 变量的地方算出主题色的浅色版本。

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
