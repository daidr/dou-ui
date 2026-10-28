# Spinner 加载

一个开了四分之一口的细圆环，表示正在进行、但不知道还要多久。颜色取当前文字颜色，可以放在按钮里、一行文字旁或单独使用。尺寸都是偶数像素，圆环绕整像素旋转，不会抖。

需要表示进度时用 [Progress 进度条](./progress)；要遮住一块正在加载的内容时用 [Loading 加载遮罩](./loading)。

## 基础用法

<div class="demo">
  <DouSpinner size="sm" />
  <DouSpinner />
  <DouSpinner size="lg" />
  <DouSpinner :size="32" />
  <DouSpace size="sm">
    <DouSpinner size="sm" />
    <DouText variant="secondary" size="sm">正在构建…</DouText>
  </DouSpace>
</div>

```vue
<DouSpinner />
<DouSpinner size="lg" />
<DouSpinner :size="32" />
```

## 读屏

圆环带 `role="status"` 与标签，默认取语言包里的"加载中"，可用 `label` 改写。

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
