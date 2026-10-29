# CopyButton 复制按钮

将指定文字复制到剪贴板的按钮。

## 基础用法

<DocDemo src="copy-button/basic" />

`variant` 可选 `ghost`（默认，放在代码块之类的容器里）和 `outline`。`show-label` 把“复制 / 已复制”写出来；否则文字只给读屏和悬停提示。

## 放在代码块里

<DocDemo src="copy-button/code-block" style="display: block" />

`text` 也可以是函数（可以返回 Promise），在按下时才读取，例如复制代码块当前显示的内容：

```vue
<DouCopyButton :text="() => codeRef.textContent ?? ''" size="sm" />
```

浏览器不支持异步剪贴板接口（或者页面不是 HTTPS）时，会退回到旧的复制方式；两种都失败时触发 `error`。

## 读屏

按钮的名称是“复制”，成功后变成“已复制”，同时通过 `role="status"` 播报一次。

## API

### CopyButton Props

| 名称          | 说明                         | 类型                                        | 默认值    |
| ------------- | ---------------------------- | ------------------------------------------- | --------- |
| `text`        | 要复制的文字，或返回它的函数 | `string \| () => string \| Promise<string>` | `''`      |
| `label`       | 按钮的名称                   | `string`                                    | 语言包    |
| `copiedLabel` | 复制成功后的名称             | `string`                                    | 语言包    |
| `showLabel`   | 显示文字                     | `boolean`                                   | `false`   |
| `size`        | 尺寸                         | `'sm' \| 'md'`                              | `'md'`    |
| `variant`     | 外观                         | `'ghost' \| 'outline'`                      | `'ghost'` |
| `duration`    | “已复制”状态持续多久（ms）   | `number`                                    | `2000`    |
| `disabled`    | 禁用                         | `boolean`                                   | `false`   |

### CopyButton Events

| 名称    | 说明     | 参数               |
| ------- | -------- | ------------------ |
| `copy`  | 复制成功 | `(text: string)`   |
| `error` | 复制失败 | `(error: unknown)` |
