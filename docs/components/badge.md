# Badge 徽标

显示在按钮、图标右上角的数字或圆点，用于提示未读消息或待处理事项。

## 计数

<DocDemo src="badge/count" />

超过 `max`（默认 99）的数字显示为 `99+`。值为 `0` 时默认隐藏，`showZero` 让它显示出来。

## 圆点

`dot` 只表示“有新东西”，不关心数量。

<DocDemo src="badge/dot" />

## 独立使用

没有默认插槽时，徽标作为一个行内元素出现，适合放在菜单项、标签页的文字后面。

<DocDemo src="badge/standalone" />

## 读屏

徽标里的数字会被原样读出。只读一个“5”往往语义不足，用 `label` 给出完整说法，如“5 条未读消息”。圆点没有 `label` 时对读屏隐藏。

## API

### Props

| 名称        | 说明                 | 类型                                                           | 默认值      |
| ----------- | -------------------- | -------------------------------------------------------------- | ----------- |
| `value`     | 数字或简短文字       | `number \| string`                                             | —           |
| `max`       | 超过后显示为 `max+`  | `number`                                                       | `99`        |
| `dot`       | 显示为圆点           | `boolean`                                                      | `false`     |
| `tone`      | 语义                 | `'neutral' \| 'primary' \| 'success' \| 'warning' \| 'danger'` | `'neutral'` |
| `showZero`  | 值为 `0` 时仍显示    | `boolean`                                                      | `false`     |
| `hidden`    | 隐藏徽标，保留内容   | `boolean`                                                      | `false`     |
| `placement` | 钉在哪个角           | `'top-end' \| 'bottom-end'`                                    | `'top-end'` |
| `label`     | 读屏文字，替代裸数字 | `string`                                                       | —           |

### Slots

| 名称      | 说明                               |
| --------- | ---------------------------------- |
| `default` | 徽标所在的内容；不传时徽标独立显示 |
| `content` | 替换数字                           |
