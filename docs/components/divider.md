# Divider 分割线

分隔内容的细线，可以带文字。

## 基础用法

<DocDemo src="divider/basic" column />

## 带文字

`align` 控制文字的位置。

<DocDemo src="divider/text" column />

## 垂直

在一行中分隔内联内容。

<DocDemo src="divider/vertical" />

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
