# Icon 图标

为任意内联图形提供统一的尺寸与无障碍语义。

DouUI **不内置图标集**：图标通过默认插槽传入，可以是手写的 `<svg>`，也可以是任何图标库导出的组件。`DouIcon` 只负责三件事：尺寸、颜色跟随文字（`currentColor`）、读屏语义。

## 基础用法

默认尺寸为 `1em`，因此图标总是与周围文字一样大。

<div class="demo">
  <DouText>
    <DouIcon>
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" stroke-linecap="round" /></svg>
    </DouIcon>
    搜索
  </DouText>
  <DouText tone="success">
    <DouIcon>
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3.5 8.5l3 3 6-7" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </DouIcon>
    已通过
  </DouText>
</div>

```vue
<DouIcon>
  <svg viewBox="0 0 16 16">...</svg>
</DouIcon>
```

## 尺寸

`size` 接受数字（像素）或任意 CSS 长度。

<div class="demo">
  <DouIcon :size="14"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6" /></svg></DouIcon>
  <DouIcon :size="20"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6" /></svg></DouIcon>
  <DouIcon size="2em"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6" /></svg></DouIcon>
</div>

```vue
<DouIcon :size="20">...</DouIcon>
<DouIcon size="2em">...</DouIcon>
```

## 旋转

<div class="demo">
  <DouIcon spin :size="18"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2a6 6 0 1 0 6 6" stroke-linecap="round" /></svg></DouIcon>
</div>

## 无障碍

图标默认被视为装饰，带有 `aria-hidden="true"`。当图标本身就是唯一的信息来源时（例如没有文字的按钮），用 `label` 给它一个可读的名字，它会变成 `role="img"`。

```vue
<DouIcon label="设置">...</DouIcon>
```

## API

### Props

| 名称    | 说明                                   | 类型               | 默认值  |
| ------- | -------------------------------------- | ------------------ | ------- |
| `size`  | 尺寸，数字按像素处理                   | `number \| string` | `1em`   |
| `label` | 可读名称；不提供时图标对读屏软件不可见 | `string`           | —       |
| `spin`  | 持续旋转                               | `boolean`          | `false` |

### Slots

| 名称      | 说明                     |
| --------- | ------------------------ |
| `default` | 图形本身，通常是 `<svg>` |

### CSS 变量

| 变量              | 说明 |
| ----------------- | ---- |
| `--dou-icon-size` | 尺寸 |
