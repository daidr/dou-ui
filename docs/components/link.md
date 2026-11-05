# Link 链接

文字形态的链接：有 `href` 时跳转到别处，没有 `href` 时是一行文字里的操作。

## 基础用法

<DocDemo src="link/basic" />

## 下划线

`underline` 控制下划线何时出现：常驻（默认）、仅悬停、从不。

<DocDemo src="link/underline" />

## 浅色底

`variant="soft"` 给链接加上所在语气的浅色底色，和周围的文字区分开，适合在消息里引用合并请求、讨论或文档。悬停时底色略深；默认不带下划线，需要时仍可以设 `underline`。它和文字一样随行折断，每一行都有自己的圆角底色。图标放在 `leading` 插槽里，总是和紧挨的字留在同一行。不传 `href` 时它是按钮，按钮不会折断，会整块换到下一行。

把链接和前后的文字写在同一行：模板里的换行会变成一个空格，出现在“，”这类全角标点前面。

要显示一个固定高度、不折行、不可点击的标记时用 [Tag](./tag)；带地址、可以点开的行内引用用浅色底的链接。

<DocDemo src="link/soft" />

## 外部链接

`external` 会在新标签页打开，自动加上 `rel="noopener noreferrer"`，并在末尾标记一个箭头。

<DocDemo src="link/external" />

## 行内操作

不传 `href` 时，链接不去任何地方，而是执行一个操作，因此渲染为 `<button type="button">`：外观不变，可以用 Tab 聚焦，按 Enter 或空格触发 `click`。适合嵌在一句话里的“撤销”“重试”这类操作；独立成块的操作仍然用 [Button](./button)。

<DocDemo src="link/action" />

需要跳转时传 `href`，需要执行操作时监听 `click`，不要用 `href="#"` 凑出一个可点的链接。`external` 只对 `href` 有意义，没有 `href` 时开发环境会给出警告。

放在 Checkbox 的文字里时，例如“我已阅读并同意用户协议”，点“用户协议”只触发它自己的 `click`，不会顺带勾选复选框。

按钮里不能再放按钮，所以不要把行内操作放进本身可点击的位置，例如可折叠面板的标题、表格的表头；开发环境会给出警告。

## 禁用

禁用的链接会移除 `href`，既不能跟随也不能获得焦点，并带有 `aria-disabled`；没有 `href` 时则是原生禁用的按钮。

<DocDemo src="link/disabled" />

## 图标

与按钮一致，用 `leading` / `trailing` 插槽放置图标；`trailing` 会替代外部链接的箭头。

```vue
<DouLink href="/changelog">
  更新日志
  <template #trailing>→</template>
</DouLink>
```

## API

### Props

| 名称        | 说明                                                   | 类型                                                           | 默认值      |
| ----------- | ------------------------------------------------------ | -------------------------------------------------------------- | ----------- |
| `href`      | 目标地址；不传时渲染为按钮                             | `string`                                                       | —           |
| `tone`      | 语义                                                   | `'neutral' \| 'primary' \| 'success' \| 'warning' \| 'danger'` | `'neutral'` |
| `variant`   | 外观：`text` 为行内文字，`soft` 带浅色底               | `'text' \| 'soft'`                                             | `'text'`    |
| `underline` | 下划线出现的时机；`soft` 默认 `none`                   | `'always' \| 'hover' \| 'none'`                                | `'always'`  |
| `disabled`  | 禁用                                                   | `boolean`                                                      | `false`     |
| `external`  | 在新标签页打开，并加上安全的 `rel` 与箭头，需要 `href` | `boolean`                                                      | `false`     |

### Events

| 名称    | 说明                     | 参数                  |
| ------- | ------------------------ | --------------------- |
| `click` | 点击时触发，禁用时不触发 | `(event: MouseEvent)` |

### Slots

| 名称       | 说明                       |
| ---------- | -------------------------- |
| `default`  | 链接文字                   |
| `leading`  | 文字前的内容               |
| `trailing` | 文字后的内容，替代外链箭头 |

### CSS 变量

| 变量                         | 说明               |
| ---------------------------- | ------------------ |
| `--dou-link-tone`            | 文字颜色           |
| `--dou-link-underline`       | 静止时下划线颜色   |
| `--dou-link-underline-hover` | 悬停时下划线颜色   |
| `--dou-link-fill`            | 浅色底的颜色       |
| `--dou-link-fill-hover`      | 浅色底悬停时的颜色 |
