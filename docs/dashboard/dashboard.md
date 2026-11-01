---
wide: true
---

# 仪表盘

`DouDashboard` 在[网格布局](./index.md)之上加了格子的内容：每个格子有一个类型，由你注册的组件绘制；编辑时可以添加、拖动、缩放、复制、删除格子，改标题和设置，所有修改都能撤销。整个仪表盘是一份 JSON 文档，通过 `v-model` 读写，保存和读取由应用自己完成。

## 基础用法

打开“编辑”后，从左边的列表把格子拖进来，或点一下加到第一个空位；拖动标题栏移动格子，双击标题改名，标题栏右边的菜单里有设置、复制和删除。关掉“编辑”就是查看模式，只能看和全屏查看：

<DocDemo src="dashboard/designer" />

## 文档

`v-model` 绑定的文档长这样：

```ts
const doc = ref<DashboardDocument>({
  version: 1,
  widgets: [
    {
      id: 'orders',
      type: 'stat',
      title: '今日订单',
      props: { value: 1286, suffix: '单' },
      place: { lg: { x: 0, y: 0, w: 3, h: 2 } },
    },
  ],
})
```

- `type` 是注册过的格子类型，`props` 是这个格子自己的设置，都必须能被 `JSON.stringify` 保存。
- `title` 可以不写，这时标题栏显示类型的名称。
- `place` 按断点记录位置，单位是列和行。最宽断点（默认 `lg`）的位置是主位置；较窄的断点没有记录时，按主位置推算，在那个断点上拖动过之后才会写进去。缺少主位置的格子放在第一个放得下的地方。

每次修改都会得到一个新的文档对象，没有改动的格子保持原来的对象，可以直接比较引用。

## 格子类型

用 `defineDashboardWidget` 声明一种格子，再把它们放进 `widgets` 属性：

```ts
import { defineDashboardWidget } from '@dou-ui/dashboard'
import { ActivityIcon } from '@dou-ui/icons'

const stat = defineDashboardWidget({
  type: 'stat',
  label: '统计数字',
  icon: ActivityIcon,
  size: { w: 3, h: 2, minW: 2, minH: 2 },
  defaultProps: { value: 0, suffix: '' },
  component: StatWidget,
  settings: StatSettings,
})
```

| 字段           | 说明                                                                            |
| -------------- | ------------------------------------------------------------------------------- |
| `type`         | 存进格子的 `type`                                                               |
| `label`        | 在添加列表里显示的名称，也是没有标题的格子的标题                                |
| `icon`         | 添加列表里名称前的图标                                                          |
| `size`         | 新格子的大小，以及缩放时的限制 `minW`、`maxW`、`minH`、`maxH`；默认 4 × 3       |
| `defaultProps` | 新格子的 `props`，可以是对象或返回对象的函数                                    |
| `component`    | 绘制格子内容的组件                                                              |
| `settings`     | 设置面板里的表单组件，用 `v-model` 绑定格子的 `props`；不填时设置面板里只有标题 |
| `fullscreen`   | 能否全屏查看，默认 `true`                                                       |

## 在格子里读取设置

格子的组件不接收 props，而是调用 `useDashboardWidget()` 拿到所在格子的信息：

```vue
<script setup>
import { useDashboardWidget } from '@dou-ui/dashboard'

const { props, size, editing, setProps } = useDashboardWidget()
</script>

<template>
  <DouSparkline :data="props.points" :width="size.width.value" :height="size.height.value" />
</template>
```

- `props`：格子的设置，没有时是 `{}`。
- `size`：内容区域的宽高（像素），格子缩放、窗口变化时更新。
- `editing`：仪表盘是否在编辑；`fullscreen`：是否是全屏查看里的那一份。
- `setProps(patch)`：把几个键合并进 `props`，算作一次可以撤销的修改。连续的修改传同一个 `group`，一秒内的会合并成一步撤销。

设置面板里的组件也能调用 `useDashboardWidget()`。

## 加载、出错与空态

格子在取数据时调用 `setStatus`，外框会在内容上方显示对应的状态，不会挤动内容：

```ts
const { setStatus } = useDashboardWidget()

setStatus('loading')
try {
  rows.value = await load()
  setStatus(rows.value.length ? 'ready' : 'empty')
} catch {
  setStatus('error', { message: '服务暂时不可用', retry: reload })
}
```

加载状态在 120ms 之后才出现，很快完成的请求不会闪一下；旧内容在加载时仍然可见，只是变淡。`error` 传了 `retry` 时显示“重试”按钮。

下面左边的格子第一次取数会失败，点“重试”后成功；右边的格子没有数据，显示空态：

<DocDemo src="dashboard/status" />

## 添加格子

`DouDashboardPalette` 列出注册的格子类型，`for` 指向仪表盘的组件实例。列表里的每一项都是按钮：拖到仪表盘上放在松手的位置，点击或按 Enter 放到第一个空位，然后焦点移到新格子上，键盘和读屏用户也能添加。不在编辑模式时按钮不可用。

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

| 按键                      | 作用                                   |
| ------------------------- | -------------------------------------- |
| Delete / Backspace        | 删除有焦点的格子，焦点移到下一个格子   |
| Mod + D                   | 在旁边复制一份有焦点的格子             |
| Mod + C / Mod + X         | 复制、剪切有焦点的格子                 |
| Mod + V                   | 粘贴格子，放在有焦点的格子旁边或空位里 |
| Mod + Z                   | 撤销                                   |
| Mod + Shift + Z / Mod + Y | 重做                                   |

Mod 在 macOS 上是 ⌘，在其他系统上是 Ctrl。焦点在输入框里时，这些按键交给输入框。添加、删除格子后会由读屏播报。

复制的格子以 JSON 文本放进剪贴板，可以在两个仪表盘之间粘贴，类型没有注册时忽略。

## 撤销与修改文档

实例的 `undo()`、`redo()` 以及 `canUndo`、`canRedo` 可以用来做工具栏按钮，示例里的撤销、重做就是这样做的。

要在代码里修改文档，可以直接给 `v-model` 赋一份新文档，但这样会清空撤销记录。想让修改也能撤销，用 `transaction()` 拿到一个事务，在上面添加、删除、修改格子，再交给 `dispatch`，和表单设计器的写法一样：

```ts
const tr = dashboard.value.transaction()
tr.update('orders', { title: '本周订单' }).remove('memo')
tr.setMeta('origin', 'toolbar')
dashboard.value.dispatch(tr)
```

事务的方法有 `add(widget, index?)`、`remove(id)`、`update(id, patch)`：`patch` 里值为 `undefined` 的键会被删掉，`id` 和 `type` 不能改；什么都没改变的步骤会被忽略。一个事务算作一次修改、一步撤销；`meta.group` 相同且间隔不到一秒的修改合并成一步。事务必须基于当前文档创建，文档已经变了再提交会报错。

每次修改都会触发 `change`，参数就是这个事务：修改后的文档 `doc`、步骤 `steps`、撤销它的步骤 `inverse` 和 `meta`（其中 `origin` 是来源，例如 `layout`、`settings`、`drop`）。

`applySteps(doc, steps)` 一次应用一组步骤并返回事务，不经过组件，可以在服务端或测试里使用，也可以重放保存下来的 `steps`。

## 检查与迁移

保存或展示一份文档之前，可以先检查：

```ts
import { checkDocument, migrateDocument } from '@dou-ui/dashboard'

const doc = migrateDocument(JSON.parse(saved))
const problems = checkDocument(doc, { widgets })
```

`checkDocument` 找出版本不对、缺少或重复的 id、没有注册的类型，以及不是整格的位置，每一项带 `code`、`path` 和出问题的 `widgetId`。`migrateDocument` 补全旧文档或手写文档缺少的部分（`version`、`place`），丢掉不是对象的格子和不合法的位置；遇到比当前更新的版本时报错。

## API

### Dashboard Props

| 名称            | 说明                                          | 类型                               | 默认值                         |
| --------------- | --------------------------------------------- | ---------------------------------- | ------------------------------ |
| `v-model`       | 仪表盘文档                                    | `DashboardDocument`                | `{ version: 1, widgets: [] }`  |
| `widgets`       | 注册的格子类型                                | `DashboardWidgetType[]`            | `[]`                           |
| `editable`      | 能否添加、移动、缩放、修改和删除格子          | `boolean`                          | `false`                        |
| `columns`       | 列数：一个数字，或按断点分别给出              | `number \| Record<string, number>` | `{ lg: 12, md: 6, sm: 1 }`     |
| `breakpoints`   | 每个断点从多宽开始（仪表盘自身的宽度）        | `Record<string, number>`           | `{ lg: 1024, md: 640, sm: 0 }` |
| `row-height`    | 一行的高度（px）                              | `number`                           | `80`                           |
| `gap`           | 格子之间的间距（px），或 `[横向, 纵向]`       | `number \| [number, number]`       | `16`                           |
| `compact`       | `'vertical'` 自动往上靠，`false` 自由摆放     | `'vertical' \| false`              | `'vertical'`                   |
| `label`         | 仪表盘的无障碍名称                            | `string`                           | —                              |
| `messages`      | 替换语言包里的文字                            | `DashboardMessagesOverride`        | —                              |
| `create-id`     | 生成新格子的 id                               | `(type: string) => string`         | 类型加几个随机字母             |
| `collaboration` | 与他人协同编辑，见[协同编辑](./collaboration) | `DashboardCollaboration`           | —                              |

### Dashboard Events

| 名称               | 说明         | 参数                                    |
| ------------------ | ------------ | --------------------------------------- |
| `change`           | 每次修改之后 | `{ before, doc, steps, inverse, meta }` |
| `breakpointChange` | 断点变化时   | `string`                                |

### Dashboard Methods

| 名称                       | 说明                                                     |
| -------------------------- | -------------------------------------------------------- |
| `transaction()`            | 基于当前文档创建事务                                     |
| `dispatch(tr)`             | 提交事务，算作一次修改                                   |
| `undo()` / `redo()`        | 撤销、重做，没有可做的时返回 `false`                     |
| `canUndo` / `canRedo`      | 能否撤销、重做                                           |
| `addWidget(type, options)` | 添加格子，`options` 可给 `at`、`title`、`props`、`focus` |
| `removeWidget(id)`         | 删除格子                                                 |
| `duplicateWidget(id)`      | 在旁边复制一份                                           |
| `focusWidget(id)`          | 把焦点移到格子上                                         |
| `openSettings(id)`         | 打开格子的设置面板（编辑时）                             |
| `openFullscreen(id)`       | 全屏查看格子                                             |
| `startAdd(event, type)`    | 在外部元素的 `pointerdown` 里调用，开始拖入一个新格子    |
| `types`                    | 注册的格子类型                                           |
| `breakpoint`               | 当前断点                                                 |

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

### useDashboardWidget

| 名称                         | 说明                                                     |
| ---------------------------- | -------------------------------------------------------- |
| `widget`                     | 文档里的这个格子                                         |
| `props`                      | 格子的设置                                               |
| `editing`                    | 仪表盘是否在编辑                                         |
| `fullscreen`                 | 是否是全屏查看里的那一份                                 |
| `size`                       | `{ width, height }`，内容区域的大小（px）                |
| `setProps(patch, options?)`  | 合并进 `props`；`options.group` 让连续修改合并成一步撤销 |
| `status`                     | 当前状态 `{ state, message?, retry? }`                   |
| `setStatus(state, options?)` | 设为 `'ready'`、`'loading'`、`'error'` 或 `'empty'`      |

数据和筛选相关的 `data`、`error`、`filters`、`setFilter`、`ownFilters`、`refresh` 见[数据与筛选](./data#usedashboardwidget)。
