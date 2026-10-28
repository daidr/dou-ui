# Button 按钮

触发一个操作。

## 变体与语气

`variant` 决定按钮有多"重"，`tone` 决定这个操作意味着什么。两者正交，可以任意组合。

<div class="demo">
  <DouButton>solid</DouButton>
  <DouButton variant="soft">soft</DouButton>
  <DouButton variant="outline">outline</DouButton>
  <DouButton variant="ghost">ghost</DouButton>
</div>

<div class="demo">
  <DouButton tone="primary">primary</DouButton>
  <DouButton tone="success">success</DouButton>
  <DouButton tone="warning">warning</DouButton>
  <DouButton tone="danger">danger</DouButton>
  <DouButton variant="soft" tone="danger">删除</DouButton>
</div>

```vue
<DouButton tone="primary">primary</DouButton>
<DouButton variant="soft" tone="danger">删除</DouButton>
```

## 尺寸

<div class="demo">
  <DouButton size="sm" tone="primary">sm</DouButton>
  <DouButton size="md" tone="primary">md</DouButton>
  <DouButton size="lg" tone="primary">lg</DouButton>
</div>

```vue
<DouButton size="sm">sm</DouButton>
```

## 禁用与加载

加载中的按钮会显示指示器并阻止点击，但**仍然可以获得焦点**，读屏软件会读到 `aria-busy`。
禁用的按钮使用原生 `disabled`。

<div class="demo">
  <DouButton tone="primary" disabled>disabled</DouButton>
  <DouButton tone="primary" loading>loading</DouButton>
</div>

```vue
<DouButton disabled>disabled</DouButton>
<DouButton loading>loading</DouButton>
```

## 图标

用 `leading` / `trailing` 插槽放置图标。加载时 `leading` 会被指示器替代。

<div class="demo">
  <DouButton variant="outline"><template #leading>＋</template>新建</DouButton>
  <DouButton variant="ghost">下一步<template #trailing>→</template></DouButton>
</div>

```vue
<DouButton variant="outline">
  <template #leading><PlusIcon /></template>
  新建
</DouButton>
```

## API

### Props

| 名称         | 说明                          | 类型                                                           | 默认值      |
| ------------ | ----------------------------- | -------------------------------------------------------------- | ----------- |
| `variant`    | 视觉权重                      | `'solid' \| 'soft' \| 'outline' \| 'ghost'`                    | `'solid'`   |
| `tone`       | 操作的语义                    | `'neutral' \| 'primary' \| 'success' \| 'warning' \| 'danger'` | `'neutral'` |
| `size`       | 尺寸                          | `'sm' \| 'md' \| 'lg'`                                         | `'md'`      |
| `disabled`   | 禁用                          | `boolean`                                                      | `false`     |
| `loading`    | 加载中                        | `boolean`                                                      | `false`     |
| `block`      | 撑满容器宽度                  | `boolean`                                                      | `false`     |
| `nativeType` | 原生 `type`，默认不会提交表单 | `'button' \| 'submit' \| 'reset'`                              | `'button'`  |

### Events

| 名称    | 说明                             | 参数                  |
| ------- | -------------------------------- | --------------------- |
| `click` | 点击时触发，禁用或加载中不会触发 | `(event: MouseEvent)` |

### Slots

| 名称       | 说明         |
| ---------- | ------------ |
| `default`  | 按钮文字     |
| `leading`  | 文字前的内容 |
| `trailing` | 文字后的内容 |

### CSS 变量

组件内部变量，可在局部覆盖：

| 变量                     | 说明               |
| ------------------------ | ------------------ |
| `--dou-button-tone`      | 基础色             |
| `--dou-button-tone-on`   | 实心背景上的前景色 |
| `--dou-button-height`    | 高度               |
| `--dou-button-padding-x` | 水平内边距         |
| `--dou-button-radius`    | 圆角               |
