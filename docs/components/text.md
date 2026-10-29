# Text 文本

展示文本，支持次要、成功、警告等语义样式。

## 层级

`variant` 决定文字有多"显眼"：正文、辅助说明、元信息。

<DocDemo src="text/nested" column />

## 语气

`tone` 与 `variant` 可以任意组合：带语气色的文字在较弱的层级中颜色更浅。

<DocDemo src="text/tone" />

## 尺寸与字重

默认继承上下文的字号与字重，需要时再显式指定。

<DocDemo src="text/size-weight" />

## 等宽

用于哈希、版本号等"机器文本"，数字使用等宽字形。

<DocDemo src="text/stretch" />

## 截断

`truncate` 为 `true` 时单行省略，为数字时限制为多行。

<DocDemo src="text/ellipsis" column />

## 渲染元素

默认渲染为 `<span>`，用 `as` 换成任意元素。

```vue
<DouText as="p" variant="secondary">一段说明</DouText>
```

## API

### Props

| 名称       | 说明                            | 类型                                                           | 默认值      |
| ---------- | ------------------------------- | -------------------------------------------------------------- | ----------- |
| `variant`  | 显眼程度                        | `'default' \| 'secondary' \| 'tertiary'`                       | `'default'` |
| `tone`     | 语义                            | `'neutral' \| 'primary' \| 'success' \| 'warning' \| 'danger'` | `'neutral'` |
| `size`     | 字号，不设置时继承              | `'sm' \| 'md' \| 'lg'`                                         | —           |
| `weight`   | 字重，不设置时继承              | `'regular' \| 'medium' \| 'bold'`                              | —           |
| `mono`     | 等宽字体                        | `boolean`                                                      | `false`     |
| `truncate` | 截断；`true` 为单行，数字为行数 | `boolean \| number`                                            | `false`     |
| `as`       | 渲染的元素                      | `string`                                                       | `'span'`    |

### CSS 变量

| 变量              | 说明                     |
| ----------------- | ------------------------ |
| `--dou-text-tone` | 基础色，较弱层级由它推导 |
