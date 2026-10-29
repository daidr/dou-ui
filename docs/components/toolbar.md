# Toolbar 工具栏

把一组按钮、切换按钮和选择器排成一行，作为一个整体用键盘操作。

## 基础用法

`DouToolbar` 里可以放任意控件，`DouToolbarSeparator` 分隔不同的组。`size` 会传给里面没有自己设置尺寸的控件。工具栏需要用 `aria-label` 说明它的用途。

<DocDemo src="toolbar/basic" column />

## 纵向

`orientation="vertical"` 让控件上下排列，并改用上下方向键移动。里面的 `DouToggleGroup` 也要设置 `orientation="vertical"`。

<DocDemo src="toolbar/vertical" />

## 键盘与读屏

工具栏是 `role="toolbar"`，带 `aria-orientation`。整个工具栏在 `Tab` 顺序中只占一个位置：

| 按键                      | 行为                                         |
| ------------------------- | -------------------------------------------- |
| `Tab`                     | 进入工具栏，回到上次停留的控件；再按一次离开 |
| `←` `→`（纵向为 `↑` `↓`） | 移到前一个 / 后一个控件，首尾循环            |
| `Home` `End`              | 移到第一个 / 最后一个控件                    |

禁用的控件会被跳过。焦点在输入框里时，方向键和 `Home` / `End` 仍然用来移动光标。

同样的键盘行为也可以用在自己的组件上，见组合式函数 `useRovingFocus`：

```ts
const root = useTemplateRef('root')
useRovingFocus(root, { orientation: 'horizontal' })
```

## API

### Toolbar Props

| 名称          | 说明                                   | 类型                         | 默认值         |
| ------------- | -------------------------------------- | ---------------------------- | -------------- |
| `orientation` | 横向或纵向排列                         | `'horizontal' \| 'vertical'` | `'horizontal'` |
| `size`        | 里面没有自己设置尺寸的控件都用这个尺寸 | `'sm' \| 'md' \| 'lg'`       | —              |
| `loop`        | 方向键是否在首尾之间循环               | `boolean`                    | `true`         |

### Toolbar Slots

| 名称      | 说明                                                       |
| --------- | ---------------------------------------------------------- |
| `default` | 按钮、切换按钮、切换按钮组、选择器与 `DouToolbarSeparator` |
