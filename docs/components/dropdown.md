# Dropdown 下拉菜单

点击按钮后弹出一组操作。

浮层的通用行为见 [浮层](../guide/overlays)。

## 基础用法

默认插槽是触发元素，`menu` 插槽放 `DouDropdownItem`。选中一项时触发 `select`，参数是该项的 `value`。

<DocDemo src="dropdown/basic" />

- `disabled` 的项不可选，键盘导航会跳过它。
- `tone="danger"` 用于破坏性操作。
- `divided` 在该项上方画一条分隔线。

## 图标与快捷键

`prefix` 插槽放在文字前（通常是图标），`suffix` 放在行尾。快捷键用 `shortcut` 属性，写法与 `useHotkey` 相同，按平台显示（`mod+c` 在苹果设备上是 `⌘C`，其他平台是 `Ctrl+C`）。

<DocDemo src="dropdown/icon-shortcut" />

## 带说明的菜单项

只看文字不容易分清几项的区别时，用 `description` 在文字下面加一行说明，比如几种可见范围、会删掉什么数据。说明比文字小一号、颜色更浅，可以换行，不会单独把菜单撑宽；文字仍是一行，菜单最宽不超过屏幕，放不下时以省略号结尾。图标、勾选标记和快捷键都和文字对齐。说明需要加粗、链接这类格式时用 `description` 插槽。用数据写菜单项时同样可以写 `description`。

<DocDemo src="dropdown/description" column />

说明只是补充，文字本身要能说清这一项做什么。说明写一句就够，太长的说明会让菜单难以扫读，一个菜单里也不必每一项都写。读屏软件把文字读作这一项的名称，再读说明；按字母跳转时也只匹配文字。

## 触发方式与宽度

`trigger="hover"` 指向即打开（触屏和触控笔上改为轻点打开、再点一下收起），`trigger="manual"` 只由 `v-model:open` 打开。不论哪种方式，点击菜单以外的地方或按 `Esc` 都会关闭菜单。`sameWidth` 让菜单至少与触发元素一样宽。选中后默认关闭，`:hide-on-select="false"` 可以保持打开。

<DocDemo src="dropdown/trigger-width" />

## 子菜单

`DouDropdownSub` 是一个带箭头的项，鼠标悬停片刻或按 `→` 时在旁边展开子菜单，里面放 `DouDropdownItem`，也可以继续嵌套 `DouDropdownSub`。子菜单里选中的项同样触发外层的 `select`，并关闭整个菜单。文字用 `title` 或 `title` 插槽，图标放 `prefix` 插槽。

<DocDemo src="dropdown/submenu" />

子菜单默认在右侧展开（`placement="right-start"`），空间不够时翻到左侧。[ContextMenu 右键菜单](./context-menu) 里同样可以使用。

## 勾选项与单选项

`v-model:checked` 让菜单项成为勾选项，`DouDropdownRadioGroup` 让一组菜单项成为单选项，示例见 [Menubar](./menubar#勾选项、单选项与快捷键)。

几项可以同时打开、各自开关时用勾选项，标记是勾；一组里只能选中一项时用单选项，标记是圆点。比如“冻结首行”和“冻结首列”可以同时生效，用勾选项；数字格式只能是其中一种，用单选项。标记显示在每行开头的同一列里，同一个菜单里不带标记的普通项会和它们的文字对齐。

## 分组

几项属于同一类时，用 `DouDropdownGroup` 包住它们，`label` 是这一组的小标题，比如“排序方式”“显示”。`DouDropdownRadioGroup` 本身也是一组，同样可以写 `label`。小标题比菜单项小一号、颜色更浅，不能选中，键盘移动和按字母跳转都会跳过它；读屏软件把它读作这一组的名称。小标题需要图标这类内容时用 `label` 插槽。

<DocDemo src="dropdown/group" />

组与组之间要分开时，在后一组上写 `divided`，分隔线画在小标题上方。只有一组时不必写小标题，触发按钮已经说明了菜单是什么。`DouDropdownSub` 的子菜单里同样可以分组。

## 分裂按钮

`DouDropdownButton` 把主操作和更多操作并排放在一起：左半边是普通按钮，点击触发 `click`；右半边是箭头，展开 `menu` 插槽里的菜单，选中时触发 `select`。`variant`、`tone`、`size` 同时作用于两半，`loading` 只作用于左半边。

<DocDemo src="dropdown/split-button" />

## 用数据写菜单项

菜单项在代码里生成时，可以不写 `menu` 插槽，直接传 `items`，写法和 [ContextMenu 的菜单项](./context-menu#用数据写菜单项) 相同：选中时调用这一项的 `run`，`select` 同样会触发。`{ type: 'group', label, children }` 是一组带小标题的菜单项。每一项都写了 `checked` 时，菜单是单选；一组里每一项都写了 `checked` 时，这一组是单选。有分组时，组外写了 `checked` 的项都是勾选项，要单选就把这几项放进一组；没有子项的组不显示。同时写了 `menu` 插槽时显示插槽，`items` 不起作用。

```vue
<script setup lang="ts">
import type { ContextMenuEntry } from 'dou-ui'

const items: ContextMenuEntry[] = [
  { key: 'rename', label: '重命名', run: rename },
  {
    type: 'group',
    label: '移动到',
    divided: true,
    children: [
      { key: 'top', label: '顶部', run: toTop },
      { key: 'bottom', label: '底部', run: toBottom },
    ],
  },
  { key: 'delete', label: '删除', tone: 'danger', divided: true, run: remove },
]
</script>

<template>
  <DouDropdown :items="items">
    <DouButton>更多</DouButton>
  </DouDropdown>
</template>
```

子菜单仍然要写在 `menu` 插槽里。

## 键盘与读屏

菜单带有 `role="menu"`，每一项是 `role="menuitem"`。分组是 `role="group"`，以小标题为名称（`aria-labelledby`）。触发元素带 `aria-haspopup="menu"`、`aria-expanded` 与 `aria-controls`。

| 按键              | 作用                                                                |
| ----------------- | ------------------------------------------------------------------- |
| `Enter` / `Space` | 在触发元素上：打开并聚焦第一项；在项上：选中                        |
| `↓` / `↑`         | 在触发元素上：打开并聚焦第一项 / 最后一项；在菜单里：移动，首尾循环 |
| `Home` / `End`    | 第一项 / 最后一项                                                   |
| 字母              | 跳到下一个以它开头的项                                              |
| `→`               | 在子菜单项上：展开子菜单并聚焦第一项                                |
| `←`               | 在子菜单里：收起子菜单，焦点回到它的项                              |
| `Esc`             | 关闭，焦点回到触发元素（在子菜单里只收起子菜单）                    |
| `Tab`             | 关闭，焦点从触发元素继续向后                                        |

## API

### Dropdown Props

| 名称           | 说明                                                          | 类型                             | 默认值           |
| -------------- | ------------------------------------------------------------- | -------------------------------- | ---------------- |
| `open`         | 是否打开，配合 `v-model:open`                                 | `boolean`                        | `false`          |
| `placement`    | 首选的一侧                                                    | `Placement`                      | `'bottom-start'` |
| `trigger`      | 打开方式                                                      | `'click' \| 'hover' \| 'manual'` | `'click'`        |
| `disabled`     | 不再打开                                                      | `boolean`                        | `false`          |
| `hideOnSelect` | 选中后关闭                                                    | `boolean`                        | `true`           |
| `sameWidth`    | 至少与触发元素一样宽                                          | `boolean`                        | `false`          |
| `showDelay`    | `hover` 时多久打开，毫秒                                      | `number`                         | `100`            |
| `hideDelay`    | `hover` 时离开后多久关闭，毫秒                                | `number`                         | `150`            |
| `offset`       | 与触发元素的间距，px                                          | `number`                         | `6`              |
| `teleport`     | 渲染到哪里；`false` 为原地渲染                                | `string \| HTMLElement \| false` | `'body'`         |
| `items`        | 用数据写的菜单项，代替 `menu` 插槽，见[上文](#用数据写菜单项) | `ContextMenuEntry[]`             | —                |

### Dropdown Events

| 名称          | 说明     | 参数                                     |
| ------------- | -------- | ---------------------------------------- |
| `update:open` | 打开状态 | `(open: boolean)`                        |
| `select`      | 选中一项 | `(value: string \| number \| undefined)` |

### Dropdown Slots

| 名称      | 说明                      |
| --------- | ------------------------- |
| `default` | 触发元素                  |
| `menu`    | 菜单项，`DouDropdownItem` |

### DropdownItem Props

| 名称          | 说明                                               | 类型                    | 默认值      |
| ------------- | -------------------------------------------------- | ----------------------- | ----------- |
| `value`       | 传给 `select` 的值                                 | `string \| number`      | —           |
| `disabled`    | 禁用                                               | `boolean`               | `false`     |
| `tone`        | `danger` 用于破坏性操作                            | `'neutral' \| 'danger'` | `'neutral'` |
| `divided`     | 上方画一条分隔线                                   | `boolean`               | `false`     |
| `checked`     | 勾选状态，配合 `v-model:checked`，设置后成为勾选项 | `boolean`               | —           |
| `shortcut`    | 在右侧显示的快捷键，如 `'mod+s'`，只负责显示       | `string`                | —           |
| `description` | 文字下面的说明，见[上文](#带说明的菜单项)          | `string`                | —           |

### DropdownItem Slots

| 名称          | 说明                                    |
| ------------- | --------------------------------------- |
| `default`     | 文字                                    |
| `prefix`      | 文字前，如图标                          |
| `suffix`      | 行尾，如快捷键                          |
| `description` | 文字下面的说明，代替 `description` 属性 |

### DropdownGroup Props

| 名称      | 说明             | 类型      | 默认值  |
| --------- | ---------------- | --------- | ------- |
| `label`   | 小标题           | `string`  | —       |
| `divided` | 上方画一条分隔线 | `boolean` | `false` |

### DropdownGroup Slots

| 名称      | 说明                      |
| --------- | ------------------------- |
| `default` | 这一组的菜单项            |
| `label`   | 小标题，代替 `label` 属性 |

### DropdownRadioGroup Props

| 名称         | 说明                             | 类型               | 默认值  |
| ------------ | -------------------------------- | ------------------ | ------- |
| `modelValue` | 选中项的 `value`，配合 `v-model` | `string \| number` | —       |
| `label`      | 小标题                           | `string`           | —       |
| `divided`    | 上方画一条分隔线                 | `boolean`          | `false` |

DropdownRadioGroup 的插槽与 DropdownGroup 相同。

### DropdownSub Props

| 名称        | 说明             | 类型        | 默认值          |
| ----------- | ---------------- | ----------- | --------------- |
| `title`     | 项的文字         | `string`    | —               |
| `disabled`  | 禁用             | `boolean`   | `false`         |
| `divided`   | 上方画一条分隔线 | `boolean`   | `false`         |
| `placement` | 子菜单首选的一侧 | `Placement` | `'right-start'` |

### DropdownSub Slots

| 名称      | 说明                                              |
| --------- | ------------------------------------------------- |
| `default` | 子菜单的项，`DouDropdownItem` 或 `DouDropdownSub` |
| `title`   | 项的文字                                          |
| `prefix`  | 文字前，如图标                                    |

### DropdownButton Props

| 名称           | 说明                         | 类型                             | 默认值         |
| -------------- | ---------------------------- | -------------------------------- | -------------- |
| `open`         | 菜单是否打开，`v-model:open` | `boolean`                        | `false`        |
| `variant`      | 外观                         | `'solid' \| 'soft' \| 'outline'` | `'outline'`    |
| `tone`         | 语气色                       | `Tone`                           | —              |
| `size`         | 尺寸                         | `'sm' \| 'md' \| 'lg'`           | `'md'`         |
| `disabled`     | 两半都禁用                   | `boolean`                        | `false`        |
| `loading`      | 主按钮显示加载               | `boolean`                        | `false`        |
| `placement`    | 菜单首选的一侧               | `Placement`                      | `'bottom-end'` |
| `trigger`      | 箭头的打开方式               | `'click' \| 'hover'`             | `'click'`      |
| `hideOnSelect` | 选中后关闭                   | `boolean`                        | `true`         |

### DropdownButton Events

| 名称          | 说明           | 参数                                     |
| ------------- | -------------- | ---------------------------------------- |
| `click`       | 点击了主按钮   | `(event: MouseEvent)`                    |
| `select`      | 选中了菜单的项 | `(value: string \| number \| undefined)` |
| `update:open` | 菜单打开状态   | `(open: boolean)`                        |

### DropdownButton Slots

| 名称      | 说明                 |
| --------- | -------------------- |
| `default` | 主按钮文字           |
| `leading` | 主按钮文字前，如图标 |
| `menu`    | 菜单项               |

### CSS 变量

| 变量                                | 说明                                                     |
| ----------------------------------- | -------------------------------------------------------- |
| `--dou-dropdown-bg`                 | 菜单底色                                                 |
| `--dou-dropdown-inset`              | 菜单内边距                                               |
| `--dou-dropdown-item-height`        | 行高                                                     |
| `--dou-dropdown-item-radius`        | 行圆角                                                   |
| `--dou-dropdown-item-active-bg`     | 高亮行底色                                               |
| `--dou-dropdown-item-padding-x`     | 行左右内边距                                             |
| `--dou-dropdown-item-gap`           | 行内图标、文字之间的间距                                 |
| `--dou-dropdown-indicator-size`     | 勾、圆点那一列的宽度                                     |
| `--dou-dropdown-title-height`       | 带说明的行里，文字那一行的高度，图标和快捷键与它居中对齐 |
| `--dou-dropdown-description-gap`    | 文字与说明之间的间距                                     |
| `--dou-dropdown-description-width`  | 带说明的行里，文字列的最小宽度                           |
| `--dou-dropdown-group-label-height` | 分组小标题的高度                                         |
