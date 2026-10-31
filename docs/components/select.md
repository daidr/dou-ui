# Select 选择器

从下拉列表中选择一项或多项。

列表的定位、层级与关闭行为见 [浮层](../guide/overlays)。

## 基础用法

`options` 是选项列表，字符串或数字同时作为值和标签；对象形式为 `{ value, label, disabled }`。

<DocDemo src="select/basic" column style="max-width: 360px" />

## 可清空与占位

`clearable` 在有值时显示清空按钮，清空后值为 `null`。`placeholder` 默认取语言包里的“请选择”。

<DocDemo src="select/clearable" column style="max-width: 360px" />

## 多选

`multiple` 时值是数组，选中的项显示为可移除的标签；列表在选择后保持打开。

<DocDemo src="select/multiple" column style="max-width: 360px" />

## 可搜索

`filterable` 把字段变成输入框，输入的文字按标签筛选选项。没有匹配时显示 `empty` 插槽或语言包里的“无匹配项”。多选时，搜索框为空按 `Backspace` 会移除最后一个标签。

<DocDemo src="select/filterable" column style="max-width: 360px" />

## 分组

选项可以放进 `{ label, options }` 分组，组名是一行淡色的小字，组与组之间一条细线。分组上的 `disabled` 禁用组里的所有选项。

<DocDemo src="select/group" style="max-width: 360px" />

## 远程搜索

`remote` 把搜索交给你：输入停顿 `search-delay`（默认 300ms）后触发 `search`，打开时也会触发一次；把结果换进 `options` 即可，组件不再自己筛选。请求期间设 `loading`，列表里显示加载中。已经选中的值即使不在新结果里，也会记得它的标签。

<DocDemo src="select/remote" style="max-width: 360px" />

## 可创建

`creatable` 在输入的文字没有完全匹配的选项时，把它作为第一项“创建‘…’”提供出来；选中后它就成为一个普通选项，并触发 `create`。适合标签这类可以随手新增的值。

<DocDemo src="select/creatable" style="max-width: 360px" />

## 虚拟滚动

选项超过 100 个时，列表自动只渲染看得见的那些，键盘移动时会自动滚到当前项。虚拟滚动要求每个选项一样高：用 `option` 插槽做了高度不一的选项时，传 `:virtual="false"` 关掉。下面是五千个选项。

<DocDemo src="select/virtual" style="max-width: 360px" />

## 折叠标签与数量上限

选得多时字段会被撑高。`max-tag-count` 只显示前几个标签，其余折叠成一个“+N”，指向它能看到被折叠的是哪几项。`multiple-limit` 限定最多选几项，到上限后没选中的项变灰，已选的仍可取消。

<DocDemo src="select/collapse-tags" />

## 对象作为值

值可以是对象，此时用 `value-key` 指定哪个属性用来区分它们。这样从接口拿回的新对象和选项里的对象虽然不是同一个，也能对上。

<DocDemo src="select/object-value" />

## 头部与底部

`header`、`footer` 插槽放在列表上下，滚动选项时它们不动，适合放“全选”或“新建”。`tag` 插槽替换多选的标签（参数 `{ option, remove }`），`label` 插槽替换单选时字段里的文字（参数 `{ option }`）。

<DocDemo src="select/header-footer" />

## 尺寸、禁用与表单

尺寸、禁用与校验状态与输入框一致，也会从 [表单](./form) 继承。

<DocDemo src="select/size-disabled" column style="max-width: 360px" />

## 自定义选项

`option` 插槽替换每个选项的内容，参数为 `{ option, selected }`。

<DocDemo src="select/custom-option" column style="max-width: 360px" />

## 键盘与读屏

字段是 `role="combobox"`，列表是 `role="listbox"`，每项是 `role="option"` 并标注 `aria-selected`。焦点始终留在字段上，高亮项通过 `aria-activedescendant` 告诉读屏。

| 按键           | 作用                                       |
| -------------- | ------------------------------------------ |
| `↓` / `↑`      | 打开列表；打开后在可选项之间移动，首尾循环 |
| `Home` / `End` | 第一项 / 最后一项（不可搜索时）            |
| `Enter`        | 打开列表，或选中高亮项                     |
| `Space`        | 同 `Enter`（不可搜索时）                   |
| 字母           | 跳到下一个以它开头的项（不可搜索时）       |
| `Esc`          | 关闭列表                                   |
| `Tab`          | 关闭列表，焦点继续向后                     |

放在 [表单项](./form) 中时，可搜索的选择器由 `<label for>` 命名，其余由 `aria-labelledby` 命名。

分组用 `role="group"` 包住组内选项，并由组名命名。虚拟滚动时每个选项带 `aria-setsize` 与 `aria-posinset`，读屏仍能报出“第几项，共几项”。远程加载中的提示是 `role="status"`。

## API

### Props

| 名称            | 说明                                                                    | 类型                                                        | 默认值           |
| --------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------- |
| `modelValue`    | 选中值，多选时为数组，配合 `v-model`                                    | `SelectValue \| SelectValue[] \| null`                      | —                |
| `options`       | 选项；字符串或数字同时作为值和标签；可以分组                            | `(SelectOption \| SelectOptionGroup \| string \| number)[]` | —                |
| `multiple`      | 多选                                                                    | `boolean`                                                   | `false`          |
| `filterable`    | 输入文字筛选选项                                                        | `boolean`                                                   | `false`          |
| `placeholder`   | 未选择时的提示                                                          | `string`                                                    | 语言包           |
| `size`          | 尺寸，默认取表单或全局配置                                              | `'sm' \| 'md' \| 'lg'`                                      | `'md'`           |
| `disabled`      | 禁用                                                                    | `boolean`                                                   | `false`          |
| `readonly`      | 只读：值照常显示、可以聚焦，但不能修改；Form 设置 `readonly` 时自动只读 | `boolean`                                                   | `false`          |
| `invalid`       | 无效状态                                                                | `boolean`                                                   | `false`          |
| `clearable`     | 显示清空按钮                                                            | `boolean`                                                   | `false`          |
| `placement`     | 列表首选的位置                                                          | `Placement`                                                 | `'bottom-start'` |
| `teleport`      | 列表渲染到哪里；`false` 为原地渲染                                      | `string \| HTMLElement \| false`                            | `'body'`         |
| `ariaLabel`     | 没有可见标签时的读屏名称                                                | `string`                                                    | —                |
| `remote`        | 远程搜索：输入时触发 `search`，不在本地筛选；隐含 `filterable`          | `boolean`                                                   | `false`          |
| `searchDelay`   | 输入停顿多久后触发 `search`，毫秒                                       | `number`                                                    | `300`            |
| `loading`       | 列表里显示加载中                                                        | `boolean`                                                   | `false`          |
| `creatable`     | 没有完全匹配时，把输入的文字作为新选项；隐含 `filterable`               | `boolean`                                                   | `false`          |
| `virtual`       | 只渲染看得见的选项；不传时超过 100 个选项自动开启                       | `boolean`                                                   | —                |
| `maxTagCount`   | 多选时最多显示几个标签，其余折叠成“+N”                                  | `number`                                                    | —                |
| `multipleLimit` | 多选时最多选几项                                                        | `number`                                                    | —                |
| `valueKey`      | 值为对象时，用来区分它们的属性                                          | `string`                                                    | —                |

`SelectValue` 为 `string | number | boolean | object`（对象需要 `valueKey`），`SelectOption` 为 `{ value: SelectValue; label?: string; disabled?: boolean }`，`SelectOptionGroup` 为 `{ label: string; options: (SelectOption | string | number)[]; disabled?: boolean }`。

### Events

| 名称                | 说明                                     | 参数                                            |
| ------------------- | ---------------------------------------- | ----------------------------------------------- |
| `update:modelValue` | 值变化                                   | `(value: SelectValue \| SelectValue[] \| null)` |
| `change`            | 用户选择或移除了项                       | `(value: SelectValue \| SelectValue[] \| null)` |
| `clear`             | 按下清空按钮                             | —                                               |
| `search`            | 远程搜索的文字变化（停顿后），以及打开时 | `(query: string)`                               |
| `create`            | 从输入的文字创建了新选项                 | `(value: string)`                               |
| `visibleChange`     | 列表打开或关闭                           | `(open: boolean)`                               |
| `removeTag`         | 移除了多选的一个标签                     | `(value: SelectValue)`                          |

### Slots

| 名称     | 说明                                        |
| -------- | ------------------------------------------- |
| `prefix` | 字段内、值之前的内容，通常是图标            |
| `option` | 选项内容，参数为 `{ option, selected }`     |
| `empty`  | 没有匹配项时显示                            |
| `header` | 列表上方，不随选项滚动                      |
| `footer` | 列表下方，不随选项滚动                      |
| `tag`    | 多选的每个标签，参数为 `{ option, remove }` |
| `label`  | 单选时字段里的文字，参数为 `{ option }`     |

### 方法

| 名称      | 说明 |
| --------- | ---- |
| `focus()` | 聚焦 |
| `blur()`  | 失焦 |
