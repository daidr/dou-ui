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

`setBlocks` 和从外部修改 `v-model` 一样，不会进入撤销记录。

## 协同编辑

编辑器的内核按协同编辑的要求设计：块 id 使用随机 UUID，块的状态（例如待办是否完成）都保存在文档里，撤销记录可以替换。基于 Yjs 的协同扩展会在后续版本提供，作为一个[扩展](./extensions)接入，替换内置的撤销记录，不需要改动已有的文档数据。

## API

### Props

| 名称          | 说明                                               | 类型                      | 默认值           |
| ------------- | -------------------------------------------------- | ------------------------- | ---------------- |
| `modelValue`  | 文档内容，用 `v-model` 绑定                        | `PartialBlock[]`          | —                |
| `readonly`    | 只读                                               | `boolean`                 | `false`          |
| `placeholder` | 光标所在空块里的提示文字                           | `string`                  | 跟随语言         |
| `label`       | 编辑区域的无障碍名称                               | `string`                  | —                |
| `autofocus`   | 挂载后获得焦点                                     | `boolean`                 | `false`          |
| `messages`    | 替换内置文字，例如块类型的名称                     | `Partial<EditorMessages>` | —                |
| `extensions`  | 使用的扩展，见[扩展](./extensions)，只在创建时读取 | `EditorExtension[]`       | `[starterKit()]` |
| `plugins`     | 额外的 ProseMirror 插件，排在内置插件之前          | `Plugin[]`                | —                |
| `history`     | 使用内置的撤销记录，协同编辑时关闭                 | `boolean`                 | `true`           |
| `undo`        | 替换撤销命令                                       | `Command`                 | —                |
| `redo`        | 替换重做命令                                       | `Command`                 | —                |

### Events

| 名称                | 说明                          | 参数                  |
| ------------------- | ----------------------------- | --------------------- |
| `update:modelValue` | 文档修改后触发                | `(blocks: Block[])`   |
| `change`            | 同上，不绑定 `v-model` 时使用 | `(blocks: Block[])`   |
| `focus`             | 获得焦点                      | `(event: FocusEvent)` |
| `blur`              | 失去焦点                      | `(event: FocusEvent)` |

### 实例方法

| 名称        | 说明                                      | 类型                               |
| ----------- | ----------------------------------------- | ---------------------------------- |
| `view`      | ProseMirror 的 `EditorView`，挂载后可用   | `EditorView \| null`               |
| `focus`     | 获得焦点                                  | `() => void`                       |
| `blur`      | 失去焦点                                  | `() => void`                       |
| `getBlocks` | 读取当前文档                              | `() => Block[]`                    |
| `setBlocks` | 替换整个文档，不进入撤销记录              | `(blocks: PartialBlock[]) => void` |
| `run`       | 执行一个 ProseMirror 命令，返回是否执行了 | `(command: Command) => boolean`    |

### CSS 变量

| 变量                       | 说明                                 |
| -------------------------- | ------------------------------------ |
| `--dou-editor-font-size`   | 正文字号                             |
| `--dou-editor-line-height` | 正文行高                             |
| `--dou-editor-gutter`      | 左侧留给手柄的宽度，只读时为 `0`     |
| `--dou-editor-indent`      | 每一级缩进的宽度，也是列表符号的宽度 |
| `--dou-editor-block-gap`   | 块上下的间距                         |
| `--dou-editor-selected`    | 选中的块的底色                       |
