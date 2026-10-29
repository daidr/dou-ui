# Icon 图标

<script setup>
import { CheckCircleIcon, LoaderIcon, SearchIcon, SettingsIcon } from '@dou-ui/icons'
</script>

为任意内联图形提供统一的尺寸与无障碍语义。

`dou-ui` 本身**不内置图标集**：图标通过默认插槽传入。组件库内部和本站的所有图标都来自配套的独立子包 [@dou-ui/icons](/icons/)，项目里独有的图形也可以用它的 `createIcon` 画成同样风格的组件。`DouIcon` 只负责三件事：尺寸、颜色跟随文字（`currentColor`）、读屏语义。

## 基础用法

默认尺寸为 `1em`，因此图标总是与周围文字一样大。

<div class="demo">
  <DouText>
    <DouIcon>
      <SearchIcon />
    </DouIcon>
    搜索
  </DouText>
  <DouText tone="success">
    <DouIcon>
      <CheckCircleIcon />
    </DouIcon>
    已通过
  </DouText>
</div>

```vue
<script setup>
import { SearchIcon } from '@dou-ui/icons'
</script>

<template>
  <DouIcon><SearchIcon /></DouIcon>
</template>
```

## 尺寸

`size` 接受数字（像素）或任意 CSS 长度。

<div class="demo">
  <DouIcon :size="14"><SettingsIcon /></DouIcon>
  <DouIcon :size="20"><SettingsIcon /></DouIcon>
  <DouIcon size="2em"><SettingsIcon /></DouIcon>
</div>

```vue
<DouIcon :size="20"><SettingsIcon /></DouIcon>
<DouIcon size="2em"><SettingsIcon /></DouIcon>
```

## 旋转

<div class="demo">
  <DouIcon spin :size="18"><LoaderIcon /></DouIcon>
</div>

## 无障碍

图标默认被视为装饰，带有 `aria-hidden="true"`。当图标本身就是唯一的信息来源时（例如没有文字的按钮），用 `label` 给它一个可读的名字，它会变成 `role="img"`。

```vue
<DouIcon label="设置"><SettingsIcon /></DouIcon>
```

## API

### Props

| 名称    | 说明                                   | 类型               | 默认值  |
| ------- | -------------------------------------- | ------------------ | ------- |
| `size`  | 尺寸，数字按像素处理                   | `number \| string` | `1em`   |
| `label` | 可读名称；不提供时图标对读屏软件不可见 | `string`           | —       |
| `spin`  | 持续旋转                               | `boolean`          | `false` |

### Slots

| 名称      | 说明                                      |
| --------- | ----------------------------------------- |
| `default` | 图形本身，通常是 @dou-ui/icons 的图标组件 |

### CSS 变量

| 变量              | 说明 |
| ----------------- | ---- |
| `--dou-icon-size` | 尺寸 |
