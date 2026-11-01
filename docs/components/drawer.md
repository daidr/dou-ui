# Drawer 抽屉

从视口边缘滑出的面板，适合在不离开当前页面的情况下查看详情或编辑记录。属性和用法与 [对话框](./dialog) 基本一致。

除了位置与尺寸，抽屉的属性、事件与插槽和对话框一致。浮层的通用行为见 [浮层](../guide/overlays)。

## 基础用法

<DocDemo src="drawer/basic" />

## 尺寸

`size` 是左右抽屉的宽度、上下抽屉的高度；数字为 px。默认左右 400px、上下 320px，并且不会超出视口。

```vue
<DouDrawer v-model:open="open" :size="560" title="编辑" />
<DouDrawer v-model:open="open" placement="bottom" size="50vh" title="日志" />
```

内容超出时，只有中间的内容区滚动，标题与底部操作保持可见。

## 拖边调整大小

`resizable` 让抽屉的内侧边缘可以拖动，改变宽度（上下抽屉为高度），范围由 `minSize`（默认 200px）和 `maxSize`（默认视口减 48px）限定。新尺寸以 px 通过 `update:size` 传出，用 `v-model:size` 绑定即可记住。边缘也能用键盘聚焦：方向键每次 16px，按住 `Shift` 每次 64px，`Home` / `End` 到最小 / 最大。

<DocDemo src="drawer/resizable" />

## 滑动关闭

`swipeable` 让抽屉可以向它所在的边缘拖动来关闭：触摸时按住抽屉任意位置都可以，鼠标只能拖动标题栏或把手，以免影响选中文字。上下弹出的抽屉会显示一个把手。松手时按拖动距离和速度判断是关闭还是回到原位，关闭同样会经过 `beforeClose`。

内容区可以滚动时，只有滚到顶（向下关闭时）以后继续拖动才会拖动抽屉。输入框、文本域里的拖动不会触发；其他不希望触发的元素加上 `data-dou-no-swipe` 属性。

<DocDemo src="drawer/swipe" />

## 停靠点

`snapPoints` 设置抽屉可以停靠的几档尺寸，数字表示 px，`'40%'` 这样的百分比字符串表示占视口的比例，和 `size` 的写法一致。设置后 `size` 不再生效。抽屉每次打开时停在最小的一档，拖动松手后停到最近的一档，从最小一档继续往下拖就会关闭。当前停在哪一档用 `v-model:snap` 读写，值是 `snapPoints` 中的某一项；关闭后变为 `undefined`，打开前先赋值可以指定打开时停在哪一档。

尺寸随停靠点变化，所以底部操作在每一档都能看到。把手是一个按钮，点击切换到下一档，聚焦后用方向键调大或调小。

<DocDemo src="drawer/snap" />

## 键盘与读屏

与对话框相同：`role="dialog"`、`aria-modal="true"`，打开时焦点移入，`Tab` 在面板内循环，`Esc` 关闭后焦点回到打开前的元素。

## API

### Props

| 名称             | 说明                                        | 类型                                                | 默认值    |
| ---------------- | ------------------------------------------- | --------------------------------------------------- | --------- |
| `open`           | 是否打开，配合 `v-model:open`               | `boolean`                                           | `false`   |
| `title`          | 标题，同时为抽屉命名                        | `string`                                            | —         |
| `placement`      | 从哪一边滑出                                | `'right' \| 'left' \| 'top' \| 'bottom'`            | `'right'` |
| `size`           | 左右为宽度、上下为高度；数字为 px           | `string \| number`                                  | —         |
| `closable`       | 显示右上角的关闭按钮                        | `boolean`                                           | `true`    |
| `closeOnMask`    | 点击遮罩关闭                                | `boolean`                                           | `true`    |
| `closeOnEscape`  | 按 `Esc` 关闭                               | `boolean`                                           | `true`    |
| `lockScroll`     | 打开期间锁定页面滚动                        | `boolean`                                           | `true`    |
| `destroyOnClose` | 关闭后卸载内容                              | `boolean`                                           | `false`   |
| `beforeClose`    | 关闭前调用，返回 `false` 则保持打开         | `() => boolean \| void \| Promise<boolean \| void>` | —         |
| `teleport`       | 渲染到哪里；`false` 为原地渲染              | `string \| HTMLElement \| false`                    | `'body'`  |
| `resizable`      | 拖动内侧边缘调整大小，配合 `v-model:size`   | `boolean`                                           | `false`   |
| `minSize`        | 调整时的最小尺寸，px                        | `number`                                            | `200`     |
| `maxSize`        | 调整时的最大尺寸，px                        | `number`                                            | 视口减 48 |
| `swipeable`      | 向边缘拖动关闭                              | `boolean`                                           | `false`   |
| `snapPoints`     | 停靠的几档尺寸；数字为 px，百分比为视口比例 | `(number \| string)[]`                              | —         |
| `snap`           | 当前停靠点，配合 `v-model:snap`             | `number \| string`                                  | —         |

### Events

`update:open`、`open`、`opened`、`close`、`closed`，含义同 [对话框](./dialog#events)。另有 `update:size`，参数为调整后的尺寸（px）；`update:snap`，参数为新的停靠点，关闭后为 `undefined`。

### Slots

| 名称      | 说明                       |
| --------- | -------------------------- |
| `default` | 内容，超出时滚动           |
| `title`   | 标题，替代 `title`         |
| `footer`  | 底部操作；参数 `{ close }` |

### CSS 变量

| 变量                   | 说明       |
| ---------------------- | ---------- |
| `--dou-drawer-size`    | 宽度或高度 |
| `--dou-drawer-mask`    | 遮罩颜色   |
| `--dou-drawer-bg`      | 面板底色   |
| `--dou-drawer-padding` | 内边距     |
