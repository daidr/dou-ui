# 文档数据

块编辑器的内容是一个块数组，可以直接存成 JSON。修改下面的文档，可以看到数据的变化：

<DocDemo src="editor/data" column />

## 块

每个块的结构如下：

```ts
interface Block {
  /** 块的 id，编辑过程中保持不变 */
  id: string
  /** 块的类型 */
  type: ContentType
  /** 类型相关的属性 */
  props: BlockProps
  /** 块里的文字 */
  content: InlineContent[]
  /** 表格的行，只有表格块有 */
  rows?: TableRow[]
  /** 缩进在这个块下面的子块 */
  children: Block[]
}
```

`v-model` 和 `change` 事件给出的都是完整的 `Block`。传入时可以省略大部分字段，写成 `PartialBlock`：

- `id` 省略时自动生成随机 UUID。
- `type` 省略时为 `'paragraph'`。
- `content` 可以直接写字符串，等同于一段没有格式的文字。
- `props` 和 `children` 可以省略。

```ts
const blocks: PartialBlock[] = [
  { type: 'heading', props: { level: 1 }, content: '标题' },
  { content: '一段文字' },
]
```

块的 id 在拆分、合并、移动、转换类型时都保持不变，复制出来的块会得到新的 id。保存修改时可以按 id 对比前后两份数据，也可以直接用 `transaction` 事件给出的修改列表，见[跟踪修改](./editing#跟踪修改)。

没有修改的块在前后两次 `v-model` 里是同一个对象。这些对象是只读的：要修改内容，使用实例上的 `updateBlock` 等方法，或者传给 `v-model` 一个新数组（可以用展开语法复制要改的块）。

## 块的类型

| `type`         | 说明     | `props`                                                   |
| -------------- | -------- | --------------------------------------------------------- |
| `paragraph`    | 正文     | `align`：对齐方式，见[文字颜色与对齐](./text-styles)      |
| `heading`      | 标题     | `level`：`1`、`2` 或 `3`；`align`                         |
| `bulletItem`   | 无序列表 | —                                                         |
| `numberedItem` | 有序列表 | —                                                         |
| `checkItem`    | 待办事项 | `checked`：是否完成                                       |
| `quote`        | 引用     | `align`                                                   |
| `codeBlock`    | 代码     | `language`：语言名称，默认为空字符串                      |
| `divider`      | 分隔线   | —                                                         |
| `toggle`       | 折叠块   | —                                                         |
| `callout`      | 提示块   | `tone`：`info`、`tip`、`warning` 或 `danger`，默认 `info` |
| `table`        | 表格     | 表头设置与列信息，内容在 `rows` 里，见[表格](./table)     |

`align` 只在设置了对齐时出现，没有对齐的块 `props` 里没有这一项。图片、附件和嵌入等块由各自的扩展提供，见对应页面。

通过[扩展](./extensions)增加的块类型也使用同样的格式，`props` 由扩展定义。

列表没有单独的“列表”容器，每一项都是一个块。有序列表的序号按连续的同级有序列表项计算，中间隔着其他类型的块时重新从 1 开始。

## 文字

`content` 是一组文字片段：

```ts
type InlineContent =
  | {
      type: 'text'
      text: string
      marks?: MarkType[]
      link?: string
      color?: string
      highlight?: string
    }
  | { type: 'break' }
  | { type: 'inline'; name: string; props: Record<string, unknown> }
```

- `marks` 是文字的格式，可选 `'bold'`、`'italic'`、`'underline'`、`'strike'`、`'code'`，按这个顺序排列。
- `link` 是链接地址，只接受 `http`、`https`、`mailto`、`tel` 和相对地址，其他协议（例如 `javascript:`）会被忽略。
- `color` 和 `highlight` 是文字颜色和背景色，取值是调色板里的颜色名，例如 `'red'`，见[文字颜色与对齐](./text-styles)。
- `{ type: 'break' }` 是块内换行，用 `Shift+Enter` 输入。
- `{ type: 'inline' }` 是扩展提供的行内节点，`name` 是节点名称，`props` 是它的属性，例如[提及](./mention)。没有添加对应扩展时，这样的片段会被忽略。
- 格式、链接和颜色都相同的相邻片段会合并成一个。

代码块里的文字不带格式，换行直接写在 `text` 里。分隔线没有文字，`content` 为空数组。
