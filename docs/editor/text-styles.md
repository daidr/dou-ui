# 文字颜色与对齐

`editorKit()` 默认包含文字颜色、背景色和对齐。选中文字后，格式工具栏里的“颜色”菜单可以设置文字颜色和背景色，“对齐”菜单可以让正文、标题和引用左对齐、居中或右对齐。块菜单里也有“对齐”。

<DocDemo src="editor/text-styles" column />

## 颜色

颜色来自一组固定的调色板：灰色、红色、橙色、黄色、绿色、蓝色、紫色和粉色，在亮色和暗色主题下分别取不同的色值。文档里只保存颜色名，例如 `{ type: 'text', text: '上海', color: 'red' }`，所以切换主题或调整调色板后，已有的文档会跟着变化。

选“默认”去掉颜色。用代码设置时调用 `setTextColor` 和 `setHighlight`，参数是颜色名或 `null`：

```ts
import { setHighlight, setTextColor } from '@dou-ui/editor'

editor.value.run(setTextColor('blue'))
editor.value.run(setHighlight(null))
```

`textColors` 是调色板里全部颜色名的数组。调色板的色值由 CSS 变量决定，见下方 [CSS 变量](#css-变量)。

## 对齐

对齐保存在块的 `props.align` 里，取值为 `'left'`、`'center'` 或 `'right'`；没有设置时不出现这一项，文字按书写方向排列。转换块的类型时对齐保持不变，转换成不能对齐的类型（例如代码块）时会去掉。

```ts
import { setAlign } from '@dou-ui/editor'

editor.value.run(setAlign('center')) // 选中的块
editor.value.run(setAlign(null, 'block-id')) // 指定的块，恢复默认
```

`currentAlign(state)` 返回选中的块共同的对齐方式。自定义的文字块也可以支持对齐：用 `alignable(spec)` 包一层节点定义，它会加上 `align` 属性，并处理粘贴和输出。

## 导入与导出

- HTML：颜色写成 `<span data-color="red">` 和 `<mark data-color="yellow">`，对齐写成 `style="text-align: center"`，读入时都能还原。从其他地方粘贴的 `text-align` 和 `<mark>` 也会保留，`<mark>` 没有颜色时按黄色处理；调色板以外的颜色会被忽略。
- Markdown：颜色以同样的 HTML 标签写在文字里，读回时保留。Markdown 没有对齐的写法，导出时对齐会丢失。
- 协同编辑：颜色和对齐都会同步给其他人。

## 不使用

不需要颜色或对齐时，在 `editorKit` 里关掉对应部分，工具栏和块菜单里的入口也会一起消失：

```ts
const extensions = editorKit({ colors: false, align: false })
```

## CSS 变量

| 名称                            | 说明                                         |
| ------------------------------- | -------------------------------------------- |
| `--dou-editor-color-<名称>`     | 文字颜色，例如 `--dou-editor-color-red`      |
| `--dou-editor-highlight-<名称>` | 背景色，例如 `--dou-editor-highlight-yellow` |
