---
wide: true
---

# 标签页、分步与列表

字段较多的表单可以分成几页：用标签页随意切换，或者用分步一页一页地填。需要填写多份同样内容时（比如几位同行人、几行采购明细），用列表让使用者自己添加、删除和调整顺序。

## 标签页

`tabs` 节点的子节点都是 `page`，每页一个标签。所有页面都会渲染，只是同一时间显示一页，所以提交时会检查每一页的字段；有错误时自动切到第一个错误所在的页，再滚动到这个字段。有错误的页在标签标题旁显示一个红点，读屏会读出“有错误”，几页都有错时一眼就能看出来。

<DocDemo src="form-builder/structure-tabs" column />

## 分步

`steps` 节点同样由 `page` 组成，按顺序一页一页地填。点“下一步”时只检查当前这一页，通过后才进入下一页，未通过时当前步骤标为出错并聚焦第一个错误。“上一步”不做检查。已经到过的步骤可以点步骤条直接回去，还没到过的不能跳过去。点“上一步”“下一步”后焦点移到新的一页，读屏软件会读出“第 2 步，共 3 步：场次”这样的位置。表单宽度不足 480px 时，步骤条只显示当前步骤的标题，其余步骤只留序号。

表单最外层的第一个 `steps` 会把默认插槽（通常是提交按钮）放在最后一步，“上一步”的旁边，前几步不显示。重置整个表单（`resetFields()` 或重置按钮）时回到第一步。

<DocDemo src="form-builder/structure-steps" column />

页面也可以用 `visibleWhen` 按条件出现，隐藏的页不显示标签或步骤，里面的字段也不检查。

## 列表

`list` 节点的值是一个对象列表，每一项由 `children` 里的字段组成。字段的 `name` 是它在一项里的键：`name: 'phone'` 写到 `items[i].phone`。`min` 和 `max` 限制项数：项数到 `min` 时不能再删除，到 `max` 时不能再添加。列表默认可以拖动手柄调整顺序，手机上同样从手柄拖动，不影响页面滚动，手柄和删除按钮在触摸屏上有 40px 的按压范围；`sortable: false` 关掉排序。添加一项后焦点移到新一项的第一个字段，删除后移到相邻的一项，全部删完时移到添加按钮。

一项里的表达式用 `item` 读同一项的值，比如 `item.price * item.count`；`values` 仍然是整个表单。读整个列表时，`sum(values.items, 'total')` 对每一项的 `total` 求和，`min`、`max` 也支持这种写法。

<DocDemo src="form-builder/structure-list" column />

列表的初始项取 `default`，没有时生成 `min` 个空项，新添加的项里每个字段取自己的默认值。列表本身也能写 `required` 和 `rules`（例如 `min`），错误显示在添加按钮下方。重置时恢复挂载时的全部项。

一项里的字段的路径带上序号，例如 `items.1.name`，`invalid` 事件和 `validate` 的结果里也是这样的路径。

## 隐藏字段的值

字段隐藏后，它已经填写的值仍留在 `model` 里，这样再次显示时不用重新填写。提交时 `submit` 拿到的是一份去掉了隐藏字段的值的拷贝：隐藏的分组、页面和列表里的字段一起去掉，列表按每一项各自判断。设 `keepHidden` 后，提交的拷贝里保留它们。

<DocDemo src="form-builder/structure-hidden" column />

实例方法 `getValues()` 返回和 `submit` 相同的拷贝。不经过渲染器时，可以用 `visibleValues(form, model, { functions })` 自己计算。

## 检查描述

设计器在保存或渲染之前，可以用 `checkDocument(form, { fields, functions, validators })` 找出描述里的问题，`validators` 是校验函数的名字，给了才检查规则里的 `validator`。它返回问题列表，每项带 `code`、出问题的节点 `nodeId`、出错的原文 `text`；表达式的问题还带属性名 `property`（如 `visibleWhen`、`rules.0.check`）和表达式自己的问题 `expression`。

| code                  | 含义                                                         |
| --------------------- | ------------------------------------------------------------ |
| `version`             | 不认识的 `version`                                           |
| `duplicate-id`        | 节点 id 重复                                                 |
| `missing-name`        | 存值的字段没有 `name`                                        |
| `duplicate-name`      | 同一层里字段名重复，列表的项单独算一层                       |
| `unknown-type`        | 没有注册这种字段类型                                         |
| `misplaced-page`      | `page` 不在 `tabs` 或 `steps` 里                             |
| `not-a-page`          | `tabs` 或 `steps` 里放了 `page` 以外的节点                   |
| `expression`          | 表达式无法解析，或读了不存在的字段、函数                     |
| `formula-cycle`       | 公式互相引用                                                 |
| `unknown-validator`   | 规则的 `validator` 不在给出的 `validators` 里                |
| `check-and-validator` | 同一条规则同时写了 `check` 和 `validator`，只有 `check` 生效 |

`message` 是给开发者看的英文说明。界面文字可以从 `useFormRendererMessages()` 取，它按当前语言给出每个 `code` 的文字，`{text}` 换成问题的原文：

```ts
const messages = useFormRendererMessages()
const text = formatMessage(messages.value.document[problem.code], { text: problem.text })
```

### 版本迁移

读取保存过的描述时，先交给 `migrateDocument(data)`。它把旧版本的描述逐版升级到当前版本。没写 `version` 的描述和渲染器一样按第 1 版读取；不是对象或版本不认识时抛错。目前只有第 1 版，所以它原样返回第 1 版的描述；以后描述的结构有变化时，旧数据经过它就能直接使用。

```ts
const form = migrateDocument(JSON.parse(saved))
```

## 文字

“上一步”“下一步”“添加一项”、只读时的“是”“否”和空值“—”等文字跟随 `ConfigProvider` 的语言，内置简体中文、繁体中文和英文。渲染器的 `messages` 可以替换其中几项：

```vue
<DouFormRenderer :form="form" :messages="{ next: '继续' }" />
```

## API

### 节点

```ts
interface FormTabsNode {
  id: string
  type: 'tabs'
  span?: FormResponsive<number>
  visibleWhen?: string
  disabledWhen?: string
  children: FormPageNode[]
}

interface FormStepsNode {
  id: string
  type: 'steps'
  // 其余同 FormTabsNode
  children: FormPageNode[]
}

interface FormPageNode {
  id: string
  type: 'page'
  title: string // 标签或步骤的文字
  description?: string
  columns?: number // 这一页自己的栅格列数
  visibleWhen?: string
  disabledWhen?: string
  children: FormNode[]
}

interface FormListNode {
  id: string
  type: 'list'
  name: string // 列表的路径
  label?: string
  help?: string
  default?: Record<string, unknown>[]
  min?: number
  max?: number
  sortable?: boolean // 默认 true
  addText?: string // 添加按钮的文字
  required?: boolean
  rules?: FormRuleSpec[]
  columns?: number // 每一项的栅格列数
  span?: FormResponsive<number>
  visibleWhen?: string
  disabledWhen?: string
  children: FormNode[]
}
```

### 渲染器

| 名称       | 说明                                 | 类型                           |
| ---------- | ------------------------------------ | ------------------------------ |
| keepHidden | 属性，提交时保留隐藏字段的值         | `boolean`                      |
| messages   | 属性，替换部分文字                   | `FormRendererMessagesOverride` |
| getValues  | 实例方法，取得和 `submit` 相同的拷贝 | `() => Record<string, any>`    |

### 工具函数

| 名称                                       | 说明                               |
| ------------------------------------------ | ---------------------------------- |
| `checkDocument(form, options?)`            | 检查描述，返回问题列表             |
| `migrateDocument(data)`                    | 把保存的描述升级到当前版本         |
| `visibleValues(form, model, options?)`     | 去掉隐藏字段的值后的拷贝           |
| `emptyItem(list, fields)`                  | 列表的一个新项，字段取各自的默认值 |
| `findItemFormulaCycles(list)`              | 找出列表项里互相引用的公式         |
| `useFormRendererMessages(override?)`       | 当前语言的文字                     |
| `formatMessage(text, params)`              | 替换文字里的 `{name}`              |
| `isTabs` / `isSteps` / `isPage` / `isList` | 判断节点种类                       |
| `valueNodes(nodes)`                        | 存值的字段和列表，不进入列表的项   |
