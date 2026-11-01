---
wide: true
---

# 设计器

`DouFormBuilder` 是可视化编辑表单描述的设计器。左边是字段面板和结构树，中间的画布就是渲染器画出来的表单，右边是选中节点的设置。它编辑的是和 `DouFormRenderer` 同一份描述，画布上看到的和最终渲染的一样。

## 基础用法

`v-model` 绑定表单描述。每次修改都会交出一份新的描述对象，没有改到的节点沿用原来的对象，所以可以直接比较引用判断某个节点有没有变。`v-model:selection` 绑定选中节点的 id 列表，不需要时可以不绑。

<DocDemo src="form-builder/builder-basic" column />

## 添加和选中

单击字段面板里的类型就会添加一个新节点：选中的是分组、列表或页面时加在它的末尾，选中的是标签页或分步时加在当前显示的那一页，否则加在选中节点的后面；什么都没选时加在表单末尾。新字段有不重复的字段名（如 `select1`），选项类字段先带三个选项，添加后自动选中，方便接着修改。

单击画布上的节点选中它。按住 ⌘ 或 Ctrl 单击可以加选或取消选中；按住 Shift 单击会选中上次单击的节点到这个节点之间的所有节点。单击表单以外的空白处选中表单本身。选中节点的右上角有操作按钮：选中上一级、上移、下移、复制、删除；节点较窄时收进“更多操作”菜单。标签页和分步的页签可以单击切换和选中，`+` 添加一页。

画布外的字段先用占位块代替，滚动到附近时才画出来，几百个字段的表单也能很快打开。

## 拖动

- 把字段面板里的类型拖到画布上，松开的位置就是新节点的位置。
- 拖动画布上的节点可以调整顺序，也可以拖进或拖出分组、列表和页面。拖动一个已选中的节点时，所有选中的节点一起移动。
- 拖动时，一条细线标出放下的位置，目标分组带浅色底；靠近画布上下边缘时画布会自动滚动。按 `Esc` 取消。
- 拖动选中节点右边缘的手柄可以调整宽度，按栅格的列吸附，旁边显示当前列数。宽度按表单宽度分别设置时，改的是当前宽度下生效的那一项。

拖动开始时读一次所有节点的位置，移动过程中只做计算，长表单里拖动也不会卡顿。

标签页和分步里的页签暂时不能拖动排序，可以选中页签后用 `⌘` / `Ctrl` + `↑` `↓` 调整顺序。

## 手机上

- 在画布上单指滑动是滚动；按住节点约 0.3 秒后才开始拖动。
- 字段面板和属性面板都是从底部拉出的抽屉，可以往上拉到更高。单击字段面板里的类型就能添加，不需要拖动；单击画布上的节点会打开它的属性。
- 工具栏的“多选”按钮打开后，单击节点会加选或取消选中，不再打开属性，选好后可以一起拖动、复制或放进分组。

设计器宽度不到 560px 时使用这种布局，不到 860px 时字段面板收进工具栏的“字段”按钮。

## 键盘

焦点在画布或结构树上时可以用键盘完成大部分操作。画布和结构树都是读屏可以识别的树形结构，添加、删除、移动、撤销后会读出结果。

| 按键                                       | 作用                                               |
| ------------------------------------------ | -------------------------------------------------- |
| `↑` `↓`                                    | 选中上一个、下一个节点                             |
| `Shift` + `↑` `↓`                          | 扩大或缩小选中范围                                 |
| `→` `←`                                    | 进入第一个子节点、回到上一级；结构树里先展开、收起 |
| `Home` `End`                               | 选中第一个、最后一个节点                           |
| `⌘` / `Ctrl` + `↑` `↓`                     | 上移、下移选中的节点                               |
| `⌘` / `Ctrl` + `D`                         | 复制                                               |
| `⌘` / `Ctrl` + `G`                         | 放进一个新分组                                     |
| `Delete` `Backspace`                       | 删除                                               |
| `⌘` / `Ctrl` + `Z`                         | 撤销                                               |
| `⌘` / `Ctrl` + `Shift` + `Z`，`Ctrl` + `Y` | 重做                                               |
| `Enter`                                    | 跳到属性面板的第一项                               |
| `Esc`                                      | 选中上一级                                         |
| `Space`                                    | 拿起选中的节点，再用方向键选择位置，`Enter` 放下   |
| `Shift` + `F10`，菜单键                    | 在画布上打开选中节点的菜单，也可以右键打开         |

连续修改同一项设置（比如一个字一个字地输入标签）在一秒内会合并成一步撤销。

## 属性面板

没有选中节点时，属性面板显示表单本身的设置：标签位置、尺寸、必填标记、栅格列数。选中一个节点时显示它的基本设置（字段名、标签、提示文字、宽度、默认值、必填），下面是字段类型自己的设置；选中多个时可以统一改宽度、复制、删除或放进分组。

属性面板本身就是用渲染器画出来的：每种字段类型的设置是一份表单描述，它的值就是节点的 `props`。自定义字段类型用 `settings` 写出自己的设置，不需要写任何设计器代码，`icon` 和 `group` 决定它在字段面板里的图标和分组：

```ts
import { defineFormField } from '@dou-ui/form-builder'
import { TagsIcon } from '@dou-ui/icons'
import ChipField from './chip-field.vue'

export const chipField = defineFormField({
  type: 'chips',
  label: '标签选择',
  icon: TagsIcon,
  group: 'choice',
  component: ChipField,
  defaultProps: { options: [] },
  settings: [
    { id: 'options', type: 'input-tag', name: 'options', label: '可选的标签' },
    { id: 'multiple', type: 'switch', name: 'multiple', label: '可以多选' },
  ],
})
```

设置改回默认值或清空时，这个键会从节点里去掉，描述里只留下真正设置过的内容。字段名为空或和同一层的其他字段重名时，字段名下方会直接提示。

宽度可以是一个列数，也可以打开“按表单宽度分别设置”，为每个断点分别填写；空着的断点沿用更窄的那一个。

## 校验与联动

选中一个字段后，属性面板下方还有两部分：

- **校验**：逐条添加规则，每条选一种：格式（邮箱、网址、数字、整数、文字）、范围（文字按字数，多选和列表按个数，数字按大小）、正则表达式、表达式。每条规则可以写出错时的提示，并选择检查时机。写进节点的是 `rules`，和[表单描述](./document)里手写的规则一样。
- **联动**：显示条件、禁用条件、必填条件，以及字段的计算公式，分别写进 `visibleWhen`、`disabledWhen`、`requiredWhen` 和 `formula`。

条件用一行行的“字段、比较方式、值”来编辑，多行之间可以选“满足全部条件”或“满足任一条件”。值的输入方式跟着字段走：有选项的字段从它的选项里选，开关和勾选框选“是”或“否”，数字字段输入数字。条件写进节点时就是表达式文本，比如 `values.device == 'laptop'`；点“写成表达式”可以直接改文本，能拆成条件的表达式也可以再切回来。在列表里的字段还可以读同一项的其他字段（`item.xxx`）。

<DocDemo src="form-builder/builder-logic" column />

表达式输入框会补全字段路径（输入 `values.` 之后）和函数名，并在下方即时提示问题：语法错误、不存在的字段、不存在的函数。表达式里用到了自己注册的函数时，把同一份 `functions` 也传给设计器，补全、检查和预览都会用到它：

```vue
<DouFormBuilder v-model="form" :functions="{ tax: (price) => price * 0.06 }" />
```

### 用代码输入框写表达式

装了 [代码编辑器](/code/) 之后，可以用 `@dou-ui/form-builder/code` 里的 `codeExpressions()` 把表达式输入框换成代码输入框：表达式按语法着色；输入 `values.` 后补全字段路径；函数作为片段插入，可以用 `Tab` 在参数之间跳转；括号里会显示参数提示；问题直接标在出错的位置，同时写在输入框下方。

```ts
import { codeExpressions } from '@dou-ui/form-builder/code'
import '@dou-ui/code/style'

const extensions = [codeExpressions()]
// <DouFormBuilder v-model="form" :extensions="extensions" />
```

<DocDemo src="form-builder/builder-code" column />

在设计器之外，比如应用自己的设置页，也可以用 `DouCodeInput` 编辑表达式：`formExpression` 是表达式语言，`expressionCodeExtension({ names, itemNames, readsValue, functions, functionInfo })` 提供补全、悬停说明、参数提示和问题检查。`names` 是 `values` 能读的路径（`{ path, label? }`），`functionInfo` 按函数名给出 `{ signature, info }`；这些选项都可以是返回值的函数，这样读到的总是最新的值。

## 预览

工具栏右侧的“预览”切换到填写视图：表单按真实的样子渲染，可以填写、看到联动和校验，提交通过后在下方列出会提交的值。上方可以选择桌面、平板（768px）和手机（375px）的宽度，栅格按表单宽度变化，所以能直接看到每个断点下的排版。手机上预览始终占满屏幕宽度。

`v-model:mode` 绑定当前是设计（`design`）还是预览（`preview`），也可以从页面自己的按钮切换。预览用到选项来源时，把同一份 `sources` 传给设计器。

## JSON

工具栏上的 `{ }` 按钮打开表单的 JSON，可以复制、下载，也可以粘贴或打开一个文件来替换整张表单。修改时下方会按路径列出问题，比如 `nodes[0].children[1].label 应为文字`：

- 结构不对（值的类型错了、缺少 `id`、`type`、`children`），或者 id 重复、页面放错了位置，这些问题会让设计器无法工作，改好之前不能应用；
- 字段名重复、表达式引用了不存在的字段、字段类型没有注册等问题只做提示，仍然可以应用，应用之后可以在设计器里接着改。

应用之后是一步撤销。代码里也可以用同样的检查：`checkDocumentShape(data)` 按路径列出结构问题，`checkDocument(document)` 列出内容问题，`documentPaths(document)` 给出每个节点 id 对应的路径；`replace(document)` 换掉整张表单，并记为一步撤销。

## 扩展

`extensions` 给设计器加上新的能力：字段类型、快捷键、工具栏按钮、节点菜单项、属性面板里的部分，以及对每次修改的处理。下面的扩展在节点菜单（右键或节点上的 `⋯` 按钮）、工具栏和 `Alt + R` 上加了“切换必填”：

<DocDemo src="form-builder/builder-extension" column />

| 选项              | 作用                                                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`            | 扩展的名字，同一个设计器里不能重复                                                                                                                      |
| `priority`        | 越大越先执行，默认 `100`                                                                                                                                |
| `fields`          | 字段类型，和 `fields` 属性一样出现在字段面板里                                                                                                          |
| `keymap`          | 画布或结构树有焦点时的快捷键，写法同 `useHotkey`；先于内置快捷键，返回 `false` 时交给后面处理                                                           |
| `toolbar`         | 工具栏按钮：`key`、`label`、`icon`、`run`，以及 `disabled`、`pressed`、`shortcut`（显示在提示里，并作为 `aria-keyshortcuts`；按键本身用 `keymap` 绑定） |
| `menu`            | 选中节点的菜单项，排在内置的移动、复制、放进分组、删除之后；`shortcut` 显示在菜单项末尾                                                                 |
| `inspector`       | 属性面板里追加的部分：`title` 和 `component`，没有选中节点时参数是 `undefined`                                                                          |
| `transaction`     | 每次修改提交前调用，可以往事务里追加步骤，它们和原来的修改是同一步撤销；撤销和重做不经过这里                                                            |
| `setup`           | 设计器挂载后调用，返回的函数在卸载时调用                                                                                                                |
| `marks`           | 节点上的标记：`key`、`label`、`color`，画布上显示为同色的框和名字，结构树里显示为圆点；渲染时读取，里面用到的响应式数据变化时会更新                     |
| `expressionInput` | 替换表达式输入框（公式、表达式规则、写成表达式的条件）；取第一个提供它的扩展，`codeExpressions()` 就是这样换成代码输入框                                |
| `history`         | 替换内置的撤销记录，返回 `undo`、`redo`、`canUndo`、`canRedo`；只取第一个提供它的扩展，[协同编辑](./collaboration)就是这样只撤销自己的修改              |

扩展里的函数拿到的参数和 `useFormBuilder()` 是同一个对象。扩展带来的字段类型也要交给渲染器，`resolveFormBuilderFields(fields, extensions)` 把两处的字段类型合在一起：

```ts
import { resolveFormBuilderFields } from '@dou-ui/form-builder'

const fields = resolveFormBuilderFields([chipField], [myExtension])
// <DouFormRenderer :form="form" :fields="fields" />
```

## 自己摆放面板

默认插槽会替换设计器的整个布局，可以把 `DouFormBuilderPalette`（字段面板）、`DouFormBuilderCanvas`（画布）、`DouFormBuilderInspector`（属性面板）、`DouFormBuilderOutline`（结构树）、`DouFormBuilderPreview`（预览）放在任何位置，它们共用同一个设计器的状态。`toolbar` 插槽在默认布局的撤销、重做按钮后面追加按钮。

<DocDemo src="form-builder/builder-parts" column />

## 在代码里修改

组件实例和设计器内部的 `useFormBuilder()` 是同一个对象，可以读当前的 `document` 和 `selection`，也可以调用下面的命令。命令和设计器里的按钮、快捷键做的事一样，不传 `ids` 时作用于选中的节点：

| 命令                  | 作用                                                                            |
| --------------------- | ------------------------------------------------------------------------------- |
| `add(type, place?)`   | 新建一个节点并选中它，默认放进选中的容器或选中节点之后，返回它的 id             |
| `remove(ids?)`        | 删除节点                                                                        |
| `duplicate(ids?)`     | 在每个节点之后放一份副本，并选中副本                                            |
| `moveTo(place, ids?)` | 移到容器 `place.parent`（`null` 是最外层）的第 `place.index` 位，位置按移动前算 |
| `moveBy(delta, ids?)` | 在同一个容器里上移（`-1`）或下移（`1`）一位                                     |
| `wrap(ids?)`          | 把同一个容器里的节点放进一个新的分组                                            |
| `addPage(id?)`        | 给标签页或分步加一页                                                            |
| `replace(document)`   | 换掉整张表单，记为一步撤销                                                      |
| `setMode(mode)`       | 切换设计（`design`）和预览（`preview`）                                         |
| `select(ids, mode?)`  | 选中节点，`mode` 为 `replace`、`toggle` 或 `extend`；`null` 选中表单本身        |
| `undo()` / `redo()`   | 撤销、重做                                                                      |

需要一次做好几处修改时，先用 `transaction()` 开一个事务，逐步修改，再用 `dispatch` 提交，整个事务是一步撤销：

```ts
const builder = useFormBuilder()

const tr = builder.transaction()
tr.update('phone', { label: '联系电话', required: true })
tr.move('phone', null, 0)
builder.dispatch(tr, { selection: ['phone'] })
```

`moveTo` 的位置按移动前的子节点算，就像在当前列表里指出一个缝隙。比如分组里依次是 `a`、`b`、`c`，把 `a` 移到 `c` 后面要写 `index: 3`（`c` 之后的缝隙），结果是 `b`、`c`、`a`：

```ts
builder.moveTo({ parent: 'contact', index: 3 }, ['a'])
```

事务的方法按 id 和位置修改，不看选中了什么：

| 事务方法                        | 作用                                                |
| ------------------------------- | --------------------------------------------------- |
| `insert(node, parent?, index?)` | 把节点放进容器（`null` 是表单最外层），默认放在末尾 |
| `remove(id)`                    | 删除节点和它里面的内容                              |
| `update(id, patch)`             | 修改节点的键，值为 `undefined` 时删除这个键         |
| `move(id, parent, index)`       | 移动节点，`index` 按移走之后的位置算                |
| `updateDocument(patch)`         | 修改表单本身的设置，如 `{ layout: 'horizontal' }`   |

事务的每一步都会检查结构，不符合时抛出错误：页面只能放进标签页和分步，标签页和分步里只能放页面，节点不能移到自己里面，id 不能重复。`update` 不能改 `id`、`type` 和 `children`，请改用 `insert`、`remove` 和 `move`。`meta.group` 相同、间隔不到一秒的事务合并成一步撤销；`meta.history` 为 `false` 时不记入撤销。每次修改（包括撤销和重做）都会触发 `change` 事件，参数就是这个事务，`steps` 是它做了哪些修改。

从外部换掉整份描述（比如加载另一张表单）时，撤销记录会清空。

## 文字

设计器自己的文字（字段类型的名称、按钮、提示、读屏播报）跟随当前语言，内置简体中文、繁体中文和英文。`messages` 可以替换其中一部分，按分组合并：

```vue
<DouFormBuilder v-model="form" :messages="{ types: { input: '文本' } }" />
```
