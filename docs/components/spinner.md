# Spinner 加载

表示正在加载、但无法确定进度的图标。

需要表示进度时用 [Progress 进度条](./progress)；要遮住一块正在加载的内容时用 [Loading 加载遮罩](./loading)。

## 基础用法

<DocDemo src="spinner/basic" />

## 读屏

圆环带 `role="status"` 与标签，默认取语言包里的“加载中”，可用 `label` 改写。

## API

### Props

| 名称    | 说明                                       | 类型                             | 默认值 |
| ------- | ------------------------------------------ | -------------------------------- | ------ |
| `size`  | `sm` 12px、`md` 16px、`lg` 20px；数字为 px | `'sm' \| 'md' \| 'lg' \| number` | `'md'` |
| `label` | 读屏标签                                   | `string`                         | 语言包 |

### CSS 变量

| 变量                  | 说明 |
| --------------------- | ---- |
| `--dou-spinner-size`  | 直径 |
| `--dou-spinner-width` | 线宽 |
