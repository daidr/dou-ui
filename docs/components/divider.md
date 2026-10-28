# Divider 分割线

一条 1px 的细线，区分内容的区域。带文字时，文字使用最弱的灰阶，不与内容争夺注意力。

## 基础用法

<div class="demo demo--column">
  <DouText variant="secondary">上方的内容</DouText>
  <DouDivider />
  <DouText variant="secondary">下方的内容</DouText>
</div>

```vue
<DouDivider />
```

## 带文字

`align` 控制文字的位置。

<div class="demo demo--column">
  <DouDivider>或</DouDivider>
  <DouDivider align="start">基本信息</DouDivider>
  <DouDivider align="end" dashed>以上为预览</DouDivider>
</div>

```vue
<DouDivider>或</DouDivider>
<DouDivider align="start">基本信息</DouDivider>
<DouDivider align="end" dashed>以上为预览</DouDivider>
```

## 垂直

在一行中分隔内联内容。

<div class="demo">
  <span>
    <DouLink href="#" underline="hover">编辑</DouLink>
    <DouDivider direction="vertical" />
    <DouLink href="#" underline="hover">复制</DouLink>
    <DouDivider direction="vertical" />
    <DouLink href="#" underline="hover" tone="danger">删除</DouLink>
  </span>
</div>

```vue
<DouLink>编辑</DouLink>
<DouDivider direction="vertical" />
<DouLink>复制</DouLink>
```

## API

### Props

| 名称        | 说明                   | 类型                           | 默认值         |
| ----------- | ---------------------- | ------------------------------ | -------------- |
| `direction` | 方向                   | `'horizontal' \| 'vertical'`   | `'horizontal'` |
| `align`     | 文字位置，仅水平时有效 | `'start' \| 'center' \| 'end'` | `'center'`     |
| `dashed`    | 虚线                   | `boolean`                      | `false`        |

### Slots

| 名称      | 说明               |
| --------- | ------------------ |
| `default` | 文字，仅水平时有效 |

### CSS 变量

| 变量                    | 说明               |
| ----------------------- | ------------------ |
| `--dou-divider-color`   | 线条颜色           |
| `--dou-divider-spacing` | 水平分割线上下间距 |
