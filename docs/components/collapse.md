# Collapse 折叠面板

把内容收起到可以展开的标题下，适合常见问题、分组设置等较长的内容。

## 基础用法

<DocDemo src="collapse/basic" column />

`v-model` 绑定展开项的 `value` 数组。面板内容在第一次展开时才渲染，之后收起也会保留。

## 手风琴与边框

`accordion` 让同一时间最多展开一项；`bordered` 把各项放进一个带细描边的容器。`extra` 插槽放在标题行末尾，不属于展开按钮。

<DocDemo src="collapse/accordion" column />

## 自定义内容的展开动画

`DouCollapseTransition` 是折叠面板和菜单使用的高度过渡，可以包裹自己的内容。内容用 `v-if` 或 `v-show` 控制显示。

<DocDemo src="collapse/transition" column />

## 键盘与读屏

每个标题是一个原生按钮，放在 `role="heading"` 里（层级由 `headingLevel` 决定，默认 3），带 `aria-expanded` 与 `aria-controls`。面板是 `role="region"`，通过 `aria-labelledby` 指回标题。`Tab` 在标题之间移动，`Enter` / `Space` 展开或收起。

## API

### Collapse Props

| 名称           | 说明                       | 类型                    | 默认值  |
| -------------- | -------------------------- | ----------------------- | ------- |
| `modelValue`   | 展开项的值，配合 `v-model` | `(string \| number)[]`  | `[]`    |
| `accordion`    | 同一时间最多展开一项       | `boolean`               | `false` |
| `bordered`     | 带描边的容器               | `boolean`               | `false` |
| `headingLevel` | 标题在页面大纲中的层级     | `2 \| 3 \| 4 \| 5 \| 6` | `3`     |

### Collapse Events

| 名称                | 说明                   | 参数                                       |
| ------------------- | ---------------------- | ------------------------------------------ |
| `update:modelValue` | 展开项变化             | `(value: (string \| number)[])`            |
| `change`            | 用户展开或收起了某一项 | `(value: string \| number, open: boolean)` |

### CollapseItem Props

| 名称       | 说明     | 类型               | 默认值  |
| ---------- | -------- | ------------------ | ------- |
| `value`    | 项的值   | `string \| number` | —       |
| `title`    | 标题文字 | `string`           | `value` |
| `disabled` | 禁用     | `boolean`          | `false` |

### CollapseItem Slots

| 名称      | 说明                            |
| --------- | ------------------------------- |
| `default` | 面板内容                        |
| `title`   | 替换标题文字，参数为 `{ open }` |
| `extra`   | 标题行末尾的内容                |

### CSS 变量

| 变量                              | 说明               |
| --------------------------------- | ------------------ |
| `--dou-collapse-padding-x`        | 水平内边距         |
| `--dou-collapse-header-padding-y` | 标题行的垂直内边距 |
| `--dou-collapse-border`           | 分隔线与边框颜色   |
| `--dou-collapse-indent`           | 面板内容的缩进     |

面板内容默认和标题文字对齐，缩进等于箭头宽度加上箭头与标题的间距。想让内容从箭头下方开始，或者缩进得更深，给组件加一个类名，在这个类名上覆盖变量（原因见[去掉外框与调整内边距](/guide/theming#去掉外框与调整内边距)）：

```vue
<DouCollapse class="faq">…</DouCollapse>
```

```css
.faq {
  --dou-collapse-indent: 0px;
}
```

缩进加在水平内边距之后，`bordered` 时内容离描边的距离是 `--dou-collapse-padding-x` 加上缩进。嵌套的 Collapse 各自使用默认缩进，不跟随外层，需要时给内层也加上类名。
