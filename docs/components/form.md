# Form 表单

组织表单中的控件，统一处理标签、说明、校验信息，以及尺寸、禁用等状态。

## 基础用法

给 `DouForm` 传入 `model` 与 `rules`，给每个 `DouFormItem` 一个 `prop` 指向 `model` 中的字段。提交按钮使用 `native-type="submit"`，表单校验通过后触发 `submit`，否则触发 `invalid`，并把第一个出错的字段滚动到视野内、移交焦点。

<DocDemo src="form/basic" column style="max-width: 420px" />

`model` 请传入 `reactive` 对象（或 `ref` 的值），这样 `resetFields` 才能把字段写回初始值。表单渲染为原生 `<form novalidate>`：回车提交、`type="reset"` 重置都是浏览器自己的行为，浏览器自带的校验气泡则被关掉，由表单项统一展示错误。

## 校验时机

校验的原则是**晚批评，早原谅**：

- 文本输入在**失焦**时校验，输入过程中不打断；一旦显示了错误，之后每次输入都会重新校验，改对的那一刻错误就消失。
- 多选、单选、开关这类选择控件在**值变化时**立即校验。
- 提交时校验全部字段。

需要不同的时机时，给规则写上 `trigger: 'change'` 或 `trigger: 'blur'`，该规则就只在这些事件上运行。

## 校验规则

每个字段可以有一条或多条规则，按顺序检查，遇到第一条失败就停止。

| 字段        | 作用                                                                         |
| ----------- | ---------------------------------------------------------------------------- |
| `required`  | 不能为空。`undefined`、`null`、空白字符串、空数组与 `false` 都视为空         |
| `type`      | 值的类型：`string`、`number`、`integer`、`boolean`、`array`、`email`、`url`  |
| `min`/`max` | 文本按字符数、数组按项数、数字按大小                                         |
| `pattern`   | 文本需要匹配的正则                                                           |
| `validator` | 自定义检查，可以是 async。返回 `true` 或不返回为通过，返回字符串即为错误信息 |
| `schema`    | 一个 Standard Schema，失败时取它的第一条信息，见下文                         |
| `message`   | 替换默认错误信息                                                             |
| `trigger`   | 限定在哪些事件上运行                                                         |

除 `required` 与 `validator` 外，内置检查只看有值的字段，所以可选字段可以留空。`false` 视为空，适合“必须勾选同意”这类开关。默认错误信息来自 [全局配置](./config-provider) 中的语言包。

### 异步校验

`validator` 返回 Promise 即可。同一字段连续触发多次校验时，只采纳最后一次的结果。

<DocDemo src="form/async-validate" column style="max-width: 420px" />

### 使用 Standard Schema

实现了 [Standard Schema](https://standardschema.dev) 规范的校验库（如 Zod、Valibot、ArkType）定义的 schema 可以直接使用，DouUI 只依赖这个规范接口，不依赖任何校验库。

给 `DouForm` 传 `schema` 时，它检查整个 `model`，每个字段显示路径与自己 `prop` 相同（或位于其下）的第一条问题。根级别、没有路径的问题不会显示在任何字段上。

<DocDemo src="form/schema" column style="max-width: 420px" />

也可以只给某个字段一个 schema，直接放进 `rules` 即可，相当于 `{ schema }`。需要指定触发时机或改写信息时写成完整的规则：

```ts
const rules = {
  name: v.pipe(v.string(), v.minLength(2, '至少 2 个字')),
  email: { schema: v.pipe(v.string(), v.email()), trigger: 'blur', message: '邮箱格式不对' },
}
```

schema 自己决定空值是否合法，必填标记则无法从 schema 推断，需要时在 `DouFormItem` 上加 `required`。

### 来自服务端的错误

有些错误要提交之后才知道，比如域名已被占用。把服务端返回的错误按字段路径交给实例的 `setErrors`，它们会显示在对应的字段上，和规则产生的错误一样：改动这个字段的值、或再次校验它时消失。

<DocDemo src="form/server-errors" column style="max-width: 420px" />

`setErrors` 只设置传入的字段，其他字段的错误不变；某个字段传空字符串或 `undefined` 即清除它的错误。`items[0].name` 这样的方括号写法按 `items.0.name` 处理。表单里找不到字段的路径不会显示，`setErrors` 把它们作为数组返回，开发环境下还会在控制台提示；这些错误可以放在表单上方的提示里，免得用户看不到。提交后需要定位到出错的字段时，接着调用 `scrollToField`。

`DouFormItem` 的 `error` 也会直接显示，不经过规则，但它一直显示到你自己把它清空为止，适合由外部状态决定的错误：

```vue
<DouFormItem label="域名" prop="domain" :error="serverErrors.domain">
  <DouInput v-model="form.domain" />
</DouFormItem>
```

## 动态增减字段

列表中的每一项用带下标的路径作为 `prop`，例如 `contacts.0.name`。

<DocDemo src="form/dynamic" column style="max-width: 520px" />

- `v-for` 的 `key` 用每一行自己的 id，不要用下标。这样删除一行后，其余各行的输入框和错误信息会跟着自己的数据移动。
- 行数不固定，规则写在 `DouFormItem` 的 `rules` 上，而不是表单的 `rules` 里。
- 列表本身也可以有规则：给一个 `prop="contacts"` 的表单项写 `required`，空数组视为空。显示错误后，增删行会重新校验它。
- 使用表单的 `schema` 时，数组项的问题路径同样写成 `contacts.0.email`，会显示在对应的字段上。
- `resetFields` 只恢复已有字段的值，不会恢复删掉的行。需要时在 `reset` 事件里把列表还原。

## 布局

### 水平

`layout="horizontal"` 时标签在左侧排成一列。表单是一个网格，所有表单项共享它的列，所以**标签列会自动取最长标签的宽度**，不需要猜一个固定的 `labelWidth`。没有标签的表单项（例如按钮行）自动与控件列对齐。

<DocDemo src="form/horizontal" column style="max-width: 520px" />

标签与控件的第一行共享一条中线，无论控件是输入框、开关还是一组单选。需要固定宽度时，用表单或单个表单项的 `labelWidth`。自动对齐要求表单项是表单的直接子元素。

### 行内

`layout="inline"` 让表单项排成一行，适合筛选栏。

<DocDemo src="form/inline" />

## 必填与可选标记

默认在必填字段的标签后显示星号。当表单里大多数字段都是必填时，`required-mark="optional"` 改为只给可选字段标上“可选”，信息更少，也更准确；`false` 则什么都不标。

```vue
<DouForm required-mark="optional">...</DouForm>
```

星号对读屏软件隐藏，必填状态通过控件上的 `aria-required` 传达。

## 尺寸与禁用

表单的 `size` 与 `disabled` 会下发给内部所有控件（包括按钮），控件自己设置的 `size` 优先。没有设置时，尺寸取自 [全局配置](./config-provider)。

```vue
<DouForm size="sm" disabled>...</DouForm>
```

## 只读

详情页常用同一张表单展示数据。`readonly` 让内部所有输入类控件只读：值照常显示、文字可以选中复制，但不能修改，选择器不会展开，清除按钮也不出现。和 `disabled` 不同，只读的控件不变灰，仍可获得焦点，并带有 `aria-readonly`。

表单渲染器的 `readonly` 表现不同：它把值换成文字，并隐藏必填标记和字段说明，见[表单渲染器的只读展示](/form-builder/readonly)。

<DocDemo src="form/readonly" column />

## 可访问性

- 标签是真正的 `<label for>`，指向控件的可聚焦元素，点击标签即可聚焦。
- 多选组、单选组没有单一的可聚焦元素，标签改为通过 `aria-labelledby` 为整组命名。
- 说明与错误放在同一个 `aria-live="polite"` 区域，并通过 `aria-describedby` 关联到控件；出错时控件带 `aria-invalid`。
- 提交失败时，焦点移到第一个出错的字段。

## 接入自定义控件

自己写的控件可以通过 `useFormItem()` 接入同一套上下文：

```ts
import { useFormDisabled, useFormItem, useFormReadonly, useFormSize } from 'dou-ui'

const { formItem } = useFormItem()
const size = useFormSize(() => props.size)
const disabled = useFormDisabled(() => props.disabled)
const readonly = useFormReadonly(() => props.readonly)

// 把 formItem.inputId 给可聚焦元素，formItem.describedBy 给 aria-describedby，
// 值变化时调用 formItem.trigger('change')，失焦时调用 formItem.trigger('blur')。
```

## API

### Form Props

| 名称            | 说明                                   | 类型                                     | 默认值       |
| --------------- | -------------------------------------- | ---------------------------------------- | ------------ |
| `model`         | 表单数据                               | `Record<string, any>`                    | —            |
| `rules`         | 按字段路径的校验规则                   | `FormRules`                              | —            |
| `schema`        | 检查整个 `model` 的 Standard Schema    | `StandardSchemaV1`                       | —            |
| `layout`        | 布局                                   | `'vertical' \| 'horizontal' \| 'inline'` | `'vertical'` |
| `labelAlign`    | 水平布局中标签的对齐                   | `'start' \| 'end'`                       | `'start'`    |
| `labelWidth`    | 水平布局中标签列的宽度，默认取最长标签 | `string \| number`                       | —            |
| `size`          | 内部控件的尺寸                         | `'sm' \| 'md' \| 'lg'`                   | —            |
| `disabled`      | 禁用内部所有控件                       | `boolean`                                | `false`      |
| `readonly`      | 内部所有输入类控件只读                 | `boolean`                                | `false`      |
| `requiredMark`  | 必填 / 可选标记                        | `boolean \| 'optional'`                  | `true`       |
| `scrollToError` | 提交失败时滚动到第一个错误字段并聚焦   | `boolean`                                | `true`       |

### Form Events

| 名称      | 说明                   | 参数                   |
| --------- | ---------------------- | ---------------------- |
| `submit`  | 提交且全部字段通过校验 | `(model: FormModel)`   |
| `invalid` | 提交但有字段未通过校验 | `(errors: FormErrors)` |
| `reset`   | 表单被重置             | —                      |

### Form Exposes

| 名称            | 说明                                                       | 类型                                                          |
| --------------- | ---------------------------------------------------------- | ------------------------------------------------------------- |
| `validate`      | 校验指定字段或全部字段，永不 reject                        | `(props?: string \| string[]) => Promise<FormValidateResult>` |
| `resetFields`   | 恢复指定字段或全部字段的初始值，并清除错误                 | `(props?: string \| string[]) => void`                        |
| `clearValidate` | 清除指定字段或全部字段的错误                               | `(props?: string \| string[]) => void`                        |
| `scrollToField` | 滚动到字段并聚焦                                           | `(prop: string) => void`                                      |
| `setErrors`     | 按字段路径显示错误，如服务端返回的错误，返回没能显示的路径 | `(errors: Record<string, string \| undefined>) => string[]`   |

`FormValidateResult` 为 `{ valid: boolean; errors: Record<string, string> }`。

### FormItem Props

| 名称         | 说明                                       | 类型                     | 默认值  |
| ------------ | ------------------------------------------ | ------------------------ | ------- |
| `label`      | 标签                                       | `string`                 | —       |
| `prop`       | 字段在 `model` 中的路径，如 `address.city` | `string`                 | —       |
| `rules`      | 追加到表单规则之后的规则                   | `FormRule \| FormRule[]` | —       |
| `required`   | `required` 规则的简写                      | `boolean`                | `false` |
| `help`       | 字段下方的说明，出错时被错误信息替换       | `string`                 | —       |
| `error`      | 直接显示的错误，不经过规则                 | `string`                 | —       |
| `labelWidth` | 覆盖表单的 `labelWidth`                    | `string \| number`       | —       |

### FormItem Slots

| 名称      | 说明         |
| --------- | ------------ |
| `default` | 控件         |
| `label`   | 替换 `label` |
| `help`    | 替换 `help`  |

### FormItem Exposes

| 名称       | 说明                                               | 类型                            |
| ---------- | -------------------------------------------------- | ------------------------------- |
| `error`    | 当前显示的错误                                     | `string`                        |
| `validate` | 校验该字段                                         | `() => Promise<string \| null>` |
| `reset`    | 恢复初始值并清除错误                               | `() => void`                    |
| `clear`    | 清除错误                                           | `() => void`                    |
| `setError` | 显示一条错误，值改动或再次校验时消失；空字符串清除 | `(message: string) => void`     |

### CSS 变量

| 变量                          | 说明                   |
| ----------------------------- | ---------------------- |
| `--dou-form-gap`              | 表单项之间的间距       |
| `--dou-form-label-gap`        | 标签与控件之间的间距   |
| `--dou-form-label-width`      | 水平布局中标签列的宽度 |
| `--dou-form-item-label-color` | 标签颜色               |
| `--dou-form-item-help-color`  | 说明颜色               |
| `--dou-form-item-error-color` | 错误与星号颜色         |
