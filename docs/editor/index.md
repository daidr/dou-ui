# 块编辑器

`@dou-ui/editor` 提供块编辑器 `DouEditor`。文档由一个个块组成，每个块可以转换类型、拖动排序、缩进嵌套。

## 安装

块编辑器是单独的包，需要和 `dou-ui` 一起使用：

```sh
bun add dou-ui @dou-ui/editor
```

引入样式，再注册组件：

```ts
import 'dou-ui/style.css'
import '@dou-ui/editor/style.css'
import { DouEditor } from '@dou-ui/editor'

app.use(DouEditor)
```

也可以只在用到的组件里 `import { DouEditor } from '@dou-ui/editor'`。

## 基础用法

`v-model` 绑定一个块数组，格式见[文档数据](./data)。

<DocDemo src="editor/basic" column />

- 输入 `/` 打开块菜单，继续输入可以筛选，`Enter` 选中。在空块里会转换当前块，在有内容的块里会在下方插入新块。
- 鼠标移到块上，左侧出现手柄：点击 `+` 在下方添加块；拖动 <code>⋮⋮</code> 移动块，点击它打开块菜单，可以转换类型、复制、移动和删除。
- 在手机等触屏设备上，光标所在的块左侧出现 <code>⋮⋮</code>：按住拖动可以移动块，点一下打开块菜单，菜单里的“上移”“下移”适合小幅调整。
- 选中文字后，上方出现格式工具栏，可以设置粗体、斜体、链接等，也可以转换所在块的类型。
- 粘贴网页或其他编辑器的内容时，标题、列表（包括嵌套列表和任务列表）、引用、代码和链接都会保留。
- 行首输入 `#`、`-`、`1.`、`[]` 等 Markdown 标记会转换块的类型，`Tab` 和 `Shift+Tab` 调整缩进。完整列表见[快捷操作](./shortcuts)。

## 只读

`readonly` 让文档只能阅读：手柄、块菜单和工具栏都不会出现，待办事项不能勾选，链接可以直接点击打开。

<DocDemo src="editor/readonly" column />

## 读取和修改内容

`v-model` 会在每次修改后更新。也可以通过组件实例读取或替换内容：

```vue
<script setup lang="ts">
import { DouEditor } from '@dou-ui/editor'
import { useTemplateRef } from 'vue'

const editor = useTemplateRef('editor')

function reset() {
  editor.value?.setBlocks([{ type: 'paragraph', content: '' }])
}
</script>

<template>
  <DouEditor ref="editor" />
</template>
```

`setBlocks` 和从外部修改 `v-model` 一样，不会进入撤销记录。按块插入、修改、移动并可以撤销的方法，以及跟踪修改和光标的事件，见[用代码修改](./editing)。

## 协同编辑

多人同时编辑同一份文档，见[协同编辑](./collaboration)。

## API

### Props

| 名称          | 说明                                                                                  | 类型                     | 默认值          |
| ------------- | ------------------------------------------------------------------------------------- | ------------------------ | --------------- |
| `modelValue`  | 文档内容，用 `v-model` 绑定                                                           | `PartialBlock[]`         | —               |
| `readonly`    | 只读                                                                                  | `boolean`                | `false`         |
| `placeholder` | 光标所在空块里的提示文字                                                              | `string`                 | 跟随语言        |
| `ariaLabel`   | 编辑区域的无障碍名称                                                                  | `string`                 | —               |
| `autofocus`   | 挂载后获得焦点                                                                        | `boolean`                | `false`         |
| `messages`    | 替换内置文字，只写要改的部分即可，例如 `{ types: { paragraph: '段落' } }`             | `EditorMessagesOverride` | —               |
| `extensions`  | 使用的扩展，见[扩展](./extensions)，只在创建时读取                                    | `EditorExtension[]`      | `[editorKit()]` |
| `plugins`     | 额外的 ProseMirror 插件，排在内置插件之前                                             | `Plugin[]`               | —               |
| `history`     | 使用内置的撤销记录，使用自己的撤销方案时关闭                                          | `boolean`                | `true`          |
| `undo`        | 替换撤销命令                                                                          | `Command`                | —               |
| `redo`        | 替换重做命令                                                                          | `Command`                | —               |
| `selection`   | 光标所在的块和选中的块，用 `v-model:selection` 绑定，见[跟踪光标](./editing#跟踪光标) | `EditorSelection`        | —               |

### Events

| 名称                | 说明                                                                                                             | 参数                                |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `update:modelValue` | 文档修改后触发                                                                                                   | `(blocks: Block[])`                 |
| `change`            | 同上，不绑定 `v-model` 时使用。和 `update:modelValue` 一样每次修改都会触发，不像表单控件的 `change` 那样等到失焦 | `(blocks: Block[])`                 |
| `transaction`       | 每次修改后触发，在 `update:modelValue` 之前，给出修改涉及的块和来源，见[跟踪修改](./editing#跟踪修改)            | `(result: EditorTransactionResult)` |
| `update:selection`  | 光标移到另一个块，或选中的块变化时触发，见[跟踪光标](./editing#跟踪光标)                                         | `(selection: EditorSelection)`      |
| `focus`             | 获得焦点                                                                                                         | `(event: FocusEvent)`               |
| `blur`              | 失去焦点                                                                                                         | `(event: FocusEvent)`               |

### 实例方法

| 名称                  | 说明                                                                          | 类型                                                                                                     |
| --------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `view`                | ProseMirror 的 `EditorView`，挂载后可用                                       | `EditorView \| null`                                                                                     |
| `focus`               | 获得焦点                                                                      | `() => void`                                                                                             |
| `blur`                | 失去焦点                                                                      | `() => void`                                                                                             |
| `getBlocks`           | 读取当前文档                                                                  | `() => Block[]`                                                                                          |
| `setBlocks`           | 替换整个文档，不进入撤销记录                                                  | `(blocks: PartialBlock[]) => void`                                                                       |
| `getHTML`             | 把当前文档写成 HTML，见[导入与导出](./import-export)                          | `() => string`                                                                                           |
| `setHTML`             | 用 HTML 替换整个文档，不进入撤销记录                                          | `(html: string) => void`                                                                                 |
| `run`                 | 执行一个 ProseMirror 命令，返回是否执行了                                     | `(command: Command) => boolean`                                                                          |
| `getBlock`            | 读取一个块，找不到时为 `null`                                                 | `(id: string) => Block \| null`                                                                          |
| `insertBlocks`        | 插入块，默认插在光标所在的块后面，返回新块的 id，见[修改块](./editing#修改块) | `(blocks: PartialBlock[], placement?: BlockPlacement) => string[]`                                       |
| `updateBlock`         | 修改块的类型、属性、文字或子块，`props` 合并到原有属性里                      | `(id: string, patch: BlockPatch) => boolean`                                                             |
| `removeBlocks`        | 删除块和它们的子块                                                            | `(ids: string[]) => boolean`                                                                             |
| `moveBlocks`          | 按给出的顺序把块移到另一个位置                                                | `(ids: string[], placement: BlockPlacement) => boolean`                                                  |
| `focusBlock`          | 获得焦点，光标放在块的开头或末尾（默认），并滚动到可见                        | `(id: string, edge?: 'start' \| 'end') => boolean`                                                       |
| `transact`            | 把多处修改合成一步撤销，见[合成一步](./editing#合成一步)                      | `(fn: (tr: EditorTransaction) => void, meta?: EditorTransactionMeta) => EditorTransactionResult \| null` |
| `getSelection`        | 读取光标所在的块和选中的块                                                    | `() => EditorSelection`                                                                                  |
| `undo` / `redo`       | 撤销、重做                                                                    | `() => boolean`                                                                                          |
| `canUndo` / `canRedo` | 现在能否撤销、重做                                                            | `boolean`                                                                                                |

### CSS 变量

| 变量                       | 说明                                 |
| -------------------------- | ------------------------------------ |
| `--dou-editor-font-size`   | 正文字号                             |
| `--dou-editor-line-height` | 正文行高                             |
| `--dou-editor-gutter`      | 左侧留给手柄的宽度，只读时为 `0`     |
| `--dou-editor-indent`      | 每一级缩进的宽度，也是列表符号的宽度 |
| `--dou-editor-block-gap`   | 块上下的间距                         |
| `--dou-editor-selected`    | 选中的块的底色                       |
