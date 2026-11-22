# Popover 气泡卡片

点击元素后弹出的卡片，可以放置标题、说明和操作。

浮层的通用行为见 [浮层](../guide/overlays)。

## 基础用法

<DocDemo src="popover/basic" />

## 放入操作

`content` 插槽替换卡片内容，插槽参数里的 `close` 用来关闭卡片；焦点在卡片内时，关闭后回到触发元素。也可以用 `v-model:open` 自己控制。

<DocDemo src="popover/action" />

## 宽度

默认按内容的自然宽度显示，内容更新后重新计算宽度；最宽为 360px，并在视口两侧各留出 8px。通过 `width` 指定宽度，数字按 px 处理，也可以传入 `20rem` 等 CSS 长度。`--dou-popover-max-width` 可以调整最大宽度，指定的 `width` 仍受这个上限和视口宽度约束。

## 高度与滚动

卡片默认按当前视口的可用高度（`--dou-floating-available`）限制最大高度，标题固定在顶部，超出部分在内容区内纵向滚动，不再溢出视口。通过 `maxHeight` 或 `--dou-popover-max-height` 可以设定更矮的上限（数字按 px 处理，也可以传入 `20rem` 等 CSS 长度），最终高度仍不会超过视口可用空间。

<DocDemo src="popover/scroll" />

## 触发方式

`trigger` 为 `hover` 时指向即打开，指针可以从触发元素移到卡片上；触屏和触控笔没有悬停，默认改为轻点打开、再点一下或点别处收起。如果触发元素本身有点击主动作（例如列表项切换或导航链接），可以把 `openOnTap` 设为 `false`，关闭触屏轻点弹出，仅保留桌面端悬停预览与键盘操作。键盘上按 `Enter` 或空格也能打开（触发元素是链接时，`Enter` 照常打开链接）；`manual` 完全交给 `v-model:open`。

<DocDemo src="popover/trigger" />

## 键盘与读屏

卡片带有 `role="dialog"`，有标题时由标题命名。触发元素带 `aria-haspopup="dialog"`、`aria-expanded` 与 `aria-controls`。卡片是非模态的：焦点留在触发元素上，`Tab` 从触发元素进入卡片；卡片里没有可聚焦的内容时，`Tab` 离开触发元素会关闭卡片；从触发元素 `Shift+Tab` 往前离开也会关闭卡片。在卡片第一项按 `Shift+Tab` 回到触发元素；从最后一项 `Tab` 出去时卡片关闭，焦点继续往后。`Esc` 或点击外部关闭，焦点在卡片内时回到触发元素。

## API

### Props

| 名称        | 说明                                                 | 类型                             | 默认值     |
| ----------- | ---------------------------------------------------- | -------------------------------- | ---------- |
| `open`      | 是否打开，配合 `v-model:open`                        | `boolean`                        | `false`    |
| `title`     | 标题，同时为卡片命名                                 | `string`                         | —          |
| `content`   | 正文                                                 | `string`                         | —          |
| `placement` | 首选的一侧                                           | `Placement`                      | `'bottom'` |
| `trigger`   | 打开方式                                             | `'click' \| 'hover' \| 'manual'` | `'click'`  |
| `disabled`  | 不再打开                                             | `boolean`                        | `false`    |
| `width`     | 卡片宽度；数字为 px                                  | `string \| number`               | —          |
| `maxHeight` | 卡片最大高度；数字为 px，仍受视口可用空间约束        | `string \| number`               | —          |
| `showDelay` | `hover` 时多久打开，毫秒                             | `number`                         | `100`      |
| `hideDelay` | `hover` 时离开后多久关闭，毫秒                       | `number`                         | `150`      |
| `offset`    | 与触发元素的间距，px                                 | `number`                         | `8`        |
| `openOnTap` | `hover` 模式下触屏或触控笔轻点触发元素时是否打开卡片 | `boolean`                        | `true`     |
| `teleport`  | 渲染到哪里；`false` 为原地渲染                       | `string \| HTMLElement \| false` | `'body'`   |

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

| 变量                       | 说明     |
| -------------------------- | -------- |
| `--dou-popover-bg`         | 底色     |
| `--dou-popover-border`     | 描边颜色 |
| `--dou-popover-padding`    | 内边距   |
| `--dou-popover-radius`     | 圆角     |
| `--dou-popover-max-width`  | 最大宽度 |
| `--dou-popover-max-height` | 最大高度 |
