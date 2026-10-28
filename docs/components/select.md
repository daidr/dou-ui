# Select 选择器

从一列选项里选一个或几个。字段与 [输入框](./input) 画法完全一致，在表单里能对齐；末尾的箭头表示可以展开。列表是一块菜单表面，行与 [下拉菜单](./dropdown) 的项一致，选中的项带一个对勾。

列表的定位、层级与关闭行为见 [浮层](../guide/overlays)。

<script setup>
import { ref } from 'vue'
const region = ref('sh')
const channels = ref(['邮件', 'Webhook'])
const framework = ref(null)
const empty = ref(null)
const regions = [
  { value: 'sh', label: '上海' },
  { value: 'sg', label: '新加坡' },
  { value: 'fra', label: '法兰克福' },
  { value: 'iad', label: '弗吉尼亚', disabled: true },
  { value: 'sfo', label: '旧金山' },
]
const grouped = [
  { label: '亚太', options: [{ value: 'sh', label: '上海' }, { value: 'sg', label: '新加坡' }, { value: 'syd', label: '悉尼' }] },
  { label: '欧洲', options: [{ value: 'fra', label: '法兰克福' }, { value: 'lhr', label: '伦敦' }] },
  { label: '美洲（即将开放）', disabled: true, options: [{ value: 'iad', label: '弗吉尼亚' }] },
]
const groupedValue = ref('sg')
const packages = ['dou-ui', '@dou-ui/theme', '@dou-ui/icons', '@dou-ui/resolver', 'vue', 'vue-router', 'pinia', 'vite', 'vitest', 'vitepress', 'typescript', 'oxlint']
const remoteOptions = ref([])
const remoteLoading = ref(false)
const remoteValue = ref(null)
let remoteTimer
function search(query) {
  remoteLoading.value = true
  clearTimeout(remoteTimer)
  remoteTimer = setTimeout(() => {
    const text = query.trim().toLowerCase()
    remoteOptions.value = packages.filter((name) => name.includes(text)).map((name) => ({ value: name, label: name }))
    remoteLoading.value = false
  }, 600)
}
const labels = ref(['bug'])
const users = Array.from({ length: 5000 }, (_, i) => ({ value: i + 1, label: `用户 ${String(i + 1).padStart(4, '0')}` }))
const user = ref(4321)
</script>

## 基础用法

`options` 是选项列表，字符串或数字同时作为值和标签；对象形式为 `{ value, label, disabled }`。

<div class="demo demo--column" style="max-width: 360px">
  <DouSelect v-model="region" :options="regions" />
  <DouText variant="tertiary" size="sm">当前值：{{ region }}</DouText>
</div>

```vue
<DouSelect
  v-model="region"
  :options="[
    { value: 'sh', label: '上海' },
    { value: 'sg', label: '新加坡' },
    { value: 'iad', label: '弗吉尼亚', disabled: true },
  ]"
/>
```

## 可清空与占位

`clearable` 在有值时显示清空按钮，清空后值为 `null`。`placeholder` 默认取语言包里的"请选择"。

<div class="demo demo--column" style="max-width: 360px">
  <DouSelect v-model="empty" :options="regions" clearable placeholder="选择部署区域" />
</div>

## 多选

`multiple` 时值是数组，选中的项显示为可移除的标签；列表在选择后保持打开。

<div class="demo demo--column" style="max-width: 360px">
  <DouSelect v-model="channels" multiple :options="['邮件', '短信', 'Webhook', 'Slack']" />
</div>

```vue
<DouSelect v-model="channels" multiple :options="['邮件', '短信', 'Webhook', 'Slack']" />
```

## 可搜索

`filterable` 把字段变成输入框，输入的文字按标签筛选选项。没有匹配时显示 `empty` 插槽或语言包里的"无匹配项"。多选时，搜索框为空按 `Backspace` 会移除最后一个标签。

<div class="demo demo--column" style="max-width: 360px">
  <DouSelect v-model="framework" filterable clearable placeholder="搜索框架" :options="['Vue', 'Vite', 'Nuxt', 'VitePress', 'Astro', '静态站点']" />
</div>

```vue
<DouSelect v-model="framework" filterable placeholder="搜索框架" :options="frameworks" />
```

## 分组

选项可以放进 `{ label, options }` 分组，组名是一行淡色的小字，组与组之间一条细线。分组上的 `disabled` 禁用组里的所有选项。

<div class="demo" style="max-width: 360px">
  <DouSelect v-model="groupedValue" :options="grouped" />
</div>

```ts
const options = [
  {
    label: '亚太',
    options: [
      { value: 'sh', label: '上海' },
      { value: 'sg', label: '新加坡' },
    ],
  },
  { label: '欧洲', options: [{ value: 'fra', label: '法兰克福' }] },
  { label: '美洲（即将开放）', disabled: true, options: ['iad'] },
]
```

## 远程搜索

`remote` 把搜索交给你：输入停顿 `search-delay`（默认 300ms）后触发 `search`，打开时也会触发一次；把结果换进 `options` 即可，组件不再自己筛选。请求期间设 `loading`，列表里显示加载中。已经选中的值即使不在新结果里，也会记得它的标签。

<div class="demo" style="max-width: 360px">
  <DouSelect v-model="remoteValue" :options="remoteOptions" :loading="remoteLoading" remote clearable placeholder="搜索 npm 包" @search="search" />
</div>

```vue
<DouSelect
  v-model="pkg"
  :options="results"
  :loading="loading"
  remote
  @search="
    async (query) => {
      loading = true
      results = await api.search(query)
      loading = false
    }
  "
/>
```

## 可创建

`creatable` 在输入的文字没有完全匹配的选项时，把它作为第一项"创建“…”"提供出来；选中后它就成为一个普通选项，并触发 `create`。适合标签这类可以随手新增的值。

<div class="demo" style="max-width: 360px">
  <DouSelect v-model="labels" :options="['bug', 'docs', 'feature', 'perf']" multiple creatable placeholder="添加标签" />
</div>

```vue
<DouSelect v-model="labels" :options="['bug', 'docs', 'feature']" multiple creatable />
```

## 虚拟滚动

选项成千上万时打开 `virtual`，列表只渲染看得见的那些；键盘移动时会自动滚到当前项。下面是五千个选项。

<div class="demo" style="max-width: 360px">
  <DouSelect v-model="user" :options="users" virtual filterable />
</div>

```vue
<DouSelect v-model="user" :options="users" virtual filterable />
```

## 尺寸、禁用与表单

尺寸、禁用与校验状态与输入框一致，也会从 [表单](./form) 继承。

<div class="demo demo--column" style="max-width: 360px">
  <DouSelect v-for="size in ['sm', 'md', 'lg']" :key="size" v-model="region" :size="size" :options="regions" />
  <DouSelect v-model="region" disabled :options="regions" />
  <DouSelect v-model="empty" invalid :options="regions" />
</div>

## 自定义选项

`option` 插槽替换每个选项的内容，参数为 `{ option, selected }`。

<div class="demo demo--column" style="max-width: 360px">
  <DouSelect v-model="region" :options="regions">
    <template #option="{ option }">
      {{ option.label }}
      <DouText variant="tertiary" size="sm" style="margin-left: 6px">{{ option.value }}</DouText>
    </template>
  </DouSelect>
</div>

## 键盘与读屏

字段是 `role="combobox"`，列表是 `role="listbox"`，每项是 `role="option"` 并标注 `aria-selected`。焦点始终留在字段上，高亮项通过 `aria-activedescendant` 告诉读屏。

| 按键           | 作用                                       |
| -------------- | ------------------------------------------ |
| `↓` / `↑`      | 打开列表；打开后在可选项之间移动，首尾循环 |
| `Home` / `End` | 第一项 / 最后一项（不可搜索时）            |
| `Enter`        | 打开列表，或选中高亮项                     |
| `Space`        | 同 `Enter`（不可搜索时）                   |
| 字母           | 跳到下一个以它开头的项（不可搜索时）       |
| `Esc`          | 关闭列表                                   |
| `Tab`          | 关闭列表，焦点继续向后                     |

放在 [表单项](./form) 中时，可搜索的选择器由 `<label for>` 命名，其余由 `aria-labelledby` 命名。

分组用 `role="group"` 包住组内选项，并由组名命名。虚拟滚动时每个选项带 `aria-setsize` 与 `aria-posinset`，读屏仍能报出"第几项，共几项"。远程加载中的提示是 `role="status"`。

## API

### Props

| 名称          | 说明                                                           | 类型                                                        | 默认值           |
| ------------- | -------------------------------------------------------------- | ----------------------------------------------------------- | ---------------- |
| `modelValue`  | 选中值，多选时为数组，配合 `v-model`                           | `SelectValue \| SelectValue[] \| null`                      | —                |
| `options`     | 选项；字符串或数字同时作为值和标签；可以分组                   | `(SelectOption \| SelectOptionGroup \| string \| number)[]` | —                |
| `multiple`    | 多选                                                           | `boolean`                                                   | `false`          |
| `filterable`  | 输入文字筛选选项                                               | `boolean`                                                   | `false`          |
| `placeholder` | 未选择时的提示                                                 | `string`                                                    | 语言包           |
| `size`        | 尺寸，默认取表单或全局配置                                     | `'sm' \| 'md' \| 'lg'`                                      | `'md'`           |
| `disabled`    | 禁用                                                           | `boolean`                                                   | `false`          |
| `invalid`     | 无效状态                                                       | `boolean`                                                   | `false`          |
| `clearable`   | 显示清空按钮                                                   | `boolean`                                                   | `false`          |
| `placement`   | 列表首选的位置                                                 | `Placement`                                                 | `'bottom-start'` |
| `teleport`    | 列表渲染到哪里；`false` 为原地渲染                             | `string \| HTMLElement \| false`                            | `'body'`         |
| `ariaLabel`   | 没有可见标签时的读屏名称                                       | `string`                                                    | —                |
| `remote`      | 远程搜索：输入时触发 `search`，不在本地筛选；隐含 `filterable` | `boolean`                                                   | `false`          |
| `searchDelay` | 输入停顿多久后触发 `search`，毫秒                              | `number`                                                    | `300`            |
| `loading`     | 列表里显示加载中                                               | `boolean`                                                   | `false`          |
| `creatable`   | 没有完全匹配时，把输入的文字作为新选项；隐含 `filterable`      | `boolean`                                                   | `false`          |
| `virtual`     | 只渲染看得见的选项                                             | `boolean`                                                   | `false`          |

`SelectValue` 为 `string | number | boolean`，`SelectOption` 为 `{ value: SelectValue; label?: string; disabled?: boolean }`，`SelectOptionGroup` 为 `{ label: string; options: (SelectOption | string | number)[]; disabled?: boolean }`。

### Events

| 名称                | 说明                                     | 参数                                            |
| ------------------- | ---------------------------------------- | ----------------------------------------------- |
| `update:modelValue` | 值变化                                   | `(value: SelectValue \| SelectValue[] \| null)` |
| `change`            | 用户选择或移除了项                       | `(value: SelectValue \| SelectValue[] \| null)` |
| `clear`             | 按下清空按钮                             | —                                               |
| `search`            | 远程搜索的文字变化（停顿后），以及打开时 | `(query: string)`                               |
| `create`            | 从输入的文字创建了新选项                 | `(value: string)`                               |

### Slots

| 名称     | 说明                                    |
| -------- | --------------------------------------- |
| `prefix` | 字段内、值之前的内容，通常是图标        |
| `option` | 选项内容，参数为 `{ option, selected }` |
| `empty`  | 没有匹配项时显示                        |

### 方法

| 名称      | 说明 |
| --------- | ---- |
| `focus()` | 聚焦 |
| `blur()`  | 失焦 |
