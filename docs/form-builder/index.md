---
wide: true
---

# 表单设计器

`@dou-ui/form-builder` 用一份 JSON 描述表单：有哪些字段、怎么排版、要满足哪些规则。`DouFormRenderer` 把这份描述渲染成 `DouForm`，校验、重置、滚动到出错字段这些行为和手写的表单一样。

描述是普通数据，可以存进数据库、从接口取回，适合问卷、报名表、审批单这类经常调整、需要由使用者自己配置的表单。[设计器](./builder) `DouFormBuilder` 可以可视化地编辑这份描述。

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

`form` 是表单描述，格式见[表单描述](./document)。`model` 是字段写入的对象。

<DocDemo src="form-builder/basic" column />

- 传入 `reactive` 对象就能随时读到填写的值；描述里有、`model` 里还没有的字段会先填上默认值。
- 不传 `model` 时渲染器自己建一个，可以从 `submit` 事件或组件实例的 `model` 拿到。
- 默认插槽放在所有字段后面，通常放提交和重置按钮。

设计器和渲染器配合使用的完整页面见区块：[活动报名表](/blocks/event-signup)、[设备报修单](/blocks/repair-order)。

## 提交

提交时先校验全部字段，都通过才触发 `submit`，否则触发 `invalid` 并滚动到第一个出错的字段。`submit` 拿到的是值的拷贝，默认不含隐藏字段的值，见[隐藏字段的值](./structure#隐藏字段的值)。

字段被填写时触发 `change(name, value)`，可以用来自动保存草稿或刷新预览，不必深度监听 `model`。重置表单、或者从外部直接修改 `model` 时不会触发。

## API

### FormRenderer Props

| 名称       | 说明                                                               | 类型                                | 默认值           |
| ---------- | ------------------------------------------------------------------ | ----------------------------------- | ---------------- |
| form       | 表单描述                                                           | `FormDocument`                      | —                |
| model      | 字段写入的对象，原地修改                                           | `Record<string, any>`               | 渲染器自己的对象 |
| fields     | 内置之外的字段类型                                                 | `FormFieldType[]`                   | —                |
| rules      | 按字段名追加的规则                                                 | `FormRules`                         | —                |
| disabled   | 禁用全部字段                                                       | `boolean`                           | `false`          |
| readonly   | 把值显示成文字，见[只读展示](./readonly)                           | `boolean`                           | `false`          |
| functions  | 表达式可以调用的函数，见[联动与表达式](./logic)                    | `Record<string, FormFunction>`      | —                |
| sources    | 选项来源，见[联动与表达式](./logic)                                | `Record<string, FormOptionsLoader>` | —                |
| validators | 规则可以按名字引用的校验函数，见[校验函数](./validation#校验函数)  | `Record<string, FormValidator>`     | —                |
| keepHidden | 提交时保留隐藏字段的值，见[隐藏字段的值](./structure#隐藏字段的值) | `boolean`                           | `false`          |
| messages   | 替换部分文字，见[文字](./structure#文字)                           | `FormRendererMessagesOverride`      | —                |

### FormRenderer Events

| 名称    | 说明                                                   | 参数                               |
| ------- | ------------------------------------------------------ | ---------------------------------- |
| change  | 字段被填写                                             | `(name: string, value: unknown)`   |
| submit  | 提交且全部字段通过，拿到值的拷贝，默认不含隐藏字段的值 | `(values)`                         |
| invalid | 提交但有字段未通过                                     | `(errors: Record<string, string>)` |
| reset   | 重置为初始值                                           | —                                  |

### FormRenderer Slots

| 名称    | 说明                                                   |
| ------- | ------------------------------------------------------ |
| default | 放在所有字段后面，通常是按钮；表单是分步时放在最后一步 |

### FormRenderer Exposes

| 名称          | 说明                                                                                        | 类型                                                          |
| ------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| model         | 字段写入的对象                                                                              | `Record<string, any>`                                         |
| validate      | 检查给定字段或全部字段，不会抛错                                                            | `(names?: string \| string[]) => Promise<FormValidateResult>` |
| resetFields   | 恢复为初始值并清除错误；不传 `names` 时分步表单回到第一步                                   | `(names?: string \| string[]) => void`                        |
| clearValidate | 清除错误                                                                                    | `(names?: string \| string[]) => void`                        |
| setErrors     | 按字段路径显示错误，返回没能显示的路径，见[来自服务端的错误](./validation#来自服务端的错误) | `(errors: Record<string, string \| undefined>) => string[]`   |
| scrollToField | 滚动到字段并聚焦                                                                            | `(name: string) => void`                                      |
| reloadSource  | 重新加载一个或全部选项来源，见[联动与表达式](./logic#选项来源)                              | `(name?: string) => void`                                     |
| getValues     | 和 `submit` 相同的值的拷贝                                                                  | `() => Record<string, any>`                                   |
