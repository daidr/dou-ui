# 扩展

编辑器的块类型、格式、快捷键和菜单项都由扩展提供。内置的块也是扩展，通过 `extensions` 传入自己的扩展，就可以增加新的块类型或改变编辑器的行为。

## 内置扩展

不传 `extensions` 时，编辑器使用 `editorKit()`，包含[文档数据](./data#块的类型)中列出的全部块类型、文字格式和链接。传入 `false` 可以去掉其中一部分：

```vue
<script setup lang="ts">
import { DouEditor, editorKit } from '@dou-ui/editor'

// 不需要代码块和分隔线
const extensions = [editorKit({ codeBlock: false, divider: false })]
</script>

<template>
  <DouEditor :extensions="extensions" />
</template>
```

| 选项         | 包含的内容                                  |
| ------------ | ------------------------------------------- |
| `heading`    | 标题                                        |
| `lists`      | 无序列表、有序列表、待办事项                |
| `quote`      | 引用                                        |
| `codeBlock`  | 代码块，也可以传入[选项](./code-block#选项) |
| `divider`    | 分隔线                                      |
| `toggle`     | 折叠块                                      |
| `callout`    | 提示块                                      |
| `columns`    | [分栏](./columns)                           |
| `formatting` | 粗体、斜体、下划线、删除线、行内代码        |
| `link`       | 链接                                        |

正文（`paragraph`）始终保留。去掉的块类型不会出现在菜单里，对应的 Markdown 快捷输入和快捷键也不再生效。

`extensions` 只在创建编辑器时读取一次，之后修改不会生效，开发时会在控制台提示一次。把列表定义在模板之外；确实需要换扩展时，给编辑器一个新的 `key` 重新创建。

## 自定义块

`defineBlock` 声明一种新的块类型，用 Vue 组件渲染。下面的“决定”是一个自定义块：点击左侧的状态可以切换，在块菜单里输入“决定”可以插入新的块。

<DocDemo src="editor/decision" column />

“决定”块的组件：

<<< @/examples/editor/decision-block.vue

组件里放一个 `<EditorContent />`，块的文字会显示在这里，可以像其他块一样编辑。组件里的其他部分不属于可编辑区域，按钮、输入框等可以正常使用。

块的 `props` 保存在文档里，和内置块的 `props` 一样出现在 `v-model` 的数据中。组件通过 `updateProps` 修改它们，修改会进入撤销记录，协同编辑时也会同步给其他人。不要把块的状态放在组件自己的变量里，否则撤销和协同都拿不到这些状态。

没有文字的块（例如图片、嵌入的网页）把 `content` 设为 `'none'`，组件里不需要 `<EditorContent />`。

### defineBlock 选项

| 名称        | 说明                                                                                                       | 类型                 | 默认值     |
| ----------- | ---------------------------------------------------------------------------------------------------------- | -------------------- | ---------- |
| `type`      | 块类型的名称，不能和已有的类型重复                                                                         | `string`             | —          |
| `props`     | 块的属性和默认值，值需要能转换成 JSON                                                                      | `object`             | `{}`       |
| `content`   | `'inline'` 表示块里有文字，`'none'` 表示没有                                                               | `'inline' \| 'none'` | `'inline'` |
| `component` | 渲染块的组件                                                                                               | `Component`          | —          |
| `continues` | 在块末尾按 `Enter` 时，新块沿用同一类型，和列表一样；相邻的同类块之间也按[列表间距](./#间距和阅读宽度)排列 | `boolean`            | `false`    |
| `menu`      | 块菜单中的选项，不设置时不出现在菜单里                                                                     | `BlockOption`        | —          |
| `spec`      | 覆盖生成的 ProseMirror 节点定义，例如用 `parseDOM` 识别粘贴来的内容                                        | `Partial<NodeSpec>`  | —          |

### 组件的 Props

| 名称          | 说明                                   | 类型                                          |
| ------------- | -------------------------------------- | --------------------------------------------- |
| `block`       | 块的 id、类型和当前的 `props`          | `{ id: string; type: string; props: object }` |
| `updateProps` | 修改块的 `props`，只需要传入改动的部分 | `(props: object) => void`                     |
| `selected`    | 块被整体选中（点击没有文字的块时）     | `boolean`                                     |
| `editable`    | 编辑器是否可编辑，只读时为 `false`     | `boolean`                                     |

在块组件里调用 `useEditor()` 可以拿到编辑器的 `view`（ProseMirror 的 `EditorView`）和当前语言包的文案 `messages`。

## 编写扩展

`defineEditorExtension` 声明一个扩展。扩展可以只提供一部分内容，例如只加几个快捷键：

```ts
import { defineEditorExtension, setBlockType } from '@dou-ui/editor'

export const quoteShortcut = defineEditorExtension({
  name: 'quote-shortcut',
  keymap: () => ({
    'mod+shift+.': setBlockType('quote'),
  }),
})
```

也可以加一种文字格式，并在格式工具栏里显示：

```ts
import { defineEditorExtension, markInputRule } from '@dou-ui/editor'
import { BrushIcon } from '@dou-ui/icons'
import { toggleMark } from 'prosemirror-commands'

export const highlight = defineEditorExtension({
  name: 'highlight',
  marks: {
    highlight: {
      parseDOM: [{ tag: 'mark' }],
      toDOM: () => ['mark', 0],
    },
  },
  inputRules: () => [markInputRule(/(?:^|[^=])(==([^=]+)==)$/, 'highlight')],
  keymap: ({ schema }) => ({ 'mod+shift+h': toggleMark(schema.marks.highlight!) }),
  formats: [{ mark: 'highlight', label: '高亮', icon: BrushIcon, hotkey: 'mod+shift+h' }],
})
```

文字格式在数据里写作 `marks: ['highlight']`。

### 扩展的字段

| 名称               | 说明                                                                                                                                                       | 类型                                   |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `name`             | 扩展的名称，同一个扩展不能添加两次                                                                                                                         | `string`                               |
| `priority`         | 优先级，默认为 `100`。数值大的先执行，快捷键冲突时它的生效                                                                                                 | `number`                               |
| `blocks`           | 新的块类型，键是类型名称，值是 ProseMirror 节点定义                                                                                                        | `Record<string, NodeSpec>`             |
| `inlines`          | 新的行内节点，例如提及                                                                                                                                     | `Record<string, NodeSpec>`             |
| `marks`            | 新的文字格式                                                                                                                                               | `Record<string, MarkSpec>`             |
| `nodeViews`        | ProseMirror 节点视图                                                                                                                                       | `Record<string, NodeViewConstructor>`  |
| `inputRules`       | 输入规则，例如 Markdown 快捷输入                                                                                                                           | `(context) => InputRule[]`             |
| `keymap`           | 快捷键，写法和 `useHotkey` 一样（如 `mod+shift+h`、`shift+tab`、`enter`）；命令返回 `false` 时交给下一个扩展                                               | `(context) => Record<string, Command>` |
| `plugins`          | ProseMirror 插件                                                                                                                                           | `(context) => Plugin[]`                |
| `comments`         | 把讨论保存在 `v-model:comments` 以外的地方（比如共享文档），这时 `v-model:comments` 只反映它；只能有一个扩展提供，协同编辑扩展会用到，见[评论](./comments) | `(context) => CommentsProvider`        |
| `history`          | 替换内置的撤销记录，只能有一个扩展提供，协同编辑扩展会用到                                                                                                 | `(context) => HistoryProvider`         |
| `externalDocument` | 文档保存在编辑器之外（例如协同编辑的共享文档），`v-model` 只同步输出                                                                                       | `boolean`                              |
| `blockOptions`     | 块菜单和“转换为”菜单中的选项                                                                                                                               | `BlockOption[]`                        |
| `formats`          | 格式工具栏中的按钮                                                                                                                                         | `FormatOption[]`                       |
| `overlays`         | 可编辑时渲染在编辑区域旁的组件，例如提及的候选列表                                                                                                         | `Component[]`                          |
| `toolbar`          | 放在格式工具栏末尾的组件，例如颜色和对齐菜单                                                                                                               | `Component[]`                          |
| `blockMenu`        | 放在块菜单里的组件，会收到当前块的 `block`（id、类型和 `props`）                                                                                           | `Component[]`                          |
| `output`           | 块、行内节点和文字格式写成 HTML 与 Markdown 的方式，见[导入与导出](./import-export)                                                                        | `EditorExtensionOutput`                |
| `prepareHTML`      | 读入 HTML 前整理它（粘贴和导入时），见[导入与导出](./import-export)                                                                                        | `(root: HTMLElement) => void`          |

`context` 里有根据全部扩展生成的 `schema`，以及 `messages()`：返回编辑器当前语言的 `messages`，供插件写进文档结构的文字使用（例如给读屏的名称）；不在编辑器里（转换文档）时返回简体中文。

块类型的节点定义除了 ProseMirror 的字段，还可以设置 `continues`（同 `defineBlock`）、`component`（渲染块的 Vue 组件）、`mergeProps`（协同编辑时按条目合并的属性，见[白板与流程图](./whiteboard#协同编辑)）和 `checkProps`（`checkDocument` 检查属性的函数，见[文档数据](./data)）。`checkProps` 接收块的 `props`，返回 `{ prop, message }` 的数组，`prop` 是出问题的属性名，可以写到属性里面一层，例如 `board.nodes`。

`toolbar` 里的组件可以用 `useEditor()` 拿到编辑器的 `view` 和 `state`。组件里有下拉菜单时，用 `useToolbarMenu()` 得到的值绑定菜单的 `v-model:open`，菜单打开、焦点离开编辑器时工具栏不会收起：

```vue
<script setup lang="ts">
import { useEditor, useToolbarMenu } from '@dou-ui/editor'
import { DouButton, DouDropdown, DouDropdownItem } from 'dou-ui'

const { view } = useEditor()
const open = useToolbarMenu()
</script>

<template>
  <DouDropdown v-model:open="open">
    <DouButton size="sm" variant="ghost">插入</DouButton>
    <template #menu>
      <DouDropdownItem @click="view?.focus()">上海</DouDropdownItem>
    </template>
  </DouDropdown>
</template>
```

只有图标的按钮要加提示时，用 `DouTooltip` 包一层 `span`，再把下拉菜单放进去。提示不能放在 `DouDropdown` 和按钮之间，否则菜单打不开。菜单打开时关掉提示，免得两者重叠：

```vue
<template>
  <DouTooltip content="插入" :disabled="open">
    <span>
      <DouDropdown v-model:open="open">
        <DouButton size="sm" variant="ghost" aria-label="插入"><PlusIcon /></DouButton>
        <template #menu>…</template>
      </DouDropdown>
    </span>
  </DouTooltip>
</template>
```

用鼠标打开工具栏里的菜单后，焦点仍在正文：这时按 `Esc` 关闭菜单，方向键和 `Enter` 进入菜单，不会作用在正文上。

### 菜单选项

`BlockOption` 描述块菜单中的一项：

| 名称       | 说明                                   | 类型                 |
| ---------- | -------------------------------------- | -------------------- |
| `key`      | 选项的标识，不能重复                   | `string`             |
| `type`     | 插入或转换成的块类型                   | `string`             |
| `props`    | 同时设置的 `props`，例如标题的 `level` | `object`             |
| `label`    | 名称                                   | `Label`              |
| `hint`     | 名称下方的说明                         | `Label`              |
| `icon`     | 图标                                   | `Component`          |
| `keywords` | 额外用于筛选的词，例如拼音             | `string[]`           |
| `shortcut` | 对应的 Markdown 快捷输入，作为提示显示 | `string`             |
| `choices`  | 在选项旁边弹出的几种变体，见下文       | `BlockOptionChoices` |

`Label` 可以是字符串，也可以是 `(messages) => string`，从编辑器的 `messages` 里读取文字，这样会跟随语言切换。

### 选项的变体

有的块插入前要先选一个参数，例如[分栏](./columns)要选栏数。给选项加上 `choices`，斜杠菜单里这个选项被选中时，旁边会弹出一个面板：

```ts
{
  key: 'chart',
  type: 'chart',
  label: '图表',
  icon: BarChartIcon,
  choices: {
    title: '选择图表类型',
    items: [
      { props: { kind: 'bar' }, label: '柱状图' },
      { props: { kind: 'line' }, label: '折线图' },
    ],
  },
}
```

- `items` 是各个变体，选中后把它的 `props` 合并到选项的 `props` 上再插入。直接点击选项本身时插入第一个变体。
- `title` 显示在面板顶部，读屏也用它作为面板的名称；变体的 `label` 是读屏读出的名称。
- 用键盘时，`→` 进入面板并切换到下一个变体，`←` 切换到上一个，在第一个变体上按 `←` 回到选项本身；`Enter` 插入当前的变体，停在选项上时插入第一个。在选项上按 `←`、在最后一个变体上按 `→` 时，方向键照常移动光标。
- 在手机上（指针不精确的设备），面板不在旁边弹出，而是在这个选项下面展开：第一次点选项展开，再点变体插入。
- `component` 决定面板里怎样画出这些变体，面板外框和标题由菜单画出。省略时按名称列出各个变体。

自己画变体时，组件收到 `BlockOptionChoicesProps`，触发 `BlockOptionChoicesEmits` 里的事件：

| 名称             | 说明                                                                                                                                            | 类型                  |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `items`          | 各个变体                                                                                                                                        | `BlockOptionChoice[]` |
| `active`         | 当前变体的序号；选中的是选项本身时为 `-1`                                                                                                       | `number`              |
| `messages`       | 编辑器当前语言的文字                                                                                                                            | `EditorMessages`      |
| `idPrefix`       | 第 `index` 个变体的元素要设置 `id` 为 `` `${idPrefix}-${index}` ``，并带上 `role="option"` 和 `aria-selected`，编辑器靠它告诉读屏当前是哪个变体 | `string`              |
| `hover`（事件）  | 指针移到第 `index` 个变体上时触发                                                                                                               | `(index) => void`     |
| `choose`（事件） | 点击第 `index` 个变体时触发，菜单随即插入                                                                                                       | `(index) => void`     |

```vue
<script setup lang="ts">
import type { BlockOptionChoicesEmits, BlockOptionChoicesProps } from '@dou-ui/editor'
import { labelOf } from '@dou-ui/editor'

defineProps<BlockOptionChoicesProps>()
const emit = defineEmits<BlockOptionChoicesEmits>()
</script>

<template>
  <div class="chart-kinds">
    <button
      v-for="(item, index) in items"
      :id="`${idPrefix}-${index}`"
      :key="index"
      type="button"
      role="option"
      :aria-selected="index === active"
      :class="{ 'is-active': index === active }"
      @pointermove="emit('hover', index)"
      @click="emit('choose', index)"
    >
      {{ labelOf(item.label, messages) }}
    </button>
  </div>
</template>
```

分栏的栏数面板就是这样画出的一排竖条。
