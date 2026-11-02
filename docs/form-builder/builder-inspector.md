---
wide: true
---

# 属性面板

属性面板显示选中节点的设置，下方是它的校验规则和联动条件。

## 设置

没有选中节点时，属性面板显示表单本身的设置：标签位置、尺寸、必填标记、栅格列数。选中一个节点时显示它的基本设置（字段名、标签、提示文字、宽度、默认值、必填），下面是字段类型自己的设置；选中多个时可以统一改宽度、复制、删除或放进分组。

属性面板本身也由渲染器画出：每种字段类型的设置是一份表单描述，它的值是节点的 `props`。自定义字段类型用 `settings` 写出自己的设置，不需要写任何设计器代码，`icon` 和 `group` 决定它在字段面板里的图标和分组：

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

- **校验**：逐条添加规则，每条选一种：格式（邮箱、网址、数字、整数、文字）、范围（文字按字数，多选和列表按个数，数字按大小）、正则表达式、表达式、校验函数。每条规则可以写出错时的提示，并选择检查时机。写进节点的是 `rules`，和[表单描述](./document)里手写的规则一样。
- **联动**：显示条件、禁用条件、必填条件，以及字段的计算公式，分别写进 `visibleWhen`、`disabledWhen`、`requiredWhen` 和 `formula`。

条件用一行行的“字段、比较方式、值”来编辑，多行之间可以选“满足全部条件”或“满足任一条件”。值的输入方式跟着字段走：有选项的字段从它的选项里选，开关和勾选框选“是”或“否”，数字字段输入数字。条件写进节点时存成表达式文本，比如 `values.device == 'laptop'`；点“写成表达式”可以直接改文本，能拆成条件的表达式也可以再切回来。在列表里的字段还可以读同一项的其他字段（`item.xxx`）。

<DocDemo src="form-builder/builder-logic" column />

表达式输入框会补全字段路径（输入 `values.` 之后）和函数名，并在下方即时提示问题：语法错误、不存在的字段、不存在的函数。表达式里用到了自己注册的函数时，把同一份 `functions` 也传给设计器，补全、检查和预览都会用到它：

```vue
<DouFormBuilder v-model="form" :functions="{ tax: (price: number) => price * 0.06 }" />
```

“校验函数”这种规则从 `validators` 的名字里选，写进节点的是 `{ validator: 'accountFree' }`（见[校验函数](./validation#校验函数)）。把渲染器用的同一份 `validators` 传给设计器，规则里就能选到这些名字，预览时也会真的执行。没传的名字也可以直接输入。

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
