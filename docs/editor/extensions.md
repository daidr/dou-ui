# 扩展

编辑器的块类型、格式、快捷键和菜单项都由扩展提供。内置的块也是扩展，通过 `extensions` 传入自己的扩展，就可以增加新的块类型或改变编辑器的行为。

## 内置扩展

不传 `extensions` 时，编辑器使用 `starterKit()`，包含[文档数据](./data#块的类型)中列出的全部块类型、文字格式和链接。传入 `false` 可以去掉其中一部分：

```vue
<script setup lang="ts">
import { DouEditor, starterKit } from '@dou-ui/editor'

// 不需要代码块和分隔线
const extensions = [starterKit({ codeBlock: false, divider: false })]
</script>

<template>
  <DouEditor :extensions="extensions" />
</template>
```

| 选项         | 包含的内容                           |
| ------------ | ------------------------------------ |
| `heading`    | 标题                                 |
| `lists`      | 无序列表、有序列表、待办事项         |
| `quote`      | 引用                                 |
| `codeBlock`  | 代码块                               |
| `divider`    | 分隔线                               |
| `formatting` | 粗体、斜体、下划线、删除线、行内代码 |
| `link`       | 链接                                 |

正文（`paragraph`）始终保留。去掉的块类型不会出现在菜单里，对应的 Markdown 快捷输入和快捷键也不再生效。

`extensions` 只在创建编辑器时读取一次，之后修改不会生效。

## 自定义块

`defineBlock` 声明一种新的块类型，用 Vue 组件渲染。下面的提示框是一个自定义块：点击左侧图标切换类型，在块菜单里输入“提示框”可以插入新的提示框。

<DocDemo src="editor/callout" column />

提示框的组件：

<<< @/examples/editor/callout-block.vue

组件里放一个 `<EditorContent />`，块的文字会显示在这里，可以像其他块一样编辑。组件里的其他部分不属于可编辑区域，按钮、输入框等可以正常使用。

块的 `props` 保存在文档里，和内置块的 `props` 一样出现在 `v-model` 的数据中。组件通过 `updateProps` 修改它们，修改会进入撤销记录，协同编辑时也会同步给其他人。不要把块的状态放在组件自己的变量里，否则撤销和协同都拿不到这些状态。

没有文字的块（例如图片、嵌入的网页）把 `content` 设为 `'none'`，组件里不需要 `<EditorContent />`。

### defineBlock 选项

| 名称        | 说明                                                                | 类型                 | 默认值     |
| ----------- | ------------------------------------------------------------------- | -------------------- | ---------- |
| `type`      | 块类型的名称，不能和已有的类型重复                                  | `string`             | —          |
| `props`     | 块的属性和默认值，值需要能转换成 JSON                               | `object`             | `{}`       |
| `content`   | `'inline'` 表示块里有文字，`'none'` 表示没有                        | `'inline' \| 'none'` | `'inline'` |
| `component` | 渲染块的组件                                                        | `Component`          | —          |
| `continues` | 在块末尾按 `Enter` 时，新块沿用同一类型，和列表一样                 | `boolean`            | `false`    |
| `menu`      | 块菜单中的选项，不设置时不出现在菜单里                              | `BlockOption`        | —          |
| `spec`      | 覆盖生成的 ProseMirror 节点定义，例如用 `parseDOM` 识别粘贴来的内容 | `Partial<NodeSpec>`  | —          |

### 组件的 Props

| 名称          | 说明                                   | 类型                                          |
| ------------- | -------------------------------------- | --------------------------------------------- |
| `block`       | 块的 id、类型和当前的 `props`          | `{ id: string; type: string; props: object }` |
| `updateProps` | 修改块的 `props`，只需要传入改动的部分 | `(props: object) => void`                     |
| `selected`    | 块被整体选中（点击没有文字的块时）     | `boolean`                                     |
| `editable`    | 编辑器是否可编辑，只读时为 `false`     | `boolean`                                     |

在块组件里调用 `useEditorContext()` 可以拿到编辑器的 `view`（ProseMirror 的 `EditorView`）和当前语言包的文案 `messages`。

## 编写扩展

`defineExtension` 声明一个扩展。扩展可以只提供一部分内容，例如只加几个快捷键：

```ts
import { defineExtension, setBlockType } from '@dou-ui/editor'

export const quoteShortcut = defineExtension({
  name: 'quote-shortcut',
  keymap: () => ({
    'Mod-Shift-.': setBlockType('quote'),
  }),
})
```

也可以加一种文字格式，并在格式工具栏里显示：

```ts
import { defineExtension, markInputRule } from '@dou-ui/editor'
import { BrushIcon } from '@dou-ui/icons'
import { toggleMark } from 'prosemirror-commands'

export const highlight = defineExtension({
  name: 'highlight',
  marks: {
    highlight: {
      parseDOM: [{ tag: 'mark' }],
      toDOM: () => ['mark', 0],
    },
  },
  inputRules: () => [markInputRule(/(?:^|[^=])(==([^=]+)==)$/, 'highlight')],
  keymap: ({ schema }) => ({ 'Mod-Shift-h': toggleMark(schema.marks.highlight!) }),
  formats: [{ mark: 'highlight', label: '高亮', icon: BrushIcon, hotkey: 'mod+shift+h' }],
})
```

文字格式在数据里写作 `marks: ['highlight']`。

### 扩展的字段

| 名称               | 说明                                                                 | 类型                                   |
| ------------------ | -------------------------------------------------------------------- | -------------------------------------- |
| `name`             | 扩展的名称，同一个扩展不能添加两次                                   | `string`                               |
| `priority`         | 优先级，默认为 `100`。数值大的先执行，快捷键冲突时它的生效           | `number`                               |
| `blocks`           | 新的块类型，键是类型名称，值是 ProseMirror 节点定义                  | `Record<string, NodeSpec>`             |
| `inlines`          | 新的行内节点，例如提及                                               | `Record<string, NodeSpec>`             |
| `marks`            | 新的文字格式                                                         | `Record<string, MarkSpec>`             |
| `nodeViews`        | ProseMirror 节点视图                                                 | `Record<string, NodeViewConstructor>`  |
| `inputRules`       | 输入规则，例如 Markdown 快捷输入                                     | `(context) => InputRule[]`             |
| `keymap`           | 快捷键                                                               | `(context) => Record<string, Command>` |
| `plugins`          | ProseMirror 插件                                                     | `(context) => Plugin[]`                |
| `history`          | 替换内置的撤销记录，只能有一个扩展提供，协同编辑扩展会用到           | `(context) => HistoryProvider`         |
| `externalDocument` | 文档保存在编辑器之外（例如协同编辑的共享文档），`v-model` 只同步输出 | `boolean`                              |
| `blockOptions`     | 块菜单和“转换为”菜单中的选项                                         | `BlockOption[]`                        |
| `formats`          | 格式工具栏中的按钮                                                   | `FormatOption[]`                       |

`context` 里有根据全部扩展生成的 `schema`。

块类型的节点定义除了 ProseMirror 的字段，还可以设置 `continues`（同 `defineBlock`）和 `component`（渲染块的 Vue 组件）。

### 菜单选项

`BlockOption` 描述块菜单中的一项：

| 名称       | 说明                                   | 类型        |
| ---------- | -------------------------------------- | ----------- |
| `key`      | 选项的标识，不能重复                   | `string`    |
| `type`     | 插入或转换成的块类型                   | `string`    |
| `props`    | 同时设置的 `props`，例如标题的 `level` | `object`    |
| `label`    | 名称                                   | `Label`     |
| `hint`     | 名称下方的说明                         | `Label`     |
| `icon`     | 图标                                   | `Component` |
| `keywords` | 额外用于筛选的词，例如拼音             | `string[]`  |
| `shortcut` | 对应的 Markdown 快捷输入，作为提示显示 | `string`    |

`Label` 可以是字符串，也可以是 `(messages) => string`，从编辑器的 `messages` 里读取文字，这样会跟随语言切换。
