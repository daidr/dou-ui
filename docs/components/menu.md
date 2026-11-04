# Menu 导航菜单

应用的导航菜单，可以用作侧边栏或顶部导航。

## 侧边导航

菜单由 `items` 数据驱动。带 `children` 的项是子菜单，在原地展开；`type: 'group'` 是带标题的分组，`type: 'divider'` 是分隔线。`v-model` 绑定当前项的 `key`；没有绑定 `v-model:expanded` 时，当前项所在的子菜单一开始就是展开的。

<DocDemo src="menu/side-nav" />

项上写 `href` 时渲染为链接；配合路由时通常不写 `href`，而是在 `select` 事件里跳转。`accordion` 让同一层最多展开一个子菜单。

## 折叠

`collapsed` 把菜单收成一列图标：叶子项悬停时用文字提示显示名称，子菜单改为向右弹出。没有图标的项显示名称的首字。

<DocDemo src="menu/collapse" />

## 水平

`mode="horizontal"` 横向排列，当前项（或包含当前项的子菜单）带下划线，样式与标签页一致。子菜单向下弹出；分组在横排里只留一道竖线分隔。一行放不下时，末尾的几项会收进“更多”弹出菜单，菜单始终占满所在的行。

<DocDemo src="menu/horizontal" column />

弹出的子菜单直接复用 [Dropdown](./dropdown)：更深一层的子菜单和分组都摊平成带小标题的一段，当前项后面带一个对勾。

## 自定义标签

`label` 插槽替换每一项的文字，比如加上计数，参数为 `{ item, selected }`。

```vue
<DouMenu v-model="current" :items="items">
  <template #label="{ item }">
    {{ item.label }}
    <DouBadge v-if="item.key === 'logs'" :value="3" />
  </template>
</DouMenu>
```

## 右键菜单

用 [ContextMenu](./context-menu) 包住菜单，在 `itemContextmenu` 事件里记下是哪一项，再在右键菜单的 `select` 里处理。事件的参数是该项的 `MenuItemOption` 和原生事件；右键、触摸屏上长按、聚焦时按菜单键都会触发，子菜单的开关、禁用的项也一样。

<DocDemo src="menu/context-menu" column />

折叠或水平时弹出的子菜单渲染在 `body` 下，不在 ContextMenu 的触发区域里，右键其中的项不会打开外面的菜单，但同样触发 `itemContextmenu`；需要时在事件里调用 ContextMenu 的 `open(event.clientX, event.clientY)` 并阻止浏览器自带的菜单。

## 键盘与读屏

菜单渲染为 `<nav>` 里的列表，属于网站导航而不是应用菜单，所以不使用 `menu` 角色；需要时给它加 `aria-label`。当前项带 `aria-current="page"`，子菜单的开关是带 `aria-expanded` 与 `aria-controls` 的按钮，分组是带名称（`aria-label`）的子列表，分隔线只是装饰，对读屏隐藏。

除了 `Tab`，竖向菜单里 `↑` `↓` 在可见的项之间移动，`Home` / `End` 跳到首尾，`→` 展开子菜单，`←` 收起或回到上一级；水平菜单里 `←` `→` 移动，`↓` 打开子菜单。

## API

### Props

| 名称         | 说明                                  | 类型                         | 默认值       |
| ------------ | ------------------------------------- | ---------------------------- | ------------ |
| `items`      | 菜单数据                              | `MenuOption[]`               | `[]`         |
| `modelValue` | 当前项的 `key`，配合 `v-model`        | `string \| number`           | —            |
| `expanded`   | 展开的子菜单，配合 `v-model:expanded` | `(string \| number)[]`       | 当前项的上级 |
| `mode`       | 方向                                  | `'vertical' \| 'horizontal'` | `'vertical'` |
| `collapsed`  | 竖向时收成一列图标                    | `boolean`                    | `false`      |
| `accordion`  | 同一层最多展开一个子菜单              | `boolean`                    | `false`      |

### MenuOption

`MenuOption` 是以下三种之一：

| 类型                | 字段                                                                  |
| ------------------- | --------------------------------------------------------------------- |
| `MenuItemOption`    | `key`、`label`、`icon?: Component`、`disabled?`、`href?`、`children?` |
| `MenuGroupOption`   | `type: 'group'`、`label`、`children`                                  |
| `MenuDividerOption` | `type: 'divider'`                                                     |

### Events

| 名称                | 说明                   | 参数                                            |
| ------------------- | ---------------------- | ----------------------------------------------- |
| `update:modelValue` | 当前项变化             | `(key: string \| number)`                       |
| `update:expanded`   | 展开的子菜单变化       | `(keys: (string \| number)[])`                  |
| `select`            | 选中了一个没有子项的项 | `(key: string \| number, item: MenuItemOption)` |
| `itemContextmenu`   | 在一项上打开右键菜单   | `(item: MenuItemOption, event: MouseEvent)`     |

### Slots

| 名称    | 说明                                          |
| ------- | --------------------------------------------- |
| `label` | 替换每一项的文字，参数为 `{ item, selected }` |

### CSS 变量

| 变量                     | 说明         |
| ------------------------ | ------------ |
| `--dou-menu-item-height` | 行高         |
| `--dou-menu-indent`      | 每一级的缩进 |
| `--dou-menu-selected-bg` | 当前项的底色 |
