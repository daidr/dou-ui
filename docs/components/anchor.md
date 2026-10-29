# Anchor 锚点导航

列出页面中的各个小节，点击跳转，滚动时高亮当前所在的小节。

## 基础用法

<DocDemo src="anchor/basic" />

`items` 的每一项是 `{ href: '#id', title, children? }`，`children` 缩进一级显示。`v-model` 是当前小节的链接，没有小节到达顶部时为空字符串。整页目录通常放进 [Affix](./affix) 或 `position: sticky` 的侧栏里，`target` 保持默认的窗口即可。

## 偏移与滚动容器

一个小节的标题滚到距离顶部 `offset` 像素的位置时，算作"读到了"，通常设为吸顶导航栏的高度再多一点。滚到页面最底部时，最后一节总会被选中，即使它的标题永远到不了顶部。

`target` 指定滚动容器（元素、选择器或返回元素的函数），默认是窗口。

## 点击跳转

点击链接会平滑滚动到对应小节，并把滚动停在 `offset` 下方，而不是被吸顶栏挡住；滚动途中高亮直接停在点中的那一项，不会一路闪过中间的小节。地址栏的 `#hash` 会随之更新（`update-hash` 为 `false` 时不更新），按住 `Ctrl` / `⌘` 点击仍按浏览器默认行为处理。

## 键盘与读屏

整个目录是带名称的 `<nav>`（默认"本页目录"），里面是嵌套的列表和普通链接，用 `Tab` 依次经过。当前小节的链接带 `aria-current="location"`。点击后焦点移到对应的标题上，键盘和读屏用户可以从那里接着读。

## API

### Anchor Props

| 名称         | 说明                                 | 类型                                                   | 默认值 |
| ------------ | ------------------------------------ | ------------------------------------------------------ | ------ |
| `items`      | 小节                                 | `AnchorItem[]`                                         | `[]`   |
| `modelValue` | 当前小节的链接，配合 `v-model`       | `string`                                               | `''`   |
| `offset`     | 标题到达距离顶部多远时算作读到（px） | `number`                                               | `0`    |
| `target`     | 滚动容器                             | `string \| HTMLElement \| Window \| () => HTMLElement` | 窗口   |
| `updateHash` | 点击时更新地址栏                     | `boolean`                                              | `true` |
| `ariaLabel`  | 导航的名称                           | `string`                                               | 语言包 |

### Anchor Events

| 名称                | 说明         | 参数                                    |
| ------------------- | ------------ | --------------------------------------- |
| `update:modelValue` | 当前小节变化 | `(href: string)`                        |
| `change`            | 当前小节变化 | `(href: string)`                        |
| `click`             | 点击链接     | `(event: MouseEvent, item: AnchorItem)` |

### Anchor Slots 与 Expose

插槽 `item` 替换每个链接的文字，参数为 `{ item, level, active }`。暴露 `scrollTo(href)` 与 `update()`（内容变化后重新计算当前小节）。
