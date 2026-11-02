---
wide: true
---

# 仪表盘

`DouDashboard` 在[网格布局](./index.md)之上加了格子的内容：每个格子有一个类型，由你注册的组件绘制；编辑时可以添加、拖动、缩放、复制、删除格子，改标题和设置，所有修改都能撤销。整个仪表盘是一份 JSON 文档，通过 `v-model` 读写，保存和读取由应用自己完成。

## 基础用法

打开“编辑”后，从左边的列表把格子拖进来，或点一下加到第一个空位；拖动标题栏移动格子，双击标题改名，标题栏右边的菜单里有设置、复制和删除。关掉“编辑”后进入查看模式，只能看和全屏查看。

<DocDemo src="dashboard/designer" />

- `widgets` 是注册的格子类型，写法见[自定义格子](./custom-widgets)；也可以直接用[内置格子](./widgets)。
- `v-model` 绑定的文档格式见[文档与事务](./document)。
- 示例里的撤销、重做按钮用的是实例的 `undo()`、`redo()` 和 `canUndo`、`canRedo`。

## 添加格子

`DouDashboardPalette` 列出注册的格子类型，`for` 指向仪表盘的组件实例。列表里的每一项都是按钮：

- 拖到仪表盘上，放在松手的位置。
- 点击或按 Enter，放到第一个空位，然后焦点移到新格子上，键盘和读屏用户也能添加。
- 不在编辑模式时按钮不可用。

```vue
<DouDashboardPalette :for="dashboard" />
<DouDashboard ref="dashboard" v-model="doc" :widgets="widgets" editable />
```

`types` 可以只列出其中几种并指定顺序，`direction="horizontal"` 时横向排列。也可以不用这个组件，自己调用实例的 `addWidget(type, options)` 和 `startAdd(event, type)`。

## 编辑

`editable` 打开后：

- 拖动标题栏移动格子，拖动右边和下边缩放；手指按住标题栏片刻后再拖动。
- 双击标题改名，留空恢复为类型名称。
- 标题栏的菜单里有设置、全屏查看、导出（传了 `exporters` 时）、复制一份和删除。设置在右侧抽屉里打开，里面是标题和格子类型的 `settings` 表单，修改立即生效。
- 没有格子时显示提示，整块区域都可以拖入。

关闭 `editable` 后，格子不能移动，标题栏只保留全屏查看按钮（传了 `exporters` 时还有导出按钮）。

## 键盘

除了[网格布局的键盘操作](./index.md#键盘)，编辑时还可以：

| 按键                                             | 作用                                   |
| ------------------------------------------------ | -------------------------------------- |
| `Delete` / `Backspace`                           | 删除有焦点的格子，焦点移到下一个格子   |
| `Ctrl` / `⌘` + `D`                               | 在旁边复制一份有焦点的格子             |
| `Ctrl` / `⌘` + `C`、`Ctrl` / `⌘` + `X`           | 复制、剪切有焦点的格子                 |
| `Ctrl` / `⌘` + `V`                               | 粘贴格子，放在有焦点的格子旁边或空位里 |
| `Ctrl` / `⌘` + `Z`                               | 撤销                                   |
| `Ctrl` / `⌘` + `Shift` + `Z`、`Ctrl` / `⌘` + `Y` | 重做                                   |

- 焦点在输入框里时，这些按键交给输入框。
- 添加、删除格子后会由读屏播报。
- 复制的格子以 JSON 文本放进剪贴板，可以在两个仪表盘之间粘贴，类型没有注册时忽略。

## API

### Dashboard Props

| 名称            | 说明                                          | 类型                               | 默认值                         |
| --------------- | --------------------------------------------- | ---------------------------------- | ------------------------------ |
| `v-model`       | 仪表盘文档                                    | `DashboardDocument`                | `{ version: 1, widgets: [] }`  |
| `widgets`       | 注册的格子类型                                | `DashboardWidgetType[]`            | `[]`                           |
| `editable`      | 能否添加、移动、缩放、修改和删除格子          | `boolean`                          | `false`                        |
| `columns`       | 列数：一个数字，或按断点分别给出              | `number \| Record<string, number>` | `{ lg: 12, md: 6, sm: 1 }`     |
| `breakpoints`   | 每个断点从多宽开始（仪表盘自身的宽度）        | `Record<string, number>`           | `{ lg: 1024, md: 640, sm: 0 }` |
| `rowHeight`     | 一行的高度（px）                              | `number`                           | `80`                           |
| `gap`           | 格子之间的间距（px），或 `[横向, 纵向]`       | `number \| [number, number]`       | `16`                           |
| `compact`       | `'vertical'` 自动往上靠，`false` 自由摆放     | `'vertical' \| false`              | `'vertical'`                   |
| `label`         | 仪表盘的无障碍名称                            | `string`                           | —                              |
| `messages`      | 替换语言包里的文字                            | `DashboardMessagesOverride`        | —                              |
| `createId`      | 生成新格子的 id                               | `(type: string) => string`         | 类型加几个随机字母             |
| `collaboration` | 与他人协同编辑，见[协同编辑](./collaboration) | `DashboardCollaboration`           | —                              |

### Dashboard Events

| 名称               | 说明                                              | 参数                         |
| ------------------ | ------------------------------------------------- | ---------------------------- |
| `change`           | 每次修改之后，见[文档与事务](./document#修改文档) | `(tr: DashboardTransaction)` |
| `breakpointChange` | 断点变化时                                        | `(breakpoint: string)`       |

### Dashboard Exposes

修改文档的 `transaction`、`dispatch` 见[文档与事务](./document#api)，导出相关的见[导出与打印](./export#api)，筛选相关的见[数据与筛选](./data#api)。

| 名称                  | 说明                                                  | 类型                                                                   |
| --------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------- |
| `undo` / `redo`       | 撤销、重做，没有可做的时返回 `false`                  | `() => boolean`                                                        |
| `canUndo` / `canRedo` | 能否撤销、重做                                        | `boolean`                                                              |
| `addWidget`           | 添加格子，返回它的 id；类型没有注册时返回 `undefined` | `(type: string, options?: DashboardAddOptions) => string \| undefined` |
| `removeWidget`        | 删除格子                                              | `(id: string) => void`                                                 |
| `duplicateWidget`     | 在旁边复制一份，返回副本的 id                         | `(id: string) => string \| undefined`                                  |
| `focusWidget`         | 把焦点移到格子上                                      | `(id: string) => void`                                                 |
| `openSettings`        | 打开格子的设置面板（编辑时）                          | `(id: string) => void`                                                 |
| `openFullscreen`      | 全屏查看格子                                          | `(id: string) => void`                                                 |
| `startAdd`            | 在外部元素的 `pointerdown` 里调用，开始拖入一个新格子 | `(event: PointerEvent, type: string) => void`                          |
| `types`               | 注册的格子类型                                        | `readonly DashboardWidgetType[]`                                       |
| `breakpoint`          | 当前断点                                              | `string`                                                               |
| `editable`            | 当前能否编辑                                          | `boolean`                                                              |

### DashboardAddOptions

| 名称    | 说明                           | 类型                       | 默认值             |
| ------- | ------------------------------ | -------------------------- | ------------------ |
| `at`    | 在最宽断点上的位置             | `{ x: number; y: number }` | 第一个放得下的地方 |
| `title` | 标题                           | `string`                   | —                  |
| `props` | 合并到类型的 `defaultProps` 上 | `Record<string, unknown>`  | —                  |
| `focus` | 添加后把焦点移到新格子上       | `boolean`                  | `true`             |

### DashboardPalette Props

| 名称        | 说明                       | 类型                         | 默认值       |
| ----------- | -------------------------- | ---------------------------- | ------------ |
| `for`       | 要添加到的仪表盘实例       | `DashboardExpose \| null`    | —            |
| `types`     | 只列出这些类型，按这个顺序 | `string[]`                   | 全部         |
| `direction` | 排列方向                   | `'vertical' \| 'horizontal'` | `'vertical'` |

### DashboardPalette Slots

| 名称      | 说明                 | 参数       |
| --------- | -------------------- | ---------- |
| `default` | 替换按钮里显示的内容 | `{ type }` |
