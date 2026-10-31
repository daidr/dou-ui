# 表单描述

表单描述 `FormDocument` 是一份能直接 `JSON.stringify` 的普通数据。渲染器和后续的设计器都只认它。

```ts
interface FormDocument {
  version: 1
  layout?: 'vertical' | 'horizontal' | 'inline'
  labelAlign?: 'start' | 'end'
  labelWidth?: number // horizontal 时的标签宽度，默认 96
  size?: 'sm' | 'md' | 'lg'
  requiredMark?: boolean | 'optional'
  columns?: number // 栅格列数，默认 12
  nodes: FormNode[]
}

type FormNode =
  FormFieldNode | FormSectionNode | FormTabsNode | FormStepsNode | FormPageNode | FormListNode
```

`version` 目前总是 `1`。以后描述的结构有变化时，会按这个字段把旧数据升级过来，读取保存过的描述时先交给 [`migrateDocument`](./structure#版本迁移)。漏写或写成其他值时，渲染器在控制台提示一次，然后照第 1 版读取。

## 字段节点

```ts
interface FormFieldNode {
  id: string
  type: string // 'input'、'input-number'……或自定义类型
  name?: string // 值写入的路径，如 'name'、'contact.phone'
  label?: string
  help?: string // 字段下方的提示，出错时换成错误信息
  default?: unknown // 初始值，不写时用类型的空值
  required?: boolean
  rules?: FormRuleSpec[]
  props?: Record<string, unknown> // 这个类型自己的设置
  span?: number | { base?: number; sm?: number; md?: number; lg?: number; xl?: number }
  visibleWhen?: string // 以下都是表达式，见“联动与表达式”
  disabledWhen?: string
  requiredWhen?: string
  formula?: string
  source?: { name: string; arg?: string; keep?: boolean } // 选项来源
}
```

- `id` 在整份描述里唯一，节点移动或修改时保持不变。设计器靠它记住选中的节点，撤销和协同也靠它对应节点。
- `name` 用点号表示嵌套，`contact.phone` 写到 `model.contact.phone`，路径上缺的对象会自动建出来。存值的字段都要有 `name`；`text`、`divider`、`alert` 这类只用来展示的字段不需要。
- `default` 每个表单拿到的是一份拷贝，几个表单共用一份描述时不会互相影响。`model` 里已经有值的字段不会被默认值覆盖，所以编辑已有数据时直接把数据传给 `model` 即可。重置时恢复的是字段挂载时的值。
- `visibleWhen`、`disabledWhen`、`requiredWhen`、`formula` 和 `source` 让字段随其他字段变化，见[联动与表达式](./logic)。
- `props` 的内容由字段类型决定，比如 `select` 的 `options`、`multiple`，`input` 的 `placeholder`、`maxlength`。列表见[字段类型](./fields)。

## 分组节点

```ts
interface FormSectionNode {
  id: string
  type: 'section'
  title?: string
  description?: string
  bordered?: boolean
  columns?: number // 分组自己的栅格列数，默认和表单一样
  span?: FormResponsive<number>
  visibleWhen?: string
  disabledWhen?: string
  children: FormNode[]
}
```

分组可以嵌套，也可以用 `visibleWhen`、`disabledWhen` 整组显示或禁用。分组用 `role="group"` 并以标题命名，读屏会读出字段属于哪个分组。

标签页、分步、页面和列表见[标签页、分步与列表](./structure)。

## 规则

```ts
interface FormRuleSpec {
  required?: boolean
  type?: 'string' | 'number' | 'integer' | 'email' | 'url'
  min?: number
  max?: number
  pattern?: string // 正则表达式的源码，不带斜杠
  flags?: string // 如 'i'
  check?: string // 表达式，如 'value >= values.start'
  message?: string
  trigger?: 'change' | 'blur'
}
```

`pattern` 是字符串，因为正则表达式本身不能 JSON 序列化。在 JSON 里写反斜杠要再转义一次，例如六位数字写成 `"^\\d{6}$"`。无法编译的 `pattern` 会被忽略，并在控制台提示一次。

## 修改描述

渲染器按节点对象的引用判断要不要重新渲染。修改描述时，替换被改动的节点和它的上级数组，其余节点原样保留：

```ts
// 把 phone 字段改成必填
form.value = {
  ...form.value,
  nodes: form.value.nodes.map((node) => (node.id === 'phone' ? { ...node, required: true } : node)),
}
```

直接修改 `reactive` 描述里的属性也能更新，只是会让更多节点重新渲染。

## 工具函数

| 名称                                                   | 说明                                         |
| ------------------------------------------------------ | -------------------------------------------- |
| `emptyDocument()`                                      | 一份没有节点的描述                           |
| `createId(prefix?)`                                    | 生成节点 id                                  |
| `walkNodes(nodes)`                                     | 按文档顺序遍历全部节点，分组在它的子节点之前 |
| `checkDocument(document, options?)`                    | 检查描述，见[检查描述](./structure#检查描述) |
| `fieldNodes(document)`                                 | 全部存值的字段节点                           |
| `findNode(document, id)`                               | 按 id 找节点                                 |
| `getPath(model, path)` / `setPath(model, path, value)` | 按点号路径读写                               |
