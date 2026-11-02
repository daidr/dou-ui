# Dialog 对话框

需要用户集中处理某件事时使用，例如确认操作、填写简短的表单。

浮层的通用行为见 [浮层](../guide/overlays)。

## 基础用法

用 `v-model:open` 控制开关。`footer` 插槽放操作，插槽参数里的 `close` 用来关闭。

<DocDemo src="dialog/basic" />

## 放入表单

给第一个输入框加上 `autofocus`，打开时焦点直接落在它上面；否则落在面板本身，读屏先读出标题。

<DocDemo src="dialog/form" />

## 垂直居中

默认面板离视口顶部 12vh，内容变化时上沿不跳动。`centered` 让它垂直居中。

<DocDemo src="dialog/centered" />

## 阻止关闭

`beforeClose` 在关闭按钮、遮罩与 `Esc` 关闭前调用，返回 `false`（或解析为 `false` 的 Promise）则保持打开。`closeOnMask`、`closeOnEscape` 可以分别关掉这两种关闭方式。

<DocDemo src="dialog/prevent-close" />

## 拖动与全屏

`draggable` 后按住标题栏可以拖动面板，面板不会被拖出视口，每次打开都回到原位。`fullscreenable` 在标题栏右侧加一个切换全屏的按钮，全屏状态用 `v-model:fullscreen` 绑定，也可以直接传 `fullscreen` 让对话框打开时即为全屏。全屏时内容区单独滚动，拖动暂停。

<DocDemo src="dialog/draggable" />

## 函数式调用

一次性的确认、提示和输入，不需要编写模板和维护打开状态：`dialog.confirm()`、`dialog.alert()` 与 `dialog.prompt()` 直接打开一个对话框，返回一个在用户作答后兑现的 Promise。

<DocDemo src="dialog/function-call" />

只传一个字符串时，它就是正文：`dialog.confirm('确定发布吗？')`。

### 异步确认

`onConfirm` 返回 Promise 时，确定按钮显示加载中，取消与 `Esc` 暂时不可用，对话框等它完成才关闭；Promise 被拒绝时对话框保持打开，可以重试。`prompt` 的 `validate` 返回 `false` 或一段文字时同样保持打开，文字显示在输入框下方并通知读屏。

```ts
await dialog.confirm({
  title: '删除项目？',
  tone: 'danger',
  confirmText: '删除',
  onConfirm: () => api.remove(id), // 请求结束才关闭
})
```

### 语气与焦点

`tone` 只在标题旁加一个语气图标；`danger` 还会把确定按钮染成红色，并让焦点先落在“取消”上，误按 `Enter` 也不会执行危险操作。其他情况焦点落在“确定”，`prompt` 落在输入框。

### 使用应用的配置

对话框沿用安装 DouUI 的那个应用的语言包与层级。一个页面里有多个应用时，在组件里用 `useDialog()` 取得绑定当前应用的同一套方法：

```ts
import { useDialog } from 'dou-ui'

const dialog = useDialog()
```

## 键盘与读屏

面板带有 `role="dialog"` 与 `aria-modal="true"`，由标题命名。打开时焦点移入面板，`Tab` 在面板内循环；`Esc` 关闭，焦点回到打开前的元素。打开期间页面不能滚动。

## API

### Props

| 名称             | 说明                                | 类型                                                | 默认值   |
| ---------------- | ----------------------------------- | --------------------------------------------------- | -------- |
| `open`           | 是否打开，配合 `v-model:open`       | `boolean`                                           | `false`  |
| `title`          | 标题，同时为对话框命名              | `string`                                            | —        |
| `width`          | 面板宽度；数字为 px                 | `string \| number`                                  | `480px`  |
| `centered`       | 垂直居中                            | `boolean`                                           | `false`  |
| `closable`       | 显示右上角的关闭按钮                | `boolean`                                           | `true`   |
| `closeOnMask`    | 点击遮罩关闭                        | `boolean`                                           | `true`   |
| `closeOnEscape`  | 按 `Esc` 关闭                       | `boolean`                                           | `true`   |
| `lockScroll`     | 打开期间锁定页面滚动                | `boolean`                                           | `true`   |
| `destroyOnClose` | 关闭后卸载内容                      | `boolean`                                           | `false`  |
| `beforeClose`    | 关闭前调用，返回 `false` 则保持打开 | `() => boolean \| void \| Promise<boolean \| void>` | —        |
| `teleport`       | 渲染到哪里；`false` 为原地渲染      | `string \| HTMLElement \| false`                    | `'body'` |
| `draggable`      | 按住标题栏拖动面板                  | `boolean`                                           | `false`  |
| `fullscreen`     | 全屏，配合 `v-model:fullscreen`     | `boolean`                                           | `false`  |
| `fullscreenable` | 标题栏显示全屏切换按钮              | `boolean`                                           | `false`  |

### Events

| 名称                | 说明         |
| ------------------- | ------------ |
| `update:open`       | 打开状态变化 |
| `update:fullscreen` | 全屏状态变化 |
| `open`              | 开始打开     |
| `opened`            | 打开动画结束 |
| `close`             | 开始关闭     |
| `closed`            | 关闭动画结束 |

### Slots

| 名称      | 说明                       |
| --------- | -------------------------- |
| `default` | 内容                       |
| `title`   | 标题，替代 `title`         |
| `footer`  | 底部操作；参数 `{ close }` |

### Exposes

| 名称      | 说明                       |
| --------- | -------------------------- |
| `close()` | 关闭，会经过 `beforeClose` |

### 函数

| 名称                      | 说明                               | 返回                      |
| ------------------------- | ---------------------------------- | ------------------------- |
| `dialog.confirm(options)` | 确认对话框，“确定” + “取消”        | `Promise<boolean>`        |
| `dialog.alert(options)`   | 提示对话框，只有“确定”             | `Promise<void>`           |
| `dialog.prompt(options)`  | 输入对话框                         | `Promise<string \| null>` |
| `dialog.closeAll()`       | 以“取消”关闭所有函数式打开的对话框 | —                         |
| `useDialog()`             | 绑定当前组件所在应用的同一套方法   | `DialogApi`               |

返回的 Promise 上还有 `close()`，以“取消”关闭这一个对话框。

### 函数的选项

| 名称            | 说明                                                          | 类型                                                            | 默认值   |
| --------------- | ------------------------------------------------------------- | --------------------------------------------------------------- | -------- |
| `title`         | 标题                                                          | `string`                                                        | —        |
| `content`       | 正文；可以是返回 VNode 的函数                                 | `string \| () => VNodeChild`                                    | —        |
| `tone`          | 语气：加语气图标；`danger` 时确定按钮为红色、焦点先落在取消上 | `Tone`                                                          | —        |
| `confirmText`   | 确定按钮文字                                                  | `string`                                                        | 语言包   |
| `cancelText`    | 取消按钮文字（`alert` 没有）                                  | `string`                                                        | 语言包   |
| `width`         | 面板宽度；数字为 px                                           | `string \| number`                                              | `420`    |
| `closeOnMask`   | 点击遮罩视为取消                                              | `boolean`                                                       | `false`  |
| `closeOnEscape` | 按 `Esc` 视为取消                                             | `boolean`                                                       | `true`   |
| `onConfirm`     | 按下确定时调用；返回 Promise 时等它完成，被拒绝则保持打开     | `(value) => unknown`                                            | —        |
| `defaultValue`  | `prompt` 输入框的初始值                                       | `string`                                                        | `''`     |
| `placeholder`   | `prompt` 输入框的占位文字                                     | `string`                                                        | —        |
| `inputType`     | `prompt` 输入框的 `type`                                      | `'text' \| 'password' \| 'email' \| 'url' \| 'tel' \| 'number'` | `'text'` |
| `validate`      | `prompt` 关闭前校验；返回 `false` 或一段文字时保持打开        | `(value) => boolean \| string \| void \| Promise<…>`            | —        |

### CSS 变量

| 变量                   | 说明                 |
| ---------------------- | -------------------- |
| `--dou-dialog-mask`    | 遮罩颜色             |
| `--dou-dialog-bg`      | 面板底色             |
| `--dou-dialog-width`   | 默认宽度             |
| `--dou-dialog-top`     | 不居中时离顶部的距离 |
| `--dou-dialog-radius`  | 圆角                 |
| `--dou-dialog-padding` | 内边距               |
