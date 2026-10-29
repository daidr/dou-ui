# Tour 漫游引导

逐步指向页面上的元素并加以说明，用于介绍新功能或首次使用的引导。

## 基础用法

`steps` 是步骤数组，每一步用 `target` 指定要指向的元素，可以是选择器、元素，或返回元素的函数。打开后页面变暗，目标周围留出一圈亮区，说明卡片放在旁边。用 `v-model:open` 控制显示。

<DocDemo src="tour/basic" />

指向组件时用模板引用取 `$el`，写成函数可以保证打开时元素已经渲染。目标不在可视区域时会先滚动到中间。

## 居中步骤与自定义按钮

没有 `target` 的步骤显示在屏幕中间，适合开场与结尾。`actions` 插槽替换底部按钮，插槽参数里有 `prev`、`next`、`close` 与当前序号。`v-model:current` 绑定当前步骤，可以用它从头开始。

<DocDemo src="tour/center" />

DouTour 不记录用户是否看过引导。需要"只显示一次"时，在 `finish` 和 `close` 事件里自己保存状态，下次不再打开。

## 遮罩与关闭

- `mask` 设为 `false` 不变暗页面，只保留目标外的细环；也可以在单个步骤上设置 `mask`。
- 目标所在的亮区可以正常点击。`close-on-mask` 开启后，点击变暗区域会关闭引导。
- `Esc` 关闭引导，`close-on-escape` 设为 `false` 可以关掉这个行为。
- 焦点在卡片上时，左右方向键切换步骤。

## 可访问性

卡片是 `role="dialog"`，以步骤标题命名，说明文字通过 `aria-describedby` 关联。打开和切换步骤时焦点移到卡片上，关闭后回到打开前的位置。

## API

### Props

| 名称            | 说明                             | 类型                             | 默认值     |
| --------------- | -------------------------------- | -------------------------------- | ---------- |
| `steps`         | 步骤                             | `TourStep[]`                     | —          |
| `open`          | 是否显示，配合 `v-model:open`    | `boolean`                        | `false`    |
| `current`       | 当前步骤，配合 `v-model:current` | `number`                         | `0`        |
| `mask`          | 变暗目标以外的区域               | `boolean`                        | `true`     |
| `closeOnMask`   | 点击变暗区域时关闭               | `boolean`                        | `false`    |
| `closeOnEscape` | 按 `Esc` 关闭                    | `boolean`                        | `true`     |
| `placement`     | 卡片相对目标的默认位置           | `Placement`                      | `'bottom'` |
| `padding`       | 亮区比目标向外多出的距离（px）   | `number`                         | `6`        |
| `showProgress`  | 底部显示"当前 / 总数"            | `boolean`                        | `true`     |
| `teleport`      | 渲染位置，`false` 为原地渲染     | `string \| HTMLElement \| false` | `'body'`   |

### TourStep

| 名称          | 说明                               | 类型                                                   |
| ------------- | ---------------------------------- | ------------------------------------------------------ |
| `target`      | 指向的元素，不设置时显示在屏幕中间 | `string \| HTMLElement \| (() => HTMLElement \| null)` |
| `title`       | 标题                               | `string`                                               |
| `description` | 说明                               | `string`                                               |
| `placement`   | 这一步卡片的位置                   | `Placement`                                            |
| `mask`        | 这一步是否变暗页面                 | `boolean`                                              |

### Events

| 名称             | 说明                                     | 参数                |
| ---------------- | ---------------------------------------- | ------------------- |
| `update:open`    | 打开或关闭                               | `(open: boolean)`   |
| `update:current` | 切换步骤                                 | `(current: number)` |
| `change`         | 切换步骤                                 | `(current: number)` |
| `finish`         | 在最后一步按下"完成"                     | —                   |
| `close`          | 中途关闭：关闭按钮、`Esc` 或点击变暗区域 | —                   |

### Slots

| 名称      | 说明         | 参数                                          |
| --------- | ------------ | --------------------------------------------- |
| `default` | 替换说明     | `{ step, current, total }`                    |
| `title`   | 替换标题     | `{ step, current, total }`                    |
| `actions` | 替换底部按钮 | `{ step, current, total, prev, next, close }` |

### 实例方法

| 名称      | 说明                   |
| --------- | ---------------------- |
| `next()`  | 下一步，最后一步时完成 |
| `prev()`  | 上一步                 |
| `close()` | 关闭                   |
