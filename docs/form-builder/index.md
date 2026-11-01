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

只需要渲染表单、不需要设计器时，可以从 `@dou-ui/form-builder/renderer` 引入，打包时不会带上设计器的代码。样式也可以只引入 `@dou-ui/form-builder/renderer/style`，它带上渲染器用到的 `dou-ui` 组件样式，不含设计器的样式。

## 基础用法

`form` 是表单描述，格式见[表单描述](./document)。`model` 是字段写入的对象，传入 `reactive` 对象就能随时读到填写的值；描述里有、`model` 里还没有的字段会先填上默认值。不传 `model` 时渲染器自己建一个，可以从 `submit` 事件或组件实例的 `model` 拿到。

字段被填写时触发 `change(name, value)`，可以用来自动保存草稿或刷新预览，不必深度监听 `model`。重置表单、或者从外部直接修改 `model` 时不会触发。

默认插槽放在所有字段后面，通常放提交和重置按钮。提交时先校验全部字段，都通过才触发 `submit`，否则触发 `invalid` 并滚动到第一个出错的字段。

<DocDemo src="form-builder/basic" column />

设计器和渲染器配合使用的完整页面见区块：[活动报名表](/blocks/event-signup)、[设备报修单](/blocks/repair-order)。

## 布局

字段排在一个栅格里，默认 12 列，由描述的 `columns` 修改。每个节点的 `span` 是它占的列数，不写时占满一行。`span` 可以按宽度变化，写成 `{ sm: 6, lg: 4 }`，含义和 `DouGrid` 一样：每个断点从它的宽度开始生效，直到更大的断点接手，`base` 是最窄时的值。

和 `DouGrid` 不同的是，这里的断点看的是**表单自身的宽度**，不是窗口宽度。同一份描述放在宽页面里是两列，放进窄的抽屉或手机屏幕就自动变成一列。表单比页面窄，所以断点也小一些：`sm` 480px、`md` 640px、`lg` 800px、`xl` 960px。因为要按自身宽度变化，表单总是占满所在的行（在横向排列的 flex 容器里也一样），需要窄一些时给它设 `max-width`。

`section` 是一个带标题的分组，有自己的栅格（`columns` 默认和表单一样），它本身也用 `span` 决定在外层占多宽。`bordered: true` 给分组加上边框。

`layout` 和 `DouForm` 一样有三种：`vertical` 标签在上，`horizontal` 标签在左，`inline` 排成一行（常用于筛选栏，这时 `span` 不起作用）。`horizontal` 时标签宽度由 `labelWidth` 决定，默认 96px；表单窄于 480px 时旁边放不下，标签自动回到字段上方。

<DocDemo src="form-builder/layout" column />

## 校验

`required: true` 是必填的简写，`rules` 里写其他规则：`type`（`string`、`number`、`integer`、`email`、`url`）、`min` / `max`（文字长度、选中项数或数值大小）、`pattern`（正则表达式的源码字符串）、`message` 和 `trigger`。这些规则会转成 `DouForm` 的规则，所以检查时机也一样：文本框失焦时检查，出错后每次输入都重新检查；选择类字段每次改动都检查。

注意：除了 `required`，其他规则不检查空值（空文字、空数组、`null`），空着的字段总能通过它们。要求“至少选一项”时写 `required` 并配上合适的 `message`，`min` 只在选了之后限制数量。

### 校验函数

表达式做不到的检查（比如向服务端确认账号是否可用）写成校验函数，通过渲染器的 `validators` 按名字注册，描述里的规则只写名字：`{ validator: 'accountFree', message: '这个账号已被占用' }`。这和 `sources`、`functions` 的做法一样，描述里不会出现函数，仍然可以存成 JSON、在设计器里编辑。

校验函数拿到字段的值和 `{ values, item, path }`：`values` 是整个表单，`item` 是字段所在的列表项（不在列表里时为 `null`），`path` 是字段的完整路径，比如 `guests.2.phone`，同一个函数可以给几个字段用。返回 `true` 或不返回为通过，返回 `false` 时显示规则的 `message`，返回字符串时显示这个字符串。可以是 async，同一个字段连续检查时只采纳最后一次的结果。和其他规则一样，空值不会交给它。请求接口的检查适合写 `trigger: 'blur'`，避免每输入一个字都请求一次。

<DocDemo src="form-builder/rules" column />

描述里写了、`validators` 里没有的名字会被当作通过，并在控制台提示一次。只在代码里用、不需要放进描述的检查，也可以写在组件的 `rules` 属性里，按字段名合并到描述的规则上，写法和 `DouForm` 的规则一样，也可以写 Standard Schema。

规则里还可以写 `check` 表达式，和其他字段的值比较，见[联动与表达式](./logic#用表达式校验)。

### 来自服务端的错误

有些错误要提交之后才知道。把服务端返回的错误按字段路径交给实例方法 `setErrors`，它们显示在对应的字段上，改动这个字段或再次检查它时消失。错误在其他标签页里时，标签上同样会出现提示点。

<DocDemo src="form-builder/server-errors" column />

`setErrors` 只设置传入的字段，传空字符串清除某个字段的错误，表单里没有的路径会被忽略。

## 只读展示

`readonly` 把字段的值显示成文字，适合详情页、审批单这类只看不填的场景：选择类字段显示选项的文字而不是值，开关显示“是”“否”，日期按当前语言的格式显示，密码显示成圆点，没有值的字段显示“—”。只读时不显示必填标记和字段说明，列表没有添加、删除和拖动，分步表单把每一步依次排开、各自带着标题。

<DocDemo src="form-builder/readonly" column />

只读时渲染器不会写 `model`：缺少的字段不会填上默认值，公式字段显示的是现算的结果。切回可编辑时才填上默认值，所以同一个 `model` 可以先展示、再编辑。

自定义字段类型用 `format(value, props, context)` 决定显示的文字，需要文字以外的样子时提供 `readonlyComponent`，见[自定义字段](./fields#自定义字段)。`readonly` 和 `disabled` 不同：`disabled` 仍然显示输入控件，只是不能操作。

## 自定义字段

内置字段覆盖了 `dou-ui` 的常用输入控件，列表见[字段类型](./fields)。需要别的控件时，用 `defineFormField` 注册一个字段类型，通过 `fields` 传给渲染器：

<DocDemo src="form-builder/custom-field" column />

字段组件拿到 `modelValue`、触发 `update:modelValue`，描述里的 `props`（加上类型的 `defaultProps`）作为它的属性传入。组件里调用 `useFormField()` 可以拿到它渲染的节点。和内置类型同名的类型会替换内置的那个。

## 性能

渲染器为每个节点建一个很轻的组件。节点按对象引用判断要不要重新渲染，字段只订阅它自己那个值，所以在大表单里输入一个字，只有这一个字段重新渲染。描述被整体替换时（比如设计器里改了一个字段），没有变化的节点也不会重新渲染，前提是修改时只替换被改动的节点对象，其余节点原样保留。

`fields` 请定义在组件外或 `setup` 里，不要在模板里每次渲染都新建数组，否则所有字段都会重新渲染。

仓库的性能基准里有 `form-renderer`（按 10 个一组分组的混合字段）和 `form-handwritten`（同样的表单手写）两个用例。300 个字段时，渲染器比手写多用约 12% 的挂载时间；在其中一个字段里输入，脚本耗时约 1.5ms。

设计器的用例是 `form-builder`（打开表单后选中一个字段）和 `form-builder-edit`（改选中字段的标签，包括事务和撤销记录）。画布只先画出最前面的字段，其余的在滚动到附近时才画，1000 个字段的表单滚动时保持 60 帧；结构树每一行是单独的组件，改一个字段只更新它那一行。这几个用例在持续集成里有时间上限，变慢数倍时检查会失败。

## API

### Props

| 名称       | 说明                                                               | 类型                                | 默认值           |
| ---------- | ------------------------------------------------------------------ | ----------------------------------- | ---------------- |
| form       | 表单描述                                                           | `FormDocument`                      | —                |
| model      | 字段写入的对象，原地修改                                           | `Record<string, any>`               | 渲染器自己的对象 |
| fields     | 内置之外的字段类型                                                 | `FormFieldType[]`                   | —                |
| rules      | 按字段名追加的规则                                                 | `FormRules`                         | —                |
| disabled   | 禁用全部字段                                                       | `boolean`                           | `false`          |
| readonly   | 把值显示成文字，见[只读展示](#只读展示)                            | `boolean`                           | `false`          |
| functions  | 表达式可以调用的函数，见[联动与表达式](./logic)                    | `Record<string, FormFunction>`      | —                |
| sources    | 选项来源，见[联动与表达式](./logic)                                | `Record<string, FormOptionsLoader>` | —                |
| validators | 规则可以按名字引用的校验函数，见[校验函数](#校验函数)              | `Record<string, FormValidator>`     | —                |
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
| resetFields   | 恢复为初始值并清除错误；不传 `names` 时分步表单回到第一步      | `(names?: string \| string[]) => void`                        |
| clearValidate | 清除错误                                                       | `(names?: string \| string[]) => void`                        |
| setErrors     | 按字段路径显示错误，见[来自服务端的错误](#来自服务端的错误)    | `(errors: Record<string, string>) => void`                    |
| scrollToField | 滚动到字段并聚焦                                               | `(name: string) => void`                                      |
| reloadSource  | 重新加载一个或全部选项来源，见[联动与表达式](./logic#选项来源) | `(name?: string) => void`                                     |
| getValues     | 和 `submit` 相同的值的拷贝                                     | `() => Record<string, any>`                                   |
