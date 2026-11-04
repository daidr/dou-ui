# Alert 提示条

在页面中展示需要用户注意的信息，例如操作结果、即将到期的提醒。

## 语气

`tone` 决定含义与图标：`neutral`（默认）、`primary`、`success`、`warning`、`danger`。

<DocDemo src="alert/tone" column />

## 标题、操作与关闭

`title` 是正文上方的粗体标题；`action` 插槽放在行尾；`closable` 显示关闭按钮，按下后提示条隐藏自己并触发 `close`。

<DocDemo src="alert/title-action" column />

## 多个操作

`action` 插槽可以放多个按钮。正文旁边放不下时，操作区整体换到正文下方，与正文左对齐；单独一行也放不下时，按钮之间再换行。依据是提示条自身的宽度而不是视口，放进侧栏或卡片里同样适用。正文至少保留的宽度由 `--dou-alert-text-min` 决定（默认 `16em`）。拖动示例右下角调整宽度试试。

<DocDemo src="alert/action-wrap" />

## 图标

`icon` 插槽替换默认图标，`:show-icon="false"` 去掉图标。

## 读屏

`warning` 与 `danger` 带 `role="alert"`，其余为 `role="status"`。动态插入页面时，前者会立即被读出，后者等读屏空闲时读出。

## API

### Props

| 名称       | 说明           | 类型      | 默认值      |
| ---------- | -------------- | --------- | ----------- |
| `tone`     | 含义，决定图标 | `Tone`    | `'neutral'` |
| `title`    | 标题           | `string`  | —           |
| `closable` | 显示关闭按钮   | `boolean` | `false`     |
| `showIcon` | 显示图标       | `boolean` | `true`      |

### Events

| 名称    | 说明         | 参数                  |
| ------- | ------------ | --------------------- |
| `close` | 按下关闭按钮 | `(event: MouseEvent)` |

### Slots

| 名称      | 说明                             |
| --------- | -------------------------------- |
| `default` | 正文                             |
| `title`   | 标题，替代 `title`               |
| `icon`    | 替换默认图标                     |
| `action`  | 行尾的操作，放不下时换到正文下方 |

### CSS 变量

| 变量                   | 说明                                   |
| ---------------------- | -------------------------------------- |
| `--dou-alert-tone`     | 语气色                                 |
| `--dou-alert-bg`       | 底色                                   |
| `--dou-alert-border`   | 描边颜色                               |
| `--dou-alert-radius`   | 圆角                                   |
| `--dou-alert-text-min` | 操作区在正文旁边时，正文至少保留的宽度 |
