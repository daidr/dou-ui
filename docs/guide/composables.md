# 组合式函数

DouUI 的组件建立在一组组合式函数上。下面这些已经导出，自己写组件时可以直接用，行为和内置组件一致。

## 一览

| 函数                                              | 用途                                                   | 说明                                                               |
| ------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------ |
| `useFloating`                                     | 让一个元素贴着另一个元素定位，空间不够时翻到另一侧     | [下文](#usefloating)                                               |
| `useLayer`                                        | 加入浮层栈，`Esc` 只关最上层，识别嵌套浮层的“点击外部” | [下文](#uselayer)                                                  |
| `useFocusTrap`                                    | 把焦点限制在一个容器里，释放后焦点回到原处             | [下文](#usefocustrap)                                              |
| `useScrollLock`                                   | 锁定页面滚动，多处同时锁定时按次数计算                 | [下文](#usescrolllock)                                             |
| `useHotkey`                                       | 绑定快捷键，支持组合键与按键序列                       | [下文](#usehotkey)                                                 |
| `useZIndex`                                       | 取一个比之前所有浮层都高的层级                         | [ConfigProvider](../components/config-provider#在自己的组件中读取) |
| `useGlobalConfig` / `useLocale`                   | 读取全局配置与语言包                                   | [ConfigProvider](../components/config-provider#在自己的组件中读取) |
| `useFormItem` / `useFormSize` / `useFormDisabled` | 让自己的控件接入表单：校验、尺寸与禁用                 | [Form](../components/form)                                         |
| `useColorMode`                                    | 读取与切换亮 / 暗 / 跟随系统                           | [ColorMode](../components/color-mode)                              |
| `useCountdown`                                    | 倒计时的剩余时间                                       | [Countdown](../components/countdown)                               |
| `useNow`                                          | 当前时间，定时更新                                     | [RelativeTime](../components/relative-time#usenow)                 |
| `useSortable`                                     | 给任意列表加上拖拽与键盘排序                           | [Sortable](../components/sortable)                                 |
| `useDialog`                                       | 在组件里调用 `confirm` / `alert` / `prompt`            | [Dialog](../components/dialog)                                     |
| `useReducedMotion` / `getMotionDuration`          | 让脚本驱动的动画遵循动效设置                           | [动效](./motion#在脚本中使用)                                      |
| `useRovingFocus`                                  | 一组控件只占一个 `Tab` 位置，用方向键在其中移动        | [Toolbar](../components/toolbar#键盘与读屏)                        |
| `useBreakpoints`                                  | 读取视口当前达到的断点                                 | [断点](./breakpoints#在脚本中使用)                                 |
| `useClipboard`                                    | 复制文本，并在复制成功后的一段时间内给出 `copied`      | [下文](#useclipboard)                                              |

这些函数都要在 `setup` 中调用，组件卸载时自动清理监听。

## 自己写一个浮层

组合前四个函数，可以实现一个与内置浮层行为一致的面板：

<DocDemo src="composables/floating" />

## useFloating

```ts
const { style, placement, update } = useFloating(reference, floating, options)
```

打开期间，`floating` 以 `position: fixed` 贴在 `reference` 旁边，页面滚动、窗口缩放以及两个元素尺寸变化时重新计算。`reference` 是返回元素的函数，也可以返回任何带 `getBoundingClientRect()` 的对象，比如指针按下的位置。

| 选项        | 说明                                 | 类型                          | 默认值  |
| ----------- | ------------------------------------ | ----------------------------- | ------- |
| `open`      | 是否在定位                           | `MaybeRefOrGetter<boolean>`   | —       |
| `placement` | 首选位置，如 `bottom-start`          | `MaybeRefOrGetter<Placement>` | —       |
| `offset`    | 与参照元素的间距                     | `MaybeRefOrGetter<number>`    | `8`     |
| `sameWidth` | 最小宽度与参照元素一致，适合下拉列表 | `MaybeRefOrGetter<boolean>`   | `false` |

返回的 `style` 绑定到浮层上；`placement` 是翻转后的实际位置，可以用来调整箭头或动画方向；`update()` 手动重新计算。

浮层的可用高度写在 `--dou-floating-available` 上，内容很长时可以用它限制 `max-height`。只需要计算、不需要监听时，用纯函数 `computePosition(reference, size, placement, options)`。

## useLayer

```ts
const layer = useLayer({ open, elements, onEscape, onOutside })
```

打开期间把浮层压入全局的浮层栈：

- `Esc` 只交给最上层的浮层，即使它选择不关闭，也不会继续传给下面的浮层。
- 在浮层里打开的浮层（比如对话框里的下拉菜单）是它的子浮层。点击子浮层不算点击父浮层的外部。

`elements` 返回属于这个浮层的元素，通常是面板和打开它的按钮。返回的 `layer.contains(node)` 判断一个节点是否在浮层或其子浮层中；`isTopLayer(layer)` 判断它是否在最上层。

## useFocusTrap

```ts
useFocusTrap(container, { active, contains, initialFocus })
```

`active` 为真时，焦点限制在 `container` 中：`Tab` 在首尾之间循环，焦点移出容器时会被移回。释放后焦点回到打开前所在的元素。

- `initialFocus`：打开后先聚焦的元素，默认取带 `autofocus` 的元素，再取第一个可聚焦元素。
- `contains`：判断节点是否算在里面。传 `layer.contains` 可以让子浮层里的元素也能获得焦点。

`getTabbable(container)` 返回容器中按 `Tab` 顺序排列的可聚焦元素。

## useScrollLock

```ts
useScrollLock(() => open.value)
```

为真时锁定页面滚动，并补上滚动条的宽度，页面不会左右跳动。多个组件同时锁定时按次数计算，全部释放后才恢复。

## useHotkey

```ts
useHotkey(hotkeys, handler, { target, enabled, allowInInput, preventDefault, sequenceTimeout })
```

按下 `hotkeys` 中的任意一个时调用 `handler(event, hotkey)`。快捷键的写法：

- 用 `+` 连接组合键，如 `mod+s`、`shift+/`，不区分大小写。`mod` 在 macOS 与 iOS 上是 <DouKbd size="sm">⌘</DouKbd>，在其他系统上是 <DouKbd size="sm">Ctrl</DouKbd>。
- 用空格分隔按键序列，如 `g i` 表示先按 G 再按 I，两步之间默认最多间隔 1 秒（`sequenceTimeout`）。
- 可以写 `esc`、`space`、`up` / `down` / `left` / `right` 等简称。

默认监听整个页面，焦点在输入框、文本域、下拉框或可编辑区域时不触发，`allowInInput` 可以取消这个限制。已经被其他处理函数调用过 `preventDefault` 的按键不会触发，例如编辑器里自己处理的快捷键。匹配后默认调用 `preventDefault`。组件卸载时自动解绑，返回的函数可以提前解绑。

<DocDemo src="composables/hotkey" />

`formatHotkey(hotkey)` 按当前平台给出每个按键的名称，例如 `mod+k` 在 macOS 上是 `[['⌘', 'K']]`；直接显示时用 [Kbd](../components/kbd#快捷键) 的 `keys` 属性即可。`matchesHotkey(event, hotkey)` 判断一次按键是否匹配某个组合键。

## useClipboard

```ts
const { copy, copied } = useClipboard({ duration: 2000 })
```

`copy(text)` 把文本写入剪贴板，优先使用异步剪贴板接口，接口不可用或被拒绝时改用隐藏的文本框复制，两种方式都失败时返回的 Promise 会被拒绝。复制成功后，`copied` 在 `duration` 毫秒内为 `true`，可以用来切换图标或文字。[CopyButton](../components/copy-button) 也是基于它实现的。

<DocDemo src="composables/clipboard" />
