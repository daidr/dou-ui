# Text 文本

展示文本，支持次要、成功、警告等语义样式。

## 层级

`variant` 决定文字有多"显眼"：正文、辅助说明、元信息。

<div class="demo demo--column">
  <DouText>default：标题与正文</DouText>
  <DouText variant="secondary">secondary：辅助说明、标签、描述</DouText>
  <DouText variant="tertiary">tertiary：占位、提示与元信息</DouText>
</div>

```vue
<DouText variant="secondary">辅助说明</DouText>
```

## 语气

`tone` 与 `variant` 可以任意组合：带语气色的文字在较弱的层级中颜色更浅。

<div class="demo">
  <DouText tone="primary">primary</DouText>
  <DouText tone="success">success</DouText>
  <DouText tone="warning">warning</DouText>
  <DouText tone="danger">danger</DouText>
  <DouText tone="danger" variant="secondary">danger · secondary</DouText>
</div>

## 尺寸与字重

默认继承上下文的字号与字重，需要时再显式指定。

<div class="demo">
  <DouText size="sm">sm 13px</DouText>
  <DouText size="md">md 14px</DouText>
  <DouText size="lg" weight="bold">lg 16px · bold</DouText>
</div>

## 等宽

用于哈希、版本号等"机器文本"，数字使用等宽字形。

<div class="demo">
  <DouText mono variant="tertiary">main · 39dc86b</DouText>
  <DouText mono>v0.1.0</DouText>
</div>

## 截断

`truncate` 为 `true` 时单行省略，为数字时限制为多行。

<div class="demo demo--column">
  <DouText truncate style="max-width: 240px">
    一段很长很长的文字，超出宽度之后会以省略号结尾，而不是撑破布局。
  </DouText>
  <DouText :truncate="2" style="max-width: 240px" variant="secondary">
    多行截断同理：这段文字最多显示两行，剩下的部分会被省略号替代，适合卡片中的描述。
  </DouText>
</div>

```vue
<DouText truncate>...</DouText>
<DouText :truncate="2">...</DouText>
```

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
