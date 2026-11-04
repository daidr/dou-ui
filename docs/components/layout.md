# Layout 布局

用于搭建页面的基本结构，包括顶栏、侧栏、主区和页脚。

## 基础用法

`DouLayoutHeader`、`DouLayoutAside`、`DouLayoutMain`、`DouLayoutFooter` 分别渲染为 `<header>`、`<aside>`、`<main>` 与 `<footer>`，页面的地标随之而来。

<DocDemo src="layout/basic" column style="padding: 0; overflow: hidden" />

侧栏写在主区后面时就在右侧，分隔线自动换到朝向主区的那一边。

## 可收起的侧栏

`collapsible` 在侧栏底部放一个收起 / 展开按钮，状态用 `v-model:collapsed` 绑定；收起后宽度变为 `collapsedWidth`（默认 64px）。默认插槽拿得到 `collapsed`，直接传给 [Menu](./menu) 的 `collapsed`，菜单就缩成一列图标。`footer` 插槽固定在内容下方，适合放账户信息。

<DocDemo src="layout/collapsible-aside" column style="padding: 0; overflow: hidden" />

## 窄屏时变成抽屉

窄屏上没有足够的空间并排显示侧栏。给 `DouLayoutAside` 设 `breakpoint`（[断点](../guide/breakpoints)名称如 `'md'`，或以 px 为单位的数字），视口窄于它时侧栏隐藏，改为从边缘滑出的抽屉；在顶栏放一个 `DouLayoutAsideTrigger`，它只在抽屉模式下出现，点击打开抽屉。抽屉的开合也可以用 `v-model:open` 控制，`side="right"` 让它从右边滑出。

默认插槽多了 `drawer` 与 `close` 两个参数：在抽屉里选完菜单项后调用 `close()` 收起抽屉。服务端渲染时不知道视口宽度，页面先按宽屏渲染，挂载后再切换。

下面的开关把断点设得足够大，用来在宽屏上模拟窄屏：

<DocDemo src="layout/drawer" column />

## 吸顶

整页滚动时，`DouLayoutHeader` 加 `sticky` 停在顶部；`DouLayoutAside` 加 `sticky` 则停在顶栏下方、占满剩下的视口高度，侧栏内容过长时自己滚动。两者在同一个外层 `DouLayout` 里时，侧栏会自动让出顶栏的高度。

```vue
<DouLayout>
  <DouLayoutHeader sticky>…</DouLayoutHeader>
  <DouLayout>
    <DouLayoutAside sticky>…</DouLayoutAside>
    <DouLayoutMain>很长的页面内容</DouLayoutMain>
  </DouLayout>
</DouLayout>
```

主区的内边距来自 CSS 变量 `--dou-layout-main-padding`（默认 24px），顶栏与页脚的左右内边距来自 `--dou-layout-padding-x`（默认 20px）。侧栏正文和底部的内边距来自 `--dou-layout-aside-padding`（默认 8px）。侧栏里放一棵贴边的树或菜单时，可以把它设为 0：

```css
.dou-layout-aside,
.dou-layout-aside-drawer {
  --dou-layout-aside-padding: 0px;
}
```

窄屏下侧栏会作为抽屉挂到 `body` 上，抽屉的类名是 `dou-layout-aside-drawer`，所以选择器里要把它也写上。分隔线的颜色分别来自 `--dou-layout-header-border`、`--dou-layout-aside-border`、`--dou-layout-footer-border`（默认 `var(--dou-color-border-subtle)`），想去掉分隔线时用各自的 `bordered`。

## API

### LayoutHeader Props

| 名称       | 说明               | 类型               | 默认值  |
| ---------- | ------------------ | ------------------ | ------- |
| `height`   | 高度，数字为 px    | `number \| string` | `56`    |
| `sticky`   | 页面滚动时停在顶部 | `boolean`          | `false` |
| `bordered` | 底部的分隔线       | `boolean`          | `true`  |

### LayoutFooter Props

| 名称       | 说明         | 类型      | 默认值 |
| ---------- | ------------ | --------- | ------ |
| `bordered` | 顶部的分隔线 | `boolean` | `true` |

### LayoutAside Props

| 名称                   | 说明                                | 类型                   | 默认值   |
| ---------------------- | ----------------------------------- | ---------------------- | -------- |
| `width`                | 展开时的宽度，数字为 px             | `number \| string`     | `240`    |
| `collapsedWidth`       | 收起时的宽度，数字为 px             | `number \| string`     | `64`     |
| `collapsed`（v-model） | 是否收起                            | `boolean`              | `false`  |
| `collapsible`          | 在底部显示收起 / 展开按钮           | `boolean`              | `false`  |
| `sticky`               | 停在（吸顶的）顶栏下方              | `boolean`              | `false`  |
| `bordered`             | 朝向主区一侧的分隔线                | `boolean`              | `true`   |
| `breakpoint`           | 视口窄于它时变成抽屉，断点名称或 px | `Breakpoint \| number` | —        |
| `side`                 | 抽屉从哪一边滑出                    | `'left' \| 'right'`    | `'left'` |
| `open`（v-model）      | 抽屉模式下是否打开                  | `boolean`              | `false`  |

### LayoutAside Slots

| 名称      | 说明                                          |
| --------- | --------------------------------------------- |
| `default` | 侧栏内容，参数 `{ collapsed, drawer, close }` |
| `footer`  | 固定在底部的内容，参数同上                    |

### LayoutAsideTrigger Props

只在同一个布局里有侧栏处于抽屉模式时显示，点击打开或关闭抽屉。

| 名称   | 说明 | 类型                   | 默认值 |
| ------ | ---- | ---------------------- | ------ |
| `size` | 尺寸 | `'sm' \| 'md' \| 'lg'` | `'md'` |

### 键盘与读屏

- 各部分渲染为对应的 HTML 地标元素，读屏可以按地标跳转。
- 收起按钮的标签随状态在“收起侧栏”与“展开侧栏”之间切换，并带 `aria-expanded`。
- 抽屉模式下侧栏是一个模态对话框，焦点被限制在里面，`Esc` 或点遮罩关闭；打开按钮带 `aria-expanded` 与 `aria-controls`。
