# Menubar 菜单栏

一排菜单按钮，每个按钮打开一个下拉菜单，常放在应用或编辑器的顶部。

## 基础用法

`DouMenubar` 里放若干 `DouMenubarMenu`，`label` 是按钮文字，菜单内容与 [Dropdown](./dropdown) 相同：`DouDropdownItem`、`DouDropdownSub` 子菜单，以及下面介绍的勾选项和单选项。

<DocDemo src="menubar/basic" />

点击按钮打开菜单；打开一个菜单后，鼠标移到旁边的按钮会直接切换过去。选中菜单项后菜单关闭，`DouMenubar` 触发 `select`，参数为菜单项的 `value` 和所在菜单的 `name`（默认为 `label`）。

## 勾选项、单选项与快捷键

这三项也可以用在普通的 Dropdown 和 ContextMenu 中：

- 给 `DouDropdownItem` 绑定 `v-model:checked`，它就成为勾选项，选中时前面显示对勾。
- 用 `DouDropdownRadioGroup` 包住一组带 `value` 的菜单项并绑定 `v-model`，选中的那一项前面显示圆点。
- `shortcut` 在菜单项右侧显示快捷键，写法与 [useHotkey](../guide/composables) 相同，`mod` 在苹果设备上显示为 `⌘`，其他平台显示为 `Ctrl`。它只负责显示，按键需要自己用 `useHotkey` 绑定。

## API

### Menubar Props

| 名称   | 说明                                   | 类型           | 默认值 |
| ------ | -------------------------------------- | -------------- | ------ |
| `size` | 按钮尺寸                               | `'sm' \| 'md'` | `'md'` |
| `loop` | 方向键在最后一个按钮之后是否回到第一个 | `boolean`      | `true` |

### Menubar Events

| 名称     | 说明             | 参数                                                   |
| -------- | ---------------- | ------------------------------------------------------ |
| `select` | 选中了某个菜单项 | `(value: string \| number \| undefined, menu: string)` |

### MenubarMenu Props

| 名称       | 说明                                 | 类型      | 默认值  |
| ---------- | ------------------------------------ | --------- | ------- |
| `label`    | 按钮文字，`label` 插槽可以替换       | `string`  | —       |
| `name`     | 在 `select` 事件中表示这个菜单       | `string`  | `label` |
| `disabled` | 禁用，按钮不可点击，方向键也会跳过它 | `boolean` | `false` |

### MenubarMenu Slots

| 名称      | 说明                                                                 |
| --------- | -------------------------------------------------------------------- |
| `default` | 菜单项：`DouDropdownItem`、`DouDropdownSub`、`DouDropdownRadioGroup` |
| `label`   | 按钮内容                                                             |

### 新增的菜单项属性

| 组件                    | 名称         | 说明                             | 类型               |
| ----------------------- | ------------ | -------------------------------- | ------------------ |
| `DouDropdownItem`       | `checked`    | 勾选状态，配合 `v-model:checked` | `boolean`          |
| `DouDropdownItem`       | `shortcut`   | 显示的快捷键，如 `'mod+s'`       | `string`           |
| `DouDropdownRadioGroup` | `modelValue` | 选中项的 `value`，配合 `v-model` | `string \| number` |

### 键盘与读屏

- 根元素是 `role="menubar"`，按钮是 `role="menuitem"`。整个菜单栏在 `Tab` 顺序里只占一个位置，`←` `→` `Home` `End` 在按钮之间移动。
- 在按钮上按 `Enter`、`Space` 或 `↓` 打开菜单并聚焦第一项，`↑` 聚焦最后一项。
- 菜单打开时，`←` `→` 切换到相邻的菜单并聚焦它的第一项；在子菜单里 `←` 先回到上一级。`Esc` 关闭菜单，焦点回到按钮。
- 勾选项是 `role="menuitemcheckbox"`，单选项是 `role="menuitemradio"`，都带 `aria-checked`；有 `shortcut` 的菜单项带 `aria-keyshortcuts`。
