# 表单设计器

`@dou-ui/form-builder` 用一份 JSON 描述表单：有哪些字段、怎么排版、要满足哪些规则。`DouFormRenderer` 把这份描述渲染成真正的 `DouForm`，校验、重置、滚动到出错字段这些行为和手写的表单完全一样。

描述是普通数据，可以存进数据库、从接口取回，适合问卷、报名表、审批单这类经常调整、需要由使用者自己配置的表单。用[设计器](./builder) `DouFormBuilder` 可以可视化地编辑这份描述。

## 安装

表单设计器是单独的包，需要和 `dou-ui` 一起使用：

```sh
bun add dou-ui @dou-ui/form-builder
```

引入样式，再注册组件：

```ts
import 'dou-ui/style.css'
import '@dou-ui/form-builder/style.css'
import { DouFormBuilder, DouFormRenderer } from '@dou-ui/form-builder'

app.use(DouFormRenderer)
app.use(DouFormBuilder)
```

只需要渲染表单、不需要设计器时，可以从 `@dou-ui/form-builder/renderer` 引入，打包时不会带上设计器的代码。

## 基础用法

`form` 是表单描述，格式见[表单描述](./document)。`model` 是字段写入的对象，传入 `reactive` 对象就能随时读到填写的值；描述里有、`model` 里还没有的字段会先填上默认值。不传 `model` 时渲染器自己建一个，可以从 `submit` 事件或组件实例的 `model` 拿到。

字段被填写时触发 `change(name, value)`，可以用来自动保存草稿或刷新预览，不必深度监听 `model`。重置表单、或者从外部直接修改 `model` 时不会触发。

默认插槽放在所有字段后面，通常放提交和重置按钮。提交时先校验全部字段，都通过才触发 `submit`，否则触发 `invalid` 并滚动到第一个出错的字段。

<DocDemo src="form-builder/basic" column />

## 布局

字段排在一个栅格里，默认 12 列，由描述的 `columns` 修改。每个节点的 `span` 是它占的列数，不写时占满一行。`span` 可以按宽度变化，写成 `{ sm: 6, lg: 4 }`，含义和 `DouGrid` 一样：每个断点从它的宽度开始生效，直到更大的断点接手，`base` 是最窄时的值。

和 `DouGrid` 不同的是，这里的断点看的是**表单自身的宽度**，不是窗口宽度。同一份描述放在宽页面里是两列，放进窄的抽屉或手机屏幕就自动变成一列。表单比页面窄，所以断点也小一些：`sm` 480px、`md` 640px、`lg` 800px、`xl` 960px。因为要按自身宽度变化，表单总是占满所在的行（在横向排列的 flex 容器里也一样），需要窄一些时给它设 `max-width`。

`section` 是一个带标题的分组，有自己的栅格（`columns` 默认和表单一样），它本身也用 `span` 决定在外层占多宽。`bordered: true` 给分组加上边框。

`layout` 和 `DouForm` 一样有三种：`vertical` 标签在上，`horizontal` 标签在左，`inline` 排成一行（常用于筛选栏，这时 `span` 不起作用）。`horizontal` 时标签宽度由 `labelWidth` 决定，默认 96px；表单窄于 480px 时旁边放不下，标签自动回到字段上方。

<DocDemo src="form-builder/layout" column />

## 校验

`required: true` 是必填的简写，`rules` 里写其他规则：`type`（`string`、`number`、`integer`、`email`、`url`）、`min` / `max`（文字长度、选中项数或数值大小）、`pattern`（正则表达式的源码字符串）、`message` 和 `trigger`。这些规则会转成 `DouForm` 的规则，所以检查时机也一样：文本框失焦时检查，出错后每次输入都重新检查；选择类字段每次改动都检查。

注意：除了 `required`，其他规则不检查空值（空文字、空数组、`null`），空着的字段总能通过它们。要求“至少选一项”时写 `required` 并配上合适的 `message`，`min` 只在选了之后限制数量。

需要写代码的检查（比如向服务端确认账号是否可用）放在组件的 `rules` 属性里，按字段名合并到描述的规则上。也可以写 Standard Schema。

<DocDemo src="form-builder/rules" column />

规则里还可以写 `check` 表达式，和其他字段的值比较，见[联动与表达式](./logic#用表达式校验)。

## 自定义字段

内置字段覆盖了 `dou-ui` 的常用输入控件，列表见[字段类型](./fields)。需要别的控件时，用 `defineFormField` 注册一个字段类型，通过 `fields` 传给渲染器：

<DocDemo src="form-builder/custom-field" column />

字段组件拿到 `modelValue`、触发 `update:modelValue`，描述里的 `props`（加上类型的 `defaultProps`）作为它的属性传入。组件里调用 `useFormField()` 可以拿到它渲染的节点。和内置类型同名的类型会替换内置的那个。

## 性能

渲染器为每个节点建一个很轻的组件。节点按对象引用判断要不要重新渲染，字段只订阅它自己那个值，所以在大表单里输入一个字，只有这一个字段重新渲染。描述被整体替换时（比如设计器里改了一个字段），没有变化的节点也不会重新渲染，前提是修改时只替换被改动的节点对象，其余节点原样保留。

`fields` 请定义在组件外或 `setup` 里，不要在模板里每次渲染都新建数组，否则所有字段都会重新渲染。

仓库的性能基准里有 `form-renderer`（按 10 个一组分组的混合字段）和 `form-handwritten`（同样的表单手写）两个用例。300 个字段时，渲染器比手写多用约 12% 的挂载时间；在其中一个字段里输入，脚本耗时约 1.5ms。

## API

### Props

| 名称       | 说明                                                               | 类型                                | 默认值           |
| ---------- | ------------------------------------------------------------------ | ----------------------------------- | ---------------- |
| form       | 表单描述                                                           | `FormDocument`                      | —                |
| model      | 字段写入的对象，原地修改                                           | `Record<string, any>`               | 渲染器自己的对象 |
| fields     | 内置之外的字段类型                                                 | `FormFieldType[]`                   | —                |
| rules      | 按字段名追加的规则                                                 | `FormRules`                         | —                |
| disabled   | 禁用全部字段                                                       | `boolean`                           | `false`          |
| functions  | 表达式可以调用的函数，见[联动与表达式](./logic)                    | `Record<string, FormFunction>`      | —                |
| sources    | 选项来源，见[联动与表达式](./logic)                                | `Record<string, FormOptionsLoader>` | —                |
| keepHidden | 提交时保留隐藏字段的值，见[隐藏字段的值](./structure#隐藏字段的值) | `boolean`                           | `false`          |
| messages   | 替换部分文字，见[文字](./structure#文字)                           | `FormRendererMessagesOverride`      | —                |

### 事件

| 名称    | 说明                                                   | 参数                               |
| ------- | ------------------------------------------------------ | ---------------------------------- |
| change  | 字段被填写                                             | `(name: string, value: unknown)`   |
| submit  | 提交且全部字段通过，拿到值的拷贝，默认不含隐藏字段的值 | `(values)`                         |
| invalid | 提交但有字段未通过                                     | `(errors: Record<string, string>)` |
| reset   | 重置为初始值                                           | —                                  |

### 插槽

| 名称    | 说明                                                   |
| ------- | ------------------------------------------------------ |
| default | 放在所有字段后面，通常是按钮；表单是分步时放在最后一步 |

### 实例方法

| 名称          | 说明                                                           | 类型                                                          |
| ------------- | -------------------------------------------------------------- | ------------------------------------------------------------- |
| model         | 字段写入的对象                                                 | `Record<string, any>`                                         |
| validate      | 检查给定字段或全部字段，不会抛错                               | `(names?: string \| string[]) => Promise<FormValidateResult>` |
| resetFields   | 恢复为初始值并清除错误                                         | `(names?: string \| string[]) => void`                        |
| clearValidate | 清除错误                                                       | `(names?: string \| string[]) => void`                        |
| scrollToField | 滚动到字段并聚焦                                               | `(name: string) => void`                                      |
| reloadSource  | 重新加载一个或全部选项来源，见[联动与表达式](./logic#选项来源) | `(name?: string) => void`                                     |
| getValues     | 和 `submit` 相同的值的拷贝                                     | `() => Record<string, any>`                                   |
