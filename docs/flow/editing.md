# 编辑交互

编辑器自带从连线添加节点、右键菜单和选中节点上方的工具栏。添加节点的面板由你自己写，编辑器提供拖入节点的手势。

<DocDemo src="flow/editing" column />

## 拖入节点

在任意元素的 `pointerdown` 里调用 `startInsertDrag(type, event)`，就能从这里拖出一个节点：拖动时有一个跟随指针的预览，在画布上松手，节点加在松手的位置；按 `Esc` 取消。元素可以放在页面任何地方，不必在编辑器里面。点击添加用 `insertNode(type)`，拖动结束时的那次点击会被拦下，不会再加一个。

```vue
<button
  @pointerdown="editor.startInsertDrag('publish', $event)"
  @click="editor.insertNode('publish')"
>
  发布
</button>
```

在触屏上，手指直接滑动会滚动页面或面板，按住约 0.3 秒后预览出现，再拖到画布上。不需要给这些元素加 `touch-action`。

预览默认显示节点类型 `palette` 里的图标和名字，用 `ghost` 插槽可以换成自己的内容：

```vue
<DouFlowEditor>
  <template #ghost="{ spec, over }">
    <MyCard :type="spec.type" :dimmed="!over" />
  </template>
</DouFlowEditor>
```

`palette` 写在节点类型上，说明它在列表里怎么显示：

```ts
import { defaultNode, defineNodeType } from '@dou-ui/flow'
import { SendIcon } from '@dou-ui/icons'

const publish = defineNodeType({
  ...defaultNode,
  type: 'publish',
  defaults: () => ({ label: '发布', inputs: [{ id: 'in' }] }),
  palette: { label: '发布', icon: SendIcon, group: '结束' },
})
```

组件实例和 `useFlowEditor()` 上的 `paletteTypes` 按顺序列出所有写了 `palette` 的类型，可以直接用来渲染面板。

## 从连线添加节点

从端口拖出一条线，松手在空白处时，编辑器列出能接上这条线的节点类型，只有写了 `palette` 的类型会列出。选一个，新节点会加在松手的位置并连好。能不能接上按[连接规则](./ports)判断，和手动连线一样。

默认是一个可以搜索的列表。用 `quickAdd` 插槽可以换成自己的内容，浮层的位置和关闭方式不变：

```vue
<DouFlowEditor>
  <template #quickAdd="{ types, choose, close }">
    <button v-for="spec in types" :key="spec.type" @click="choose(spec.type)">
      {{ spec.palette.label }}
    </button>
  </template>
</DouFlowEditor>
```

`connectToCanvas` 事件先于这个列表触发，调用 `event.preventDefault()` 就不弹出列表，由你自己处理。

## 右键菜单

在节点、连线或空白处点右键，或者按键盘上的菜单键，会打开对应的菜单。触屏上长按空白处后松手也会打开。`flowKit()` 提供了这些项：

| 对象 | 菜单项                                                           |
| ---- | ---------------------------------------------------------------- |
| 空白 | 粘贴、全选、整理、适应画布                                       |
| 节点 | 复制、剪切、复制一份、删除、放进分组、调整层级；分组还有取消分组 |
| 连线 | 删除                                                             |

扩展可以用 `contextMenu` 加自己的项，`target.kind` 说明菜单打开在哪里。多个扩展的项按优先级排列，中间用分隔线隔开；`flowKit()` 的项排在最后。

```ts
const runFromHere = defineFlowExtension({
  name: 'run-from-here',
  contextMenu: (ctx, target) =>
    target.kind === 'node'
      ? [{ key: 'run', label: '从这里运行', icon: PlayIcon, run: () => run(target.node.id) }]
      : [],
})
```

`nodeContextmenu`、`edgeContextmenu` 和 `canvasContextmenu` 事件先于菜单触发，调用 `event.preventDefault()` 就不打开菜单。不需要内置菜单项时用 `flowKit({ menu: false })`。

## 工具栏

选中节点后，上方会出现一排按钮：复制一份、删除和打开节点菜单的“更多”。扩展用 `toolbarItems` 加按钮，拖动、连线和只读时不显示。不需要内置按钮时用 `flowKit({ toolbar: false })`。

只选中连线时，工具栏出现在连线上方，内置一个删除按钮，并尽量不盖住旁边的节点；扩展用 `edgeToolbarItems(ctx, edges)` 加按钮。

选中的内容不变时，文档每改一次，`toolbarItems` 和 `edgeToolbarItems` 都会重新调用一次，所以里面只根据传进来的节点或连线拼出按钮，不要做请求数据之类耗时的事；菜单要用的数据先放进节点的 `data` 或扩展自己的状态里。

一个按钮要给出几个选项时，用 `children` 代替 `run`，写上菜单项。编辑器在按钮下方弹出菜单，给按钮加上 `aria-haspopup` 和 `aria-expanded`，再点一次关上，点另一个按钮直接换成它的菜单。每一项都写了 `checked` 时，菜单是单选，读屏读作单选项；用键盘打开时焦点落在当前选中的那一项上。白板[连接线](./whiteboard#连接线)的走向、线型和箭头就是这样做的：

```ts
const size = defineFlowExtension({
  name: 'size',
  toolbarItems: (ctx, nodes) => [
    {
      key: 'size',
      label: '大小',
      icon: MaximizeIcon,
      children: (['sm', 'md', 'lg'] as const).map((value) => ({
        key: value,
        label: names[value],
        checked: nodes.every((node) => node.data?.size === value),
        run: () => resize(nodes, value),
      })),
    },
  ],
})
```

不在工具栏里的按钮可以调用 `ctx.showMenu(items, point, button)` 自己弹出菜单：菜单开在按钮下方，放不下时翻到按钮上方，再点一次按钮关上；`ctx.menuItems(target)` 返回右键菜单在某个目标上会显示的项，内置的“更多”按钮就是把它作为 `children`。

开关一类的按钮用 `pressed` 表示是否打开，编辑器据此给按钮加上按下的样式和 `aria-pressed`。按钮的操作也有快捷键时，把它写在 `shortcut` 里，提示中会显示出来。`shortcut` 只用于显示，按键要在 `keymap` 里绑定：

```ts
/** 固定或取消固定选中的节点 */
function togglePin(ctx: FlowExtensionContext) {
  // ...
}

const pin = defineFlowExtension({
  name: 'pin',
  toolbarItems: (ctx, nodes) => [
    {
      key: 'pin',
      label: '固定位置',
      icon: PinIcon,
      pressed: nodes.every((node) => node.locked),
      shortcut: 'shift+l',
      run: () => togglePin(ctx),
    },
  ],
  keymap: (ctx) => ({ 'shift+l': () => togglePin(ctx) }),
})
```

## 层级

节点重叠时，后加的在上面。右键菜单或快捷键可以调整选中节点的层级：

| 操作     | 快捷键                                           |
| -------- | ------------------------------------------------ |
| 置于顶层 | `Ctrl` / `⌘` + `Shift` + `]`                     |
| 上移一层 | `Ctrl` / `⌘` + `]`，越过上面第一个和它重叠的节点 |
| 下移一层 | `Ctrl` / `⌘` + `[`，越过下面第一个和它重叠的节点 |
| 置于底层 | `Ctrl` / `⌘` + `Shift` + `[`                     |

层级没有变化时，例如已经在最底层，读屏会说明原因。层级存在节点的 `z` 上，数字大的在上面，一样时按文档里的顺序，见[文档数据](./data)；分组始终在其他节点下面，不参与调整。

在自己的按钮里调整层级，用 `moveLayer`。它作用于当前选中的节点，整个操作是一步撤销，没有变化时返回 `false`：

```ts
import { moveLayer, useFlowEditor } from '@dou-ui/flow'

const ctx = useFlowEditor()
moveLayer(ctx, 'front') // 'front' | 'forward' | 'backward' | 'back'
```

不需要菜单项和快捷键时用 `flowKit({ layers: false })`，新节点仍然会放在最上面。

## 用代码添加节点

`insertNode(type, options?)` 用类型的 `defaults()` 新建一个节点，选中它并把焦点移过去，返回新节点的 id，整个操作是一步撤销。焦点在新节点上，所以添加后马上按 `Ctrl` / `⌘` + `Z` 就能撤销。

不传 `at` 时：如果正好选中了一个节点，新节点放在它后面，能连上就连好，连续添加会接成一串；否则放在画布中间。两种情况都会避开已有的节点。`useFlowEditor()` 和组件实例上都有这个方法，`startInsertDrag` 也一样。

| 选项    | 说明                                                       | 类型                     |
| ------- | ---------------------------------------------------------- | ------------------------ |
| `at`    | 节点中心的位置，画布坐标；和 `from` 一起时是接线端口的位置 | `Point`                  |
| `from`  | 新节点连到这个端口，用新节点上第一个能接上的端口           | `Required<FlowEndpoint>` |
| `focus` | 把焦点移到新节点，默认 `true`                              | `boolean`                |
| `data`  | 合并到类型的 `defaults()` 上                               | `FlowData`               |
| `size`  | 新节点的大小，不写时用类型的 `size`                        | `{ width?, height? }`    |

## API

### FlowEditor Slots

| 名称       | 说明                                     | 参数                       |
| ---------- | ---------------------------------------- | -------------------------- |
| `default`  | 浮在画布上的面板，比如 `DouFlowControls` | —                          |
| `ghost`    | 拖入节点时跟随指针的预览                 | `{ spec, over }`           |
| `quickAdd` | 连线拖到空白处时弹出的内容               | `{ types, choose, close }` |

### NodePaletteSpec

| 名称          | 说明                     | 类型        |
| ------------- | ------------------------ | ----------- |
| `label`       | 显示的名字               | `string`    |
| `icon`        | 图标                     | `Component` |
| `group`       | 分组名                   | `string`    |
| `description` | 补充说明，搜索时也会匹配 | `string`    |
| `keywords`    | 其他能搜到它的词         | `string[]`  |

### FlowMenuItem

| 名称       | 说明                                                                              | 类型                    |
| ---------- | --------------------------------------------------------------------------------- | ----------------------- |
| `key`      | 菜单里唯一                                                                        | `string`                |
| `label`    | 文字                                                                              | `string`                |
| `icon`     | 图标                                                                              | `Component`             |
| `shortcut` | 显示在右侧的快捷键，写法和 `useHotkey` 一样；只用于显示，按键要在 `keymap` 里绑定 | `string`                |
| `disabled` | 禁用                                                                              | `boolean`               |
| `tone`     | `'danger'` 表示危险操作                                                           | `'neutral' \| 'danger'` |
| `divided`  | 上方画一条分隔线                                                                  | `boolean`               |
| `checked`  | 显示勾选标记，比如当前选中的选项；每一项都写了时菜单是单选                        | `boolean`               |
| `run`      | 选中时调用                                                                        | `() => void`            |

### FlowToolbarItem

| 名称       | 说明                                                                                            | 类型             |
| ---------- | ----------------------------------------------------------------------------------------------- | ---------------- |
| `key`      | 工具栏里唯一                                                                                    | `string`         |
| `label`    | 提示文字，也是读屏器读的名字                                                                    | `string`         |
| `icon`     | 图标                                                                                            | `Component`      |
| `run`      | 点击时调用                                                                                      | `() => void`     |
| `disabled` | 禁用                                                                                            | `boolean`        |
| `pressed`  | 开关一类的按钮是否打开                                                                          | `boolean`        |
| `shortcut` | 做同样事情的快捷键，显示在提示里，写法和 `useHotkey` 一样；只用于显示，按键要在 `keymap` 里绑定 | `string`         |
| `children` | 代替 `run`：点击时在按钮下方弹出这些菜单项。既没有 `run` 也没有菜单项时，开发环境会警告一次     | `FlowMenuItem[]` |
