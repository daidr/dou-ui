---
wide: true
---

# 校验

描述里的规则会转成 `DouForm` 的规则，检查时机也一样：文本框失焦时检查，出错后每次输入都重新检查；选择类字段每次改动都检查。

## 规则

`required: true` 是必填的简写，`rules` 里写其他规则：

- `type`：`string`、`number`、`integer`、`email`、`url`；
- `min` / `max`：文字长度、选中项数或数值大小；
- `pattern`：正则表达式的源码字符串；
- `message` 和 `trigger`：出错时的提示和检查时机。

```json
{
  "id": "phone",
  "type": "input",
  "name": "phone",
  "label": "手机号",
  "required": true,
  "rules": [{ "pattern": "^1\\d{10}$", "message": "请填写 11 位手机号" }]
}
```

除了 `required`，其他规则不检查空值（空文字、空数组、`null`），空着的字段总能通过它们。要求“至少选一项”时写 `required` 并配上合适的 `message`，`min` 只在选了之后限制数量。

规则里还可以写 `check` 表达式，和其他字段的值比较，见[联动与表达式](./logic#用表达式校验)。规则的完整写法见[表单描述](./document#规则)。

## 校验函数

表达式做不到的检查，比如向服务端确认账号是否可用，写成校验函数，通过渲染器的 `validators` 按名字注册。描述里的规则只写名字：

```ts
{ validator: 'accountFree', message: '这个账号已被占用' }
```

这和 `sources`、`functions` 的做法一样，描述里不会出现函数，仍然可以存成 JSON、在设计器里编辑。

<DocDemo src="form-builder/rules" column />

校验函数拿到字段的值和 `{ values, item, path }`：

- `values` 是整个表单；
- `item` 是字段所在的列表项，不在列表里时为 `null`；
- `path` 是字段的完整路径，比如 `guests.2.phone`，同一个函数可以给几个字段用。

返回 `true` 或不返回为通过，返回 `false` 时显示规则的 `message`，返回字符串时显示这个字符串。

- 可以是 async，同一个字段连续检查时只采纳最后一次的结果；请求接口的检查适合写 `trigger: 'blur'`，避免每输入一个字都请求一次。
- 和其他规则一样，空值不会交给它。
- 描述里写了、`validators` 里没有的名字会被当作通过，并在控制台提示一次。

## 代码里的规则

只在代码里用、不需要放进描述的检查，可以写在组件的 `rules` 属性里，按字段名合并到描述的规则上。写法和 `DouForm` 的规则一样，也可以写 Standard Schema。

## 来自服务端的错误

有些错误要提交之后才知道。把服务端返回的错误按字段路径交给实例方法 `setErrors`，它们显示在对应的字段上，改动这个字段或再次检查它时消失。错误在其他标签页或其他步骤里时，标签和步骤条上同样会标出来。

<DocDemo src="form-builder/server-errors" column />

- `setErrors` 只设置传入的字段，传空字符串或 `undefined` 清除某个字段的错误。
- `items[0].name` 这样的方括号写法按 `items.0.name` 处理。
- 需要带用户去看时，接着调用 `scrollToField(第一个路径)`，它会切到字段所在的标签页或步骤。

没有对应字段的路径不会显示，比如写错的名字、当前隐藏的字段。`setErrors` 把这些路径作为数组返回，开发环境下还会在控制台提示。把它们放在表单上方的提示里，用户才不会漏看：

```ts
import { DouFormRenderer } from '@dou-ui/form-builder'
import { ref, useTemplateRef } from 'vue'

const renderer = useTemplateRef<InstanceType<typeof DouFormRenderer>>('renderer')
const notice = ref('')

function showErrors(errors: Record<string, string>) {
  const missed = renderer.value?.setErrors(errors) ?? []
  notice.value = missed.map((path) => errors[path]).join('；')
}
```

## API

### 相关 Props

| 名称         | 说明                         | 类型                            | 默认值 |
| ------------ | ---------------------------- | ------------------------------- | ------ |
| `rules`      | 按字段名追加的规则           | `FormRules`                     | —      |
| `validators` | 规则可以按名字引用的校验函数 | `Record<string, FormValidator>` | —      |

### FormValidator

`(value, { values, item, path }) => boolean | string | void | Promise<boolean | string | void>`

### 相关 Exposes

| 名称            | 说明                                   | 类型                                                          |
| --------------- | -------------------------------------- | ------------------------------------------------------------- |
| `validate`      | 检查给定字段或全部字段，不会抛错       | `(names?: string \| string[]) => Promise<FormValidateResult>` |
| `clearValidate` | 清除错误                               | `(names?: string \| string[]) => void`                        |
| `setErrors`     | 按字段路径显示错误，返回没能显示的路径 | `(errors: Record<string, string \| undefined>) => string[]`   |
| `scrollToField` | 滚动到字段并聚焦                       | `(name: string) => void`                                      |
