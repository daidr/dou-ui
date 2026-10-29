# Alert 提示条

在页面中展示需要用户注意的信息，例如操作结果、即将到期的提醒。

## 语气

`tone` 决定含义与图标：`neutral`（默认）、`primary`、`success`、`warning`、`danger`。

<DocDemo src="alert/tone" column />

## 标题、操作与关闭

`title` 是正文上方的粗体标题；`action` 插槽放在行尾；`closable` 显示关闭按钮，按下后提示条隐藏自己并触发 `close`。

<DocDemo src="alert/title-action" column />

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

| 名称      | 说明               |
| --------- | ------------------ |
| `default` | 正文               |
| `title`   | 标题，替代 `title` |
| `icon`    | 替换默认图标       |
| `action`  | 行尾的操作         |

### CSS 变量

| 变量                 | 说明     |
| -------------------- | -------- |
| `--dou-alert-tone`   | 语气色   |
| `--dou-alert-bg`     | 底色     |
| `--dou-alert-border` | 描边颜色 |
| `--dou-alert-radius` | 圆角     |
