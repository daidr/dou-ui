# 文字颜色与对齐

`editorKit()` 默认包含文字颜色、背景色和对齐。选中文字后，格式工具栏里的“颜色”菜单可以设置文字颜色和背景色，“对齐”菜单可以让正文、标题和引用左对齐、居中或右对齐。块菜单里也有“对齐”。

<DocDemo src="editor/text-styles" column />

## 颜色

颜色来自一组固定的调色板：灰色、红色、橙色、黄色、绿色、蓝色、紫色和粉色，在亮色和暗色主题下分别取不同的色值。调色板以外的颜色名会被丢掉，开发环境下会给出提示。文档里只保存颜色名，例如 `{ type: 'text', text: '上海', color: 'red' }`，所以切换主题或调整调色板后，已有的文档会跟着变化。

选“默认”去掉颜色。用代码设置时调用 `setTextColor` 和 `setHighlight`，参数是颜色名或 `null`：

```ts
import { setHighlight, setTextColor } from '@dou-ui/editor'

editor.value.run(setTextColor('blue'))
editor.value.run(setHighlight(null))
```

`textColors` 是调色板里全部颜色名的数组，`TextColor` 是颜色名的类型。调色板的色值由 CSS 变量决定，见下方 [CSS 变量](#css-变量)。

## 对齐

对齐保存在块的 `props.align` 里，取值为 `'center'` 或 `'right'`。左对齐就是按书写方向排列，不保存：`props` 里没有 `align` 这一项。用 `setAlign('left')`、粘贴 `text-align: left` 的内容或在 `v-model` 里写 `align: 'left'` 时，也都存成没有这一项。其他取值（例如 `'justify'`）会被丢掉，开发环境下会给出提示；不能对齐的块（例如代码块）上的 `align` 同样会被丢掉，导出 HTML 时也不会写出。转换块的类型时对齐保持不变，转换成不能对齐的类型（例如代码块）时会去掉。

```ts
import { setAlign } from '@dou-ui/editor'

editor.value.run(setAlign('center')) // 选中的块
editor.value.run(setAlign(null, 'block-id')) // 指定的块，恢复默认
```

`currentAlign(state)` 返回选中的块共同的对齐方式：都没有设置时是 `null`，各不相同时是 `'mixed'`，选中的块都不能对齐时是 `undefined`。自定义的文字块也可以支持对齐：用 `alignable(spec)` 包一层节点定义，它会加上 `align` 属性，并处理粘贴和输出。

## 导入与导出

- HTML：颜色写成 `<span data-color="red">` 和 `<mark data-color="yellow">`，对齐写成 `style="text-align: center"`，读入时都能还原。从其他地方粘贴的 `text-align` 和 `<mark>` 也会保留，`<mark>` 没有颜色时按黄色处理；调色板以外的颜色会被忽略。
- Markdown：颜色以同样的 HTML 标签写在文字里，读回时保留。Markdown 没有对齐的写法，导出时对齐会丢失。
- 协同编辑：颜色和对齐都会同步给其他人。

## 在编辑器外显示

导出的 HTML 里只有颜色名，没有色值，所以颜色能跟着主题和调色板变化。在编辑器外显示这段 HTML 时，引入编辑器的样式表，再给外层容器加上 `dou-editor-palette` 类，就会使用同样的调色板：

```vue
<template>
  <article class="dou-editor-palette" v-html="html" />
</template>
```

不引入编辑器样式表时，可以复制下面的 CSS，并把色值换成自己的：

```css
.my-article span[data-color='red'] {
  color: #b4453f;
}
.my-article mark[data-color] {
  color: inherit;
  border-radius: 2px;
}
.my-article mark[data-color='yellow'] {
  background-color: #f8efc8;
}
/* gray、orange、green、blue、purple、pink 照此补全 */
```

在服务端用 `blocksToHTML` 生成的 HTML 也是同样的结构。

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

这些变量要写在编辑器和它的菜单上，菜单里的颜色预览才会跟着变；用 `dou-editor-palette` 显示导出内容时，也写在这个类上：

```css
.dou-editor,
.dou-editor-menu,
.dou-editor-palette {
  --dou-editor-color-red: #a23b36;
  --dou-editor-highlight-yellow: #f5e9b8;
}
```
