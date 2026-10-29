# Dialog 对话框

需要用户集中处理某件事时使用，例如确认操作、填写简短的表单。

浮层的通用行为见 [浮层](../guide/overlays)。

<script setup>
import { ref } from 'vue'
import { dialog, toast } from 'dou-ui'
const basic = ref(false)
const form = ref(false)
const centered = ref(false)
const guarded = ref(false)
const email = ref('')
const confirmLeave = () =>
  dialog.confirm({ title: '放弃修改？', content: '有未保存的修改，关闭后会丢失。', tone: 'warning', confirmText: '放弃' })
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function removeProject() {
  const ok = await dialog.confirm({
    title: '删除项目？',
    content: '项目 dou-ui 的全部部署、域名与环境变量都会被永久删除，此操作无法撤销。',
    tone: 'danger',
    confirmText: '删除',
    onConfirm: () => sleep(1200),
  })
  if (ok) toast.success('已删除')
}
const showAlert = () => dialog.alert({ title: '部署完成', content: 'dou-ui 已上线。', tone: 'success' })
async function rename() {
  const name = await dialog.prompt({
    title: '重命名项目',
    defaultValue: 'dou-ui',
    placeholder: '项目名称',
    validate: (value) => (/^[a-z0-9-]{3,}$/.test(value) ? true : '只能用小写字母、数字和连字符，至少 3 个字符'),
  })
  if (name !== null) toast(`已改名为 ${name}`)
}
</script>

## 基础用法

用 `v-model:open` 控制开关。`footer` 插槽放操作，插槽参数里的 `close` 用来关闭。

<div class="demo">
  <DouButton variant="outline" @click="basic = true">删除项目</DouButton>
  <DouDialog v-model:open="basic" title="删除项目？" :width="420">
    <DouText as="p" variant="secondary">项目 dou-ui 的全部部署、域名与环境变量都会被永久删除，此操作无法撤销。</DouText>
    <template #footer="{ close }">
      <DouButton variant="outline" @click="close">取消</DouButton>
      <DouButton tone="danger" @click="close">删除</DouButton>
    </template>
  </DouDialog>
</div>

```vue
<DouButton variant="outline" @click="open = true">删除项目</DouButton>
<DouDialog v-model:open="open" title="删除项目？" :width="420">
  <DouText as="p" variant="secondary">项目 dou-ui 的全部部署……</DouText>
  <template #footer="{ close }">
    <DouButton variant="outline" @click="close">取消</DouButton>
    <DouButton tone="danger" @click="close">删除</DouButton>
  </template>
</DouDialog>
```

## 放入表单

给第一个输入框加上 `autofocus`，打开时焦点直接落在它上面；否则落在面板本身，读屏先读出标题。

<div class="demo">
  <DouButton variant="outline" @click="form = true">邀请成员</DouButton>
  <DouDialog v-model:open="form" title="邀请成员">
    <DouForm>
      <DouFormItem label="邮箱" help="成员会收到一封邀请邮件">
        <DouInput v-model="email" placeholder="name@example.com" autofocus />
      </DouFormItem>
    </DouForm>
    <template #footer="{ close }">
      <DouButton variant="outline" @click="close">取消</DouButton>
      <DouButton @click="close">发送邀请</DouButton>
    </template>
  </DouDialog>
</div>

## 垂直居中

默认面板离视口顶部 12vh，内容变化时上沿不跳动。`centered` 让它垂直居中。

<div class="demo">
  <DouButton variant="outline" @click="centered = true">居中的对话框</DouButton>
  <DouDialog v-model:open="centered" title="已复制" centered :width="360">
    <DouText as="p" variant="secondary">部署地址已复制到剪贴板。</DouText>
  </DouDialog>
</div>

## 阻止关闭

`before-close` 在关闭按钮、遮罩与 `Esc` 关闭前调用，返回 `false`（或解析为 `false` 的 Promise）则保持打开。`close-on-mask`、`close-on-escape` 可以分别关掉这两种关闭方式。

<div class="demo">
  <DouButton variant="outline" @click="guarded = true">编辑说明</DouButton>
  <DouDialog v-model:open="guarded" title="编辑说明" :before-close="confirmLeave" :close-on-mask="false">
    <DouTextarea placeholder="写点什么……" />
  </DouDialog>
</div>

```vue
<script setup lang="ts">
import { dialog } from 'dou-ui'

// 用下面的函数式确认来问一句
const confirmLeave = () =>
  dialog.confirm({ title: '放弃修改？', tone: 'warning', confirmText: '放弃' })
</script>

<DouDialog v-model:open="open" title="编辑说明" :before-close="confirmLeave" :close-on-mask="false">
  <DouTextarea />
</DouDialog>
```

## 函数式调用

一次性的确认、提示和输入，不必写模板和开关状态：`dialog.confirm()`、`dialog.alert()` 与 `dialog.prompt()` 直接打开一个对话框，返回一个在用户作答后兑现的 Promise。

<div class="demo">
  <DouButton variant="outline" tone="danger" @click="removeProject">删除项目</DouButton>
  <DouButton variant="outline" @click="showAlert">完成提示</DouButton>
  <DouButton variant="outline" @click="rename">重命名</DouButton>
</div>

```ts
import { dialog, toast } from 'dou-ui'

// 确认：true 表示确定，false 表示取消（包括 Esc）
if (await dialog.confirm({ title: '删除项目？', content: '此操作无法撤销。', tone: 'danger' })) {
  await remove()
}

// 提示：只有一个按钮
await dialog.alert({ title: '部署完成', tone: 'success' })

// 输入：确定时得到输入的值，取消时得到 null
const name = await dialog.prompt({
  title: '重命名项目',
  defaultValue: 'dou-ui',
  validate: (value) => value.length >= 3 || '至少 3 个字符',
})
```

只传一个字符串时，它就是正文：`dialog.confirm('确定发布吗？')`。

### 异步确认

`onConfirm` 返回 Promise 时，确定按钮显示加载中，取消与 `Esc` 暂时不可用，对话框等它完成才关闭；Promise 被拒绝时对话框保持打开，可以重试。`prompt` 的 `validate` 返回 `false` 或一段文字时同样保持打开，文字显示在输入框下方并通知读屏。

```ts
await dialog.confirm({
  title: '删除项目？',
  tone: 'danger',
  confirmText: '删除',
  onConfirm: () => api.remove(id), // 请求结束才关闭
})
```

### 语气与焦点

`tone` 只在标题旁加一个语气图标；`danger` 还会把确定按钮染成红色，并让焦点先落在“取消”上，误按 `Enter` 也不会执行危险操作。其他情况焦点落在"确定"，`prompt` 落在输入框。

### 使用应用的配置

对话框沿用安装 DouUI 的那个应用的语言包与层级。一个页面里有多个应用时，在组件里用 `useDialog()` 取得绑定当前应用的同一套方法：

```ts
import { useDialog } from 'dou-ui'

const dialog = useDialog()
```

## 键盘与读屏

面板带有 `role="dialog"` 与 `aria-modal="true"`，由标题命名。打开时焦点移入面板，`Tab` 在面板内循环；`Esc` 关闭，焦点回到打开前的元素。打开期间页面不能滚动。

## API

### Props

| 名称             | 说明                                | 类型                                                | 默认值   |
| ---------------- | ----------------------------------- | --------------------------------------------------- | -------- |
| `open`           | 是否打开，配合 `v-model:open`       | `boolean`                                           | `false`  |
| `title`          | 标题，同时为对话框命名              | `string`                                            | —        |
| `width`          | 面板宽度；数字为 px                 | `string \| number`                                  | `480px`  |
| `centered`       | 垂直居中                            | `boolean`                                           | `false`  |
| `closable`       | 显示右上角的关闭按钮                | `boolean`                                           | `true`   |
| `closeOnMask`    | 点击遮罩关闭                        | `boolean`                                           | `true`   |
| `closeOnEscape`  | 按 `Esc` 关闭                       | `boolean`                                           | `true`   |
| `lockScroll`     | 打开期间锁定页面滚动                | `boolean`                                           | `true`   |
| `destroyOnClose` | 关闭后卸载内容                      | `boolean`                                           | `false`  |
| `beforeClose`    | 关闭前调用，返回 `false` 则保持打开 | `() => boolean \| void \| Promise<boolean \| void>` | —        |
| `teleport`       | 渲染到哪里；`false` 为原地渲染      | `string \| HTMLElement \| false`                    | `'body'` |

### Events

| 名称          | 说明         |
| ------------- | ------------ |
| `update:open` | 打开状态变化 |
| `open`        | 开始打开     |
| `opened`      | 打开动画结束 |
| `close`       | 开始关闭     |
| `closed`      | 关闭动画结束 |

### Slots

| 名称      | 说明                       |
| --------- | -------------------------- |
| `default` | 内容                       |
| `title`   | 标题，替代 `title`         |
| `footer`  | 底部操作；参数 `{ close }` |

### 方法

| 名称      | 说明                       |
| --------- | -------------------------- |
| `close()` | 关闭，会经过 `beforeClose` |

### 函数

| 名称                      | 说明                               | 返回                      |
| ------------------------- | ---------------------------------- | ------------------------- |
| `dialog.confirm(options)` | 确认对话框，"确定" + "取消"        | `Promise<boolean>`        |
| `dialog.alert(options)`   | 提示对话框，只有"确定"             | `Promise<void>`           |
| `dialog.prompt(options)`  | 输入对话框                         | `Promise<string \| null>` |
| `dialog.closeAll()`       | 以"取消"关闭所有函数式打开的对话框 | —                         |
| `useDialog()`             | 绑定当前组件所在应用的同一套方法   | `DialogApi`               |

返回的 Promise 上还有 `close()`，以"取消"关闭这一个对话框。

### 函数的选项

| 名称            | 说明                                                          | 类型                                                            | 默认值   |
| --------------- | ------------------------------------------------------------- | --------------------------------------------------------------- | -------- |
| `title`         | 标题                                                          | `string`                                                        | —        |
| `content`       | 正文；可以是返回 VNode 的函数                                 | `string \| () => VNodeChild`                                    | —        |
| `tone`          | 语气：加语气图标；`danger` 时确定按钮为红色、焦点先落在取消上 | `Tone`                                                          | —        |
| `confirmText`   | 确定按钮文字                                                  | `string`                                                        | 语言包   |
| `cancelText`    | 取消按钮文字（`alert` 没有）                                  | `string`                                                        | 语言包   |
| `width`         | 面板宽度；数字为 px                                           | `string \| number`                                              | `420`    |
| `closeOnMask`   | 点击遮罩视为取消                                              | `boolean`                                                       | `false`  |
| `closeOnEscape` | 按 `Esc` 视为取消                                             | `boolean`                                                       | `true`   |
| `onConfirm`     | 按下确定时调用；返回 Promise 时等它完成，被拒绝则保持打开     | `(value) => unknown`                                            | —        |
| `defaultValue`  | `prompt` 输入框的初始值                                       | `string`                                                        | `''`     |
| `placeholder`   | `prompt` 输入框的占位文字                                     | `string`                                                        | —        |
| `inputType`     | `prompt` 输入框的 `type`                                      | `'text' \| 'password' \| 'email' \| 'url' \| 'tel' \| 'number'` | `'text'` |
| `validate`      | `prompt` 关闭前校验；返回 `false` 或一段文字时保持打开        | `(value) => boolean \| string \| void \| Promise<…>`            | —        |

### CSS 变量

| 变量                   | 说明                 |
| ---------------------- | -------------------- |
| `--dou-dialog-mask`    | 遮罩颜色             |
| `--dou-dialog-bg`      | 面板底色             |
| `--dou-dialog-width`   | 默认宽度             |
| `--dou-dialog-top`     | 不居中时离顶部的距离 |
| `--dou-dialog-radius`  | 圆角                 |
| `--dou-dialog-padding` | 内边距               |
