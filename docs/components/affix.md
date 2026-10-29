# Affix 固钉

滚动时把元素固定在视口边缘，例如页内目录、表格上方的工具栏。固定后原位置会保留占位，后面的内容不会跳动。

## 基础用法

<DocDemo src="affix/basic" />

向下滚动这一页，按钮会在距离顶部 72px（文档站导航栏的高度）处停住。

## 钉在底部

`offset-bottom` 让内容在快要从底部离开时钉住，适合长表单底部的保存栏。

```vue
<DouAffix :offset-bottom="16">
  <div class="save-bar">…</div>
</DouAffix>
```

## 滚动容器

默认监听最近一个可滚动的祖先元素，没有就是窗口。`target` 可以指定：一个元素、一个选择器，或返回元素的函数。在容器里钉住时，钉在容器可见区域的边缘。

```vue
<DouAffix target="#panel" :offset-top="8">…</DouAffix>
```

## 注意

钉住后内容使用 `position: fixed`。如果某个祖先元素设置了 `transform`、`filter` 或 `contain`，`fixed` 会相对那个祖先定位，此时请改用 CSS 的 `position: sticky`。布局变化（例如侧栏收起）后宽度会通过 `ResizeObserver` 自动更新，也可以调用暴露的 `update()`。

## API

### Affix Props

| 名称           | 说明                             | 类型                                                   | 默认值         |
| -------------- | -------------------------------- | ------------------------------------------------------ | -------------- |
| `offsetTop`    | 距离滚动区域顶部多远时钉住（px） | `number`                                               | `0`            |
| `offsetBottom` | 改为钉在底部，距离底部多远（px） | `number`                                               | —              |
| `target`       | 滚动区域                         | `string \| HTMLElement \| Window \| () => HTMLElement` | 最近的滚动祖先 |

### Affix Events

| 名称     | 说明           | 参数               |
| -------- | -------------- | ------------------ |
| `change` | 钉住或取消钉住 | `(fixed: boolean)` |

### Affix Expose

| 名称       | 说明     |
| ---------- | -------- |
| `update()` | 重新测量 |
