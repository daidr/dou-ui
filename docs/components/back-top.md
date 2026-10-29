# BackTop 回到顶部

页面滚得足够远之后，右下角浮起一个圆形按钮，点击平滑地回到顶部。和浮层同一套描边与阴影，墨色箭头；系统开启"减少动态效果"时直接跳回顶部。

## 基础用法

<DouBackTop :visibility-height="300" />

```vue
<DouBackTop />
```

这一页就有一个：向下滚动 300px 后它会出现在右下角。默认滚动 400px 后出现（`visibility-height`），距离右边和底部各 24px（`right`、`bottom`）。

## 自定义内容

默认插槽替换箭头，例如加上文字；按钮会按内容变宽。

```vue
<DouBackTop>
  <ArrowUpIcon />
  顶部
</DouBackTop>
```

## 滚动容器

`target` 指定监听哪个容器的滚动，可以是元素、选择器或返回元素的函数，默认是窗口。

```vue
<DouBackTop target="#log-panel" :visibility-height="200" />
```

## 读屏

按钮的名称来自语言包（"回到顶部"），在隐藏时不可聚焦。

## API

### BackTop Props

| 名称               | 说明                 | 类型                                                   | 默认值   |
| ------------------ | -------------------- | ------------------------------------------------------ | -------- |
| `target`           | 滚动区域             | `string \| HTMLElement \| Window \| () => HTMLElement` | `window` |
| `visibilityHeight` | 滚动多远后出现（px） | `number`                                               | `400`    |
| `right`            | 距离视口右边（px）   | `number`                                               | `24`     |
| `bottom`           | 距离视口底部（px）   | `number`                                               | `24`     |

### BackTop Events

| 名称    | 说明     | 参数                  |
| ------- | -------- | --------------------- |
| `click` | 点击按钮 | `(event: MouseEvent)` |
