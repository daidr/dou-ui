# Popover 气泡卡片

点击元素后弹出的卡片，可以放置标题、说明和操作。

浮层的通用行为见 [浮层](../guide/overlays)。

## 基础用法

<DocDemo src="popover/basic" />

## 放入操作

`content` 插槽替换卡片内容，插槽参数里的 `close` 用来关闭卡片。也可以用 `v-model:open` 自己控制。

<DocDemo src="popover/action" />

## 触发方式

`trigger` 为 `hover` 时指向即打开，指针可以从触发元素移到卡片上；`manual` 完全交给 `v-model:open`。

<DocDemo src="popover/trigger" />

## 键盘与读屏

卡片带有 `role="dialog"`，有标题时由标题命名。触发元素带 `aria-haspopup="dialog"`、`aria-expanded` 与 `aria-controls`。卡片是非模态的：焦点留在触发元素上，`Tab` 进入卡片，从卡片两端出去会回到触发元素；`Esc` 或点击外部关闭，焦点在卡片内时回到触发元素。

## API

### Props

| 名称        | 说明                           | 类型                             | 默认值     |
| ----------- | ------------------------------ | -------------------------------- | ---------- |
| `open`      | 是否打开，配合 `v-model:open`  | `boolean`                        | `false`    |
| `title`     | 标题，同时为卡片命名           | `string`                         | —          |
| `content`   | 正文                           | `string`                         | —          |
| `placement` | 首选的一侧                     | `Placement`                      | `'bottom'` |
| `trigger`   | 打开方式                       | `'click' \| 'hover' \| 'manual'` | `'click'`  |
| `disabled`  | 不再打开                       | `boolean`                        | `false`    |
| `width`     | 卡片宽度；数字为 px            | `string \| number`               | —          |
| `showDelay` | `hover` 时多久打开，毫秒       | `number`                         | `100`      |
| `hideDelay` | `hover` 时离开后多久关闭，毫秒 | `number`                         | `150`      |
| `offset`    | 与触发元素的间距，px           | `number`                         | `8`        |
| `teleport`  | 渲染到哪里；`false` 为原地渲染 | `string \| HTMLElement \| false` | `'body'`   |

### Slots

| 名称      | 说明                                   |
| --------- | -------------------------------------- |
| `default` | 触发元素                               |
| `title`   | 标题，替代 `title`                     |
| `content` | 正文，替代 `content`；参数 `{ close }` |

### Exposes

| 名称      | 说明 |
| --------- | ---- |
| `open()`  | 打开 |
| `close()` | 关闭 |

### CSS 变量

| 变量                      | 说明     |
| ------------------------- | -------- |
| `--dou-popover-bg`        | 底色     |
| `--dou-popover-border`    | 描边颜色 |
| `--dou-popover-padding`   | 内边距   |
| `--dou-popover-radius`    | 圆角     |
| `--dou-popover-max-width` | 最大宽度 |
