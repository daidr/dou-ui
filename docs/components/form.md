# Form 表单

`DouForm` 与 `DouFormItem` 是包在控件外面的一层**表单上下文**：标签、说明、校验信息由表单项负责，并自动接到控件的读屏属性上；尺寸、禁用、无效状态从表单一路下发给 Input、Checkbox、Radio、Switch、Button。

表单本身是安静的结构：中等字重的标签，次要墨色的说明，危险语气的错误信息。校验规则是内置的一小组声明式检查加自定义函数，不依赖第三方库。

<script setup>
import { reactive, ref } from 'vue'

const account = reactive({ email: '', password: '', role: '', agree: false })
const rules = {
  email: [{ required: true }, { type: 'email' }],
  password: [{ required: true }, { min: 8 }],
  role: { required: true, message: '请选择一个角色' },
  agree: { required: true, message: '需要同意服务条款' },
}
const submitted = ref('')
function onSubmit(model) {
  submitted.value = JSON.stringify(model)
}

const profile = reactive({ name: 'dou-ui', domain: '', notify: ['deploy'], previews: true })
const profileRules = {
  name: { required: true, pattern: /^[\da-z-]+$/, message: '只能包含小写字母、数字和连字符' },
  notify: { type: 'array', min: 1 },
}

const filters = reactive({ keyword: '', status: 'all' })

const signup = reactive({ username: '' })
const taken = ['admin', 'root', 'daidr']
const signupRules = {
  username: [
    { required: true },
    {
      validator: (value) =>
        new Promise((resolve) =>
          setTimeout(() => resolve(taken.includes(value) ? '用户名已被占用' : true), 400),
        ),
    },
  ],
}
</script>

## 基础用法

给 `DouForm` 传入 `model` 与 `rules`，给每个 `DouFormItem` 一个 `prop` 指向 `model` 中的字段。提交按钮使用 `native-type="submit"`，表单校验通过后触发 `submit`，否则触发 `invalid`，并把第一个出错的字段滚动到视野内、移交焦点。

<div class="demo demo--column" style="max-width: 420px">
  <DouForm :model="account" :rules="rules" @submit="onSubmit">
    <DouFormItem label="邮箱" prop="email">
      <DouInput v-model="account.email" placeholder="you@example.com" />
    </DouFormItem>
    <DouFormItem label="密码" prop="password" help="至少 8 个字符">
      <DouInput v-model="account.password" type="password" />
    </DouFormItem>
    <DouFormItem label="角色" prop="role">
      <DouRadioGroup v-model="account.role">
        <DouRadio value="dev">开发</DouRadio>
        <DouRadio value="design">设计</DouRadio>
        <DouRadio value="pm">产品</DouRadio>
      </DouRadioGroup>
    </DouFormItem>
    <DouFormItem prop="agree">
      <DouCheckbox v-model="account.agree">我已阅读并同意服务条款</DouCheckbox>
    </DouFormItem>
    <DouFormItem>
      <DouButton native-type="submit">创建账号</DouButton>
      <DouButton native-type="reset" variant="ghost">重置</DouButton>
    </DouFormItem>
  </DouForm>
  <DouText v-if="submitted" variant="tertiary" size="sm" mono>{{ submitted }}</DouText>
</div>

```vue
<script setup lang="ts">
import { reactive } from 'vue'
import type { FormModel, FormRules } from 'dou-ui'

const account = reactive({ email: '', password: '', role: '', agree: false })
const rules: FormRules = {
  email: [{ required: true }, { type: 'email' }],
  password: [{ required: true }, { min: 8 }],
  role: { required: true, message: '请选择一个角色' },
  agree: { required: true, message: '需要同意服务条款' },
}

function onSubmit(model: FormModel) {
  // 所有字段都已通过校验
}
</script>

<template>
  <DouForm :model="account" :rules="rules" @submit="onSubmit">
    <DouFormItem label="邮箱" prop="email">
      <DouInput v-model="account.email" />
    </DouFormItem>
    <DouFormItem label="密码" prop="password" help="至少 8 个字符">
      <DouInput v-model="account.password" type="password" />
    </DouFormItem>
    <DouFormItem label="角色" prop="role">
      <DouRadioGroup v-model="account.role">...</DouRadioGroup>
    </DouFormItem>
    <DouFormItem prop="agree">
      <DouCheckbox v-model="account.agree">我已阅读并同意服务条款</DouCheckbox>
    </DouFormItem>
    <DouFormItem>
      <DouButton native-type="submit">创建账号</DouButton>
      <DouButton native-type="reset" variant="ghost">重置</DouButton>
    </DouFormItem>
  </DouForm>
</template>
```

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
| `message`   | 替换默认错误信息                                                             |
| `trigger`   | 限定在哪些事件上运行                                                         |

除 `required` 与 `validator` 外，内置检查只看有值的字段，所以可选字段可以留空。`false` 视为空，适合"必须勾选同意"这类开关。默认错误信息来自 [全局配置](./config-provider) 中的语言包。

### 异步校验

`validator` 返回 Promise 即可。同一字段连续触发多次校验时，只采纳最后一次的结果。

<div class="demo demo--column" style="max-width: 420px">
  <DouForm :model="signup" :rules="signupRules">
    <DouFormItem label="用户名" prop="username" help="试试 admin">
      <DouInput v-model="signup.username" />
    </DouFormItem>
  </DouForm>
</div>

```ts
const rules: FormRules = {
  username: [
    { required: true },
    { validator: async (value) => ((await isTaken(value)) ? '用户名已被占用' : true) },
  ],
}
```

### 来自服务端的错误

`DouFormItem` 的 `error` 会直接显示，不经过规则：

```vue
<DouFormItem label="域名" prop="domain" :error="serverErrors.domain">
  <DouInput v-model="form.domain" />
</DouFormItem>
```

## 布局

### 水平

`layout="horizontal"` 时标签在左侧排成一列。表单是一个网格，所有表单项共享它的列，所以**标签列会自动取最长标签的宽度**，不需要猜一个固定的 `label-width`。没有标签的表单项（例如按钮行）自动与控件列对齐。

<div class="demo demo--column" style="max-width: 520px">
  <DouForm :model="profile" :rules="profileRules" layout="horizontal" label-align="end">
    <DouFormItem label="项目名称" prop="name">
      <DouInput v-model="profile.name" clearable />
    </DouFormItem>
    <DouFormItem label="自定义域名" prop="domain" help="解析生效后自动签发证书">
      <DouInput v-model="profile.domain" placeholder="example.com">
        <template #prefix>https://</template>
      </DouInput>
    </DouFormItem>
    <DouFormItem label="预览">
      <DouSwitch v-model="profile.previews">为每个分支生成预览</DouSwitch>
    </DouFormItem>
    <DouFormItem label="通知" prop="notify">
      <DouCheckboxGroup v-model="profile.notify">
        <DouCheckbox value="deploy">部署成功</DouCheckbox>
        <DouCheckbox value="fail">部署失败</DouCheckbox>
      </DouCheckboxGroup>
    </DouFormItem>
    <DouFormItem>
      <DouButton native-type="submit">保存</DouButton>
    </DouFormItem>
  </DouForm>
</div>

```vue
<DouForm :model="form" layout="horizontal" label-align="end">
  <DouFormItem label="项目名称" prop="name">...</DouFormItem>
  <DouFormItem label="自定义域名" prop="domain">...</DouFormItem>
  <DouFormItem>
    <DouButton native-type="submit">保存</DouButton>
  </DouFormItem>
</DouForm>
```

标签与控件的第一行共享一条中线，无论控件是输入框、开关还是一组单选。需要固定宽度时，用表单或单个表单项的 `label-width`。自动对齐要求表单项是表单的直接子元素。

### 行内

`layout="inline"` 让表单项排成一行，适合筛选栏。

<div class="demo">
  <DouForm :model="filters" layout="inline" size="sm">
    <DouFormItem label="关键词">
      <DouInput v-model="filters.keyword" clearable placeholder="搜索" style="width: 180px" />
    </DouFormItem>
    <DouFormItem label="状态">
      <DouRadioGroup v-model="filters.status">
        <DouRadio value="all">全部</DouRadio>
        <DouRadio value="ready">就绪</DouRadio>
        <DouRadio value="failed">失败</DouRadio>
      </DouRadioGroup>
    </DouFormItem>
    <DouFormItem>
      <DouButton variant="outline">筛选</DouButton>
    </DouFormItem>
  </DouForm>
</div>

## 必填与可选标记

默认在必填字段的标签后显示星号。当表单里大多数字段都是必填时，`required-mark="optional"` 改为只给可选字段标上"可选"，信息更少，也更准确；`false` 则什么都不标。

```vue
<DouForm required-mark="optional">...</DouForm>
```

星号对读屏软件隐藏，必填状态通过控件上的 `aria-required` 传达。

## 尺寸与禁用

表单的 `size` 与 `disabled` 会下发给内部所有控件（包括按钮），控件自己设置的 `size` 优先。没有设置时，尺寸取自 [全局配置](./config-provider)。

```vue
<DouForm size="sm" disabled>...</DouForm>
```

## 可访问性

- 标签是真正的 `<label for>`，指向控件的可聚焦元素，点击标签即可聚焦。
- 多选组、单选组没有单一的可聚焦元素，标签改为通过 `aria-labelledby` 为整组命名。
- 说明与错误放在同一个 `aria-live="polite"` 区域，并通过 `aria-describedby` 关联到控件；出错时控件带 `aria-invalid`。
- 提交失败时，焦点移到第一个出错的字段。

## 接入自定义控件

自己写的控件可以通过 `useFormItem()` 接入同一套上下文：

```ts
import { useFormDisabled, useFormItem, useFormSize } from 'dou-ui'

const { formItem } = useFormItem()
const size = useFormSize(() => props.size)
const disabled = useFormDisabled(() => props.disabled)

// 把 formItem.inputId 给可聚焦元素，formItem.describedBy 给 aria-describedby，
// 值变化时调用 formItem.trigger('change')，失焦时调用 formItem.trigger('blur')。
```

## API

### Form Props

| 名称            | 说明                                   | 类型                                     | 默认值       |
| --------------- | -------------------------------------- | ---------------------------------------- | ------------ |
| `model`         | 表单数据                               | `Record<string, any>`                    | —            |
| `rules`         | 按字段路径的校验规则                   | `FormRules`                              | —            |
| `layout`        | 布局                                   | `'vertical' \| 'horizontal' \| 'inline'` | `'vertical'` |
| `labelAlign`    | 水平布局中标签的对齐                   | `'start' \| 'end'`                       | `'start'`    |
| `labelWidth`    | 水平布局中标签列的宽度，默认取最长标签 | `string \| number`                       | —            |
| `size`          | 内部控件的尺寸                         | `'sm' \| 'md' \| 'lg'`                   | —            |
| `disabled`      | 禁用内部所有控件                       | `boolean`                                | `false`      |
| `requiredMark`  | 必填 / 可选标记                        | `boolean \| 'optional'`                  | `true`       |
| `scrollToError` | 提交失败时滚动到第一个错误字段并聚焦   | `boolean`                                | `true`       |

### Form Events

| 名称      | 说明                   | 参数                   |
| --------- | ---------------------- | ---------------------- |
| `submit`  | 提交且全部字段通过校验 | `(model: FormModel)`   |
| `invalid` | 提交但有字段未通过校验 | `(errors: FormErrors)` |
| `reset`   | 表单被重置             | —                      |

### Form 实例方法

| 名称            | 说明                                       | 类型                                                          |
| --------------- | ------------------------------------------ | ------------------------------------------------------------- |
| `validate`      | 校验指定字段或全部字段，永不 reject        | `(props?: string \| string[]) => Promise<FormValidateResult>` |
| `resetFields`   | 恢复指定字段或全部字段的初始值，并清除错误 | `(props?: string \| string[]) => void`                        |
| `clearValidate` | 清除指定字段或全部字段的错误               | `(props?: string \| string[]) => void`                        |
| `scrollToField` | 滚动到字段并聚焦                           | `(prop: string) => void`                                      |

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

### FormItem 实例方法

| 名称       | 说明                 | 类型                            |
| ---------- | -------------------- | ------------------------------- |
| `error`    | 当前显示的错误       | `string`                        |
| `validate` | 校验该字段           | `() => Promise<string \| null>` |
| `reset`    | 恢复初始值并清除错误 | `() => void`                    |
| `clear`    | 清除错误             | `() => void`                    |

### CSS 变量

| 变量                          | 说明                   |
| ----------------------------- | ---------------------- |
| `--dou-form-gap`              | 表单项之间的间距       |
| `--dou-form-label-gap`        | 标签与控件之间的间距   |
| `--dou-form-label-width`      | 水平布局中标签列的宽度 |
| `--dou-form-item-label-color` | 标签颜色               |
| `--dou-form-item-help-color`  | 说明颜色               |
| `--dou-form-item-error-color` | 错误与星号颜色         |
