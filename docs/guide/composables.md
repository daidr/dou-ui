# 组合式函数

DouUI 的组件建立在一组组合式函数上。下面这些已经导出，自己写组件时可以直接用，行为和内置组件一致。

## 一览

| 函数                                              | 用途                                                   | 说明                                                               |
| ------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------ |
| `useFloating`                                     | 让一个元素贴着另一个元素定位，空间不够时翻到另一侧     | [下文](#usefloating)                                               |
| `useLayer`                                        | 加入浮层栈，`Esc` 只关最上层，识别嵌套浮层的"点击外部" | [下文](#uselayer)                                                  |
| `useFocusTrap`                                    | 把焦点限制在一个容器里，释放后焦点回到原处             | [下文](#usefocustrap)                                              |
| `useScrollLock`                                   | 锁定页面滚动，多处同时锁定时按次数计算                 | [下文](#usescrolllock)                                             |
| `useZIndex`                                       | 取一个比之前所有浮层都高的层级                         | [ConfigProvider](../components/config-provider#在自己的组件中读取) |
| `useGlobalConfig` / `useLocale`                   | 读取全局配置与语言包                                   | [ConfigProvider](../components/config-provider#在自己的组件中读取) |
| `useFormItem` / `useFormSize` / `useFormDisabled` | 让自己的控件接入表单：校验、尺寸与禁用                 | [Form](../components/form)                                         |
| `useColorMode`                                    | 读取与切换亮 / 暗 / 跟随系统                           | [ColorMode](../components/color-mode)                              |
| `useCountdown`                                    | 倒计时的剩余时间                                       | [Countdown](../components/countdown)                               |
| `useSortable`                                     | 给任意列表加上拖拽与键盘排序                           | [Sortable](../components/sortable)                                 |
| `useDialog`                                       | 在组件里调用 `confirm` / `alert` / `prompt`            | [Dialog](../components/dialog)                                     |
| `useReducedMotion` / `getMotionDuration`          | 让脚本驱动的动画遵循动效设置                           | [动效](./motion#在脚本中使用)                                      |

这些函数都要在 `setup` 中调用，组件卸载时自动清理监听。

## 自己写一个浮层

把前四个函数组合起来，就是一个和内置浮层行为一致的面板：

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

`active` 为真时，焦点限制在 `container` 中：`Tab` 在首尾之间循环，跑出去的焦点会被拉回来。释放后焦点回到打开前所在的元素。

- `initialFocus`：打开后先聚焦的元素，默认取带 `autofocus` 的元素，再取第一个可聚焦元素。
- `contains`：判断节点是否算在里面。传 `layer.contains` 可以让子浮层里的元素也能获得焦点。

`getTabbable(container)` 返回容器中按 `Tab` 顺序排列的可聚焦元素。

## useScrollLock

```ts
useScrollLock(() => open.value)
```

为真时锁定页面滚动，并补上滚动条的宽度，页面不会左右跳动。多个组件同时锁定时按次数计算，全部释放后才恢复。
