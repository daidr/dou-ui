# Tooltip 文字提示

指向或聚焦一个元素时，在旁边显示一句简短的说明。亮色主题下是一块墨色的标签，暗色主题下是抬起一层的灰色表面加细描边。它只用来补充说明，不放可交互的内容——那是 [气泡卡片](./popover) 的事。

浮层的通用行为（渲染位置、定位、层级、关闭）见 [浮层](../guide/overlays)。

## 基础用法

默认插槽是触发元素，`content` 是提示文字。指向后稍等片刻出现，键盘聚焦时立即出现。

<div class="demo">
  <DouTooltip content="复制部署地址">
    <DouButton variant="outline">复制</DouButton>
  </DouTooltip>
  <DouTooltip content="最近一次部署于 3 分钟前完成">
    <DouText variant="secondary" tabindex="0">3 分钟前</DouText>
  </DouTooltip>
</div>

```vue
<DouTooltip content="复制部署地址">
  <DouButton variant="outline">复制</DouButton>
</DouTooltip>
```

触发元素不需要额外的包裹：属性与事件直接加在插槽的第一个元素上。插槽里只是一段文字时，会包一层 `<span>`。

## 位置

`placement` 是首选的一侧，放不下时自动翻到对侧。

<div class="demo">
  <DouTooltip v-for="placement in ['top', 'bottom', 'left', 'right', 'top-start', 'bottom-end']" :key="placement" :content="placement" :placement="placement">
    <DouButton variant="outline" size="sm">{{ placement }}</DouButton>
  </DouTooltip>
</div>

## 自定义内容

`content` 插槽可以放更丰富的内容，例如快捷键。

<div class="demo">
  <DouTooltip>
    <DouButton variant="outline">保存</DouButton>
    <template #content>保存草稿 <span style="opacity: 0.6">⌘S</span></template>
  </DouTooltip>
</div>

```vue
<DouTooltip>
  <DouButton variant="outline">保存</DouButton>
  <template #content>保存草稿 <span style="opacity: 0.6">⌘S</span></template>
</DouTooltip>
```

## 键盘与读屏

提示带有 `role="tooltip"`，显示期间触发元素的 `aria-describedby` 指向它，读屏会在读完触发元素后读出提示。`Esc` 关闭提示且不移动焦点。指针可以移到提示上而不让它消失。

## API

### Props

| 名称        | 说明                           | 类型                             | 默认值   |
| ----------- | ------------------------------ | -------------------------------- | -------- |
| `open`      | 是否显示，配合 `v-model:open`  | `boolean`                        | `false`  |
| `content`   | 提示文字                       | `string`                         | —        |
| `placement` | 首选的一侧                     | `Placement`                      | `'top'`  |
| `disabled`  | 不再显示                       | `boolean`                        | `false`  |
| `showDelay` | 指向后多久显示，毫秒           | `number`                         | `200`    |
| `hideDelay` | 离开后多久隐藏，毫秒           | `number`                         | `100`    |
| `offset`    | 与触发元素的间距，px           | `number`                         | `6`      |
| `teleport`  | 渲染到哪里；`false` 为原地渲染 | `string \| HTMLElement \| false` | `'body'` |

`Placement` 为 `'top' | 'right' | 'bottom' | 'left'`，可加 `-start` / `-end`。

### Slots

| 名称      | 说明                     |
| --------- | ------------------------ |
| `default` | 触发元素                 |
| `content` | 提示内容，替代 `content` |

### CSS 变量

| 变量                      | 说明     |
| ------------------------- | -------- |
| `--dou-tooltip-bg`        | 底色     |
| `--dou-tooltip-color`     | 文字颜色 |
| `--dou-tooltip-border`    | 描边颜色 |
| `--dou-tooltip-max-width` | 最大宽度 |
