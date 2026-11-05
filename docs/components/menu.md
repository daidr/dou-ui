# Menu 导航菜单

应用的导航菜单，可以用作侧边栏或顶部导航。

## 侧边导航

菜单由 `items` 数据驱动。带 `children` 的项是子菜单，在原地展开；`type: 'group'` 是带标题的分组，`type: 'divider'` 是分隔线。`v-model` 绑定当前项的 `key`；没有绑定 `v-model:expanded` 时，当前项所在的子菜单一开始就是展开的。

<DocDemo src="menu/side-nav" />

项上写 `href` 时渲染为链接；配合路由时通常不写 `href`，而是在 `select` 事件里跳转。`accordion` 让同一层最多展开一个子菜单。

## 折叠

`collapsed` 把菜单收成一列图标：叶子项悬停时用文字提示显示名称，子菜单改为向右弹出。弹出的子菜单用鼠标悬停打开，触屏和触控笔上轻点打开、再点一下或点别处收起。没有图标的项显示名称的首字。

<DocDemo src="menu/collapse" />

## 水平

`mode="horizontal"` 横向排列，当前项（或包含当前项的子菜单）带下划线，样式与标签页一致。子菜单向下弹出；分组在横排里只留一道竖线分隔。一行放不下时，末尾的几项会收进“更多”弹出菜单，菜单始终占满所在的行。

<DocDemo src="menu/horizontal" column />

弹出的子菜单直接复用 [Dropdown](./dropdown)：更深一层的子菜单和分组都摊平成带小标题的一段，当前项后面带一个对勾，项的说明显示在名称下面。

## 带说明的项

项上写 `description`，名称下面多一行说明，适合设置页这类只看名称分不清每一项管什么的侧边栏。说明比名称小一号、颜色更浅，放不下时换行，不会把菜单撑宽；图标和子菜单的箭头仍和名称对齐。

说明只在展开的竖向菜单和弹出的子菜单里显示，写法、样式与 [Dropdown 的带说明的菜单项](./dropdown#带说明的菜单项) 一致。折叠后的图标列和水平菜单的顶层只有一行高，不显示说明，读屏仍会读出。弹出层里更深一层的子菜单会摊平成小标题，同样只读出、不显示说明。

<DocDemo src="menu/description" />

## 自定义标签

`label` 插槽替换每一项的文字，比如加上计数，参数为 `{ item, selected }`。`description` 插槽同样替换每一项的说明，比如把其中的数字加粗，只作用于写了 `description` 的项。两个插槽在弹出的子菜单里也生效。

```vue
<DouMenu v-model="current" :items="items">
  <template #label="{ item }">
    {{ item.label }}
    <DouBadge v-if="item.key === 'logs'" :value="3" />
  </template>
</DouMenu>
```

## 项上的操作

`actions` 插槽给某一项加上它自己的按钮，比如“看完了”“还要改”，参数为 `{ item, selected }`；不需要按钮的项什么都不返回即可。按钮渲染在项的旁边，不在项里面，所以可以用 Tab 单独聚焦，点击时也不会选中这一项。按钮显示在这一行的末尾，项的文字会给它们让出位置。

`actions-visible` 控制按钮什么时候显示：`hover`（默认）在悬停这一行、焦点在这一项或它的按钮上，或者这一项是当前项时显示；`always` 始终显示。无法悬停的设备上始终显示。只在竖向菜单里显示，折叠后和弹出的子菜单里没有。

`hover` 下，其他行的按钮是隐藏的，不能直接用 Tab 进入：先用方向键把焦点移到那一项，再按 Tab。同样，从下一项按 Shift+Tab 会直接回到上一项，跳过上一行已经隐藏的按钮。需要所有按钮都能依次 Tab 到时，用 `always`。按钮点完后消失（比如“看完了”之后这一项不再需要按钮）时，焦点回到这一行的项上。

<DocDemo src="menu/actions" />

## 右键菜单

用 [ContextMenu](./context-menu) 包住菜单，在 `itemContextmenu` 事件里记下是哪一项，再在右键菜单的 `select` 里处理。事件的参数是该项的 `MenuItemOption` 和原生事件。右键和聚焦时按菜单键都会触发；在 ContextMenu 的触发区域里，触摸屏上长按也会触发。子菜单的开关、禁用的项也一样。

分组标题、分隔线和项之间的空隙不是任何一项，右键那里不会触发 `itemContextmenu`。用 `v-model:target` 记下项时，ContextMenu 每次右键先把它清空，没有项时让 `beforeOpen` 返回 `false` 就不打开，写法见 [ContextMenu](./context-menu#针对某一项)。下面的示例右键「设置」分组标题试试。

<DocDemo src="menu/context-menu" column />

### 弹出的子菜单

折叠或水平时，子菜单弹出在 `body` 下，不在 ContextMenu 的触发区域里，右键其中的项不会打开外面的菜单，但同样触发 `itemContextmenu`，可以在事件里从脚本打开。用菜单键触发时有的浏览器给出的坐标是 `(0, 0)`，这时改用该项的位置：

```vue
<DouContextMenu ref="contextMenu" v-model:target="target" @select="onSelect">
  <DouMenu :items="items" collapsed @item-contextmenu="onItemContextmenu" />
  <template #menu>…</template>
</DouContextMenu>
```

```ts
const contextMenu = useTemplateRef('contextMenu')
const target = ref<MenuItemOption>()

function onItemContextmenu(item: MenuItemOption, event: MouseEvent) {
  target.value = item
  event.preventDefault()
  const { clientX: x, clientY: y } = event
  if (x || y) contextMenu.value?.open(x, y)
  else {
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect()
    contextMenu.value?.open(box.left, box.bottom)
  }
}
```

在 iOS 上长按弹出层里的项不会触发 `itemContextmenu`：系统不发出 `contextmenu`，而长按的模拟只在 ContextMenu 的触发区域里生效。

## 键盘与读屏

菜单渲染为 `<nav>` 里的列表，属于网站导航而不是应用菜单，所以不使用 `menu` 角色；需要时给它加 `aria-label`。当前项带 `aria-current="page"`，子菜单的开关是带 `aria-expanded` 与 `aria-controls` 的按钮，分组是带名称（`aria-label`）的子列表，分隔线只是装饰，对读屏隐藏。带说明的项只用名称作为可访问名称，说明通过 `aria-describedby` 读出。

除了 `Tab`，竖向菜单里 `↑` `↓` 在可见的项之间移动，`Home` / `End` 跳到首尾，`→` 展开子菜单，`←` 收起或回到上一级；水平菜单里 `←` `→` 移动，`↓` 打开子菜单。

## API

### Props

| 名称             | 说明                                  | 类型                         | 默认值       |
| ---------------- | ------------------------------------- | ---------------------------- | ------------ |
| `items`          | 菜单数据                              | `MenuOption[]`               | `[]`         |
| `modelValue`     | 当前项的 `key`，配合 `v-model`        | `string \| number`           | —            |
| `expanded`       | 展开的子菜单，配合 `v-model:expanded` | `(string \| number)[]`       | 当前项的上级 |
| `mode`           | 方向                                  | `'vertical' \| 'horizontal'` | `'vertical'` |
| `collapsed`      | 竖向时收成一列图标                    | `boolean`                    | `false`      |
| `accordion`      | 同一层最多展开一个子菜单              | `boolean`                    | `false`      |
| `actionsVisible` | `actions` 插槽的按钮何时显示          | `'always' \| 'hover'`        | `'hover'`    |

### MenuOption

`MenuOption` 是以下三种之一：

| 类型                | 字段                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------- |
| `MenuItemOption`    | `key`、`label`、`description?`、`icon?: Component`、`disabled?`、`href?`、`children?` |
| `MenuGroupOption`   | `type: 'group'`、`label`、`children`                                                  |
| `MenuDividerOption` | `type: 'divider'`                                                                     |

### Events

| 名称                | 说明                   | 参数                                            |
| ------------------- | ---------------------- | ----------------------------------------------- |
| `update:modelValue` | 当前项变化             | `(key: string \| number)`                       |
| `update:expanded`   | 展开的子菜单变化       | `(keys: (string \| number)[])`                  |
| `select`            | 选中了一个没有子项的项 | `(key: string \| number, item: MenuItemOption)` |
| `itemContextmenu`   | 在一项上打开右键菜单   | `(item: MenuItemOption, event: MouseEvent)`     |

### Slots

| 名称          | 说明                                                                      |
| ------------- | ------------------------------------------------------------------------- |
| `label`       | 替换每一项的文字，参数为 `{ item, selected }`                             |
| `description` | 替换写了 `description` 的项的说明，参数为 `{ item, selected }`            |
| `actions`     | 项自己的按钮，放在项旁边，参数为 `{ item, selected }`；只在竖向菜单里显示 |

### CSS 变量

| 变量                           | 说明                             |
| ------------------------------ | -------------------------------- |
| `--dou-menu-item-height`       | 行高                             |
| `--dou-menu-indent`            | 每一级的缩进                     |
| `--dou-menu-selected-bg`       | 当前项的底色                     |
| `--dou-menu-title-height`      | 带说明的项里名称那一行的高度     |
| `--dou-menu-description-gap`   | 带说明的项里名称与说明之间的间距 |
| `--dou-menu-description-width` | 菜单不设宽度时，为说明留出的宽度 |
