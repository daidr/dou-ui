# Toast 轻提示

操作后显示的简短反馈，几秒后自动消失。

## 基础用法

<DocDemo src="toast/basic" />

- 默认 3 秒后消失，带操作时 6 秒；`duration: 0` 则一直保留，直到关闭。
- 指针停在提示上或焦点在其中时，倒计时暂停，离开后按剩余时间继续。

## 带操作

`action` 放一个按钮，例如撤销。按下后执行 `onClick` 并关闭提示。

<DocDemo src="toast/action" />

## 位置

`placement` 可选 `top`（默认）、`top-left`、`top-right`、`bottom`、`bottom-left`、`bottom-right`。同一位置的提示排成一列，最新的一条离屏幕边缘最近；同一位置最多显示 5 条，更早的先关闭。

<DocDemo src="toast/placement" />

## 关闭

每次调用返回 `{ id, close }`。`toast.close(id)` 关闭指定的一条，`toast.closeAll()` 关闭全部。`onClose` 在提示消失后调用，无论它是怎么关闭的。

```ts
const { close } = toast('正在上传…', { duration: 0 })
await upload()
close()
```

## 语言与层级

`toast()` 第一次调用时会自动挂载一个容器。用 `app.use(DouUI)` 注册时，容器沿用应用的全局配置（语言包、`zIndex`）。

如果要让提示使用某个 [ConfigProvider](./config-provider) 的配置，把 `DouToastViewport` 放进去即可；最后挂载的容器负责显示提示。

```vue
<DouConfigProvider :locale="en">
  <App />
  <DouToastViewport />
</DouConfigProvider>
```

## 键盘与读屏

每个位置是一个带标签（“通知”）的区域；每条提示带 `role="status"`，警告与错误为 `role="alert"`，读屏会读出新出现的提示。关闭按钮带有语言包里的“关闭”标签。

## API

### toast(message, options?) / toast(options)

| 选项        | 说明                           | 类型                                     | 默认值                  |
| ----------- | ------------------------------ | ---------------------------------------- | ----------------------- |
| `message`   | 正文                           | `string`                                 | —                       |
| `title`     | 正文上方的粗体标题             | `string`                                 | —                       |
| `tone`      | 语气                           | `Tone`                                   | `'neutral'`             |
| `duration`  | 显示多久，毫秒；`0` 为一直显示 | `number`                                 | `3000`（带操作 `6000`） |
| `closable`  | 显示关闭按钮                   | `boolean`                                | `false`                 |
| `placement` | 位置                           | `ToastPlacement`                         | `'top'`                 |
| `action`    | 一个按钮                       | `{ label: string; onClick: () => void }` | —                       |
| `onClose`   | 消失后调用                     | `() => void`                             | —                       |

### 其他方法

| 名称                 | 说明              |
| -------------------- | ----------------- |
| `toast.success(...)` | `tone: 'success'` |
| `toast.warning(...)` | `tone: 'warning'` |
| `toast.danger(...)`  | `tone: 'danger'`  |
| `toast.close(id)`    | 关闭一条          |
| `toast.closeAll()`   | 关闭全部          |

### ToastViewport Props

| 名称  | 说明                 | 类型     | 默认值 |
| ----- | -------------------- | -------- | ------ |
| `max` | 同一位置最多显示几条 | `number` | `5`    |
