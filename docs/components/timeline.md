# Timeline 时间线

按时间顺序展示一组事件。

## 基础用法

<DocDemo src="timeline/basic" column />

## 语气与自定义圆点

`tone` 只给圆点上色。`dot` 插槽可以换成图标，图标取同样的语气色。

<DocDemo src="timeline/tone-dot" column />

## 当前步骤

`active` 标出流程走到的这一步：实心圆点，外面一圈同色的涟漪缓缓散开并淡出，和 [StatusDot 状态点](/components/status-dot) 的涟漪是同一个实现。`pending` 是还没轮到，`active` 是正在这一步。开启「减弱动态效果」时，涟漪换成一圈静止的光晕。

<DocDemo src="timeline/current" column />

## 倒序

`reverse` 把最新的事件显示在最上面，事件仍按时间先后书写。

<DocDemo src="timeline/reverse" column />

## 读屏

时间线是一个有序列表 `<ol>`，左侧的圆点与连线只是装饰（`aria-hidden`），含义写在时间、标题和内容里。`active` 的事件带 `aria-current="step"`。

## API

### Timeline Props

| 名称      | 说明                   | 类型      | 默认值  |
| --------- | ---------------------- | --------- | ------- |
| `reverse` | 最新的事件显示在最上面 | `boolean` | `false` |

### TimelineItem Props

| 名称      | 说明                                        | 类型                                                           | 默认值      |
| --------- | ------------------------------------------- | -------------------------------------------------------------- | ----------- |
| `time`    | 时间                                        | `string`                                                       | —           |
| `title`   | 标题，详情放在默认插槽                      | `string`                                                       | —           |
| `tone`    | 圆点的语气色                                | `'neutral' \| 'primary' \| 'success' \| 'warning' \| 'danger'` | `'neutral'` |
| `pending` | 进行中：空心圆点，通向它的线为虚线          | `boolean`                                                      | `false`     |
| `active`  | 当前步骤：实心圆点外加涟漪，替代 `dot` 插槽 | `boolean`                                                      | `false`     |

### TimelineItem Slots

| 名称      | 说明     |
| --------- | -------- |
| `default` | 详情     |
| `dot`     | 替换圆点 |
| `time`    | 替换时间 |
| `title`   | 替换标题 |

### CSS 变量

| 变量                      | 说明           |
| ------------------------- | -------------- |
| `--dou-timeline-dot-size` | 圆点直径       |
| `--dou-timeline-spacing`  | 事件之间的距离 |
| `--dou-timeline-line`     | 连线颜色       |
