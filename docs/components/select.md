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

## API

### Props

| 名称          | 说明                                 | 类型                                   | 默认值           |
| ------------- | ------------------------------------ | -------------------------------------- | ---------------- |
| `modelValue`  | 选中值，多选时为数组，配合 `v-model` | `SelectValue \| SelectValue[] \| null` | —                |
| `options`     | 选项；字符串或数字同时作为值和标签   | `(SelectOption \| string \| number)[]` | —                |
| `multiple`    | 多选                                 | `boolean`                              | `false`          |
| `filterable`  | 输入文字筛选选项                     | `boolean`                              | `false`          |
| `placeholder` | 未选择时的提示                       | `string`                               | 语言包           |
| `size`        | 尺寸，默认取表单或全局配置           | `'sm' \| 'md' \| 'lg'`                 | `'md'`           |
| `disabled`    | 禁用                                 | `boolean`                              | `false`          |
| `invalid`     | 无效状态                             | `boolean`                              | `false`          |
| `clearable`   | 显示清空按钮                         | `boolean`                              | `false`          |
| `placement`   | 列表首选的位置                       | `Placement`                            | `'bottom-start'` |
| `teleport`    | 列表渲染到哪里；`false` 为原地渲染   | `string \| HTMLElement \| false`       | `'body'`         |
| `ariaLabel`   | 没有可见标签时的读屏名称             | `string`                               | —                |

`SelectValue` 为 `string | number | boolean`，`SelectOption` 为 `{ value: SelectValue; label?: string; disabled?: boolean }`。

### Events

| 名称                | 说明               | 参数                                            |
| ------------------- | ------------------ | ----------------------------------------------- |
| `update:modelValue` | 值变化             | `(value: SelectValue \| SelectValue[] \| null)` |
| `change`            | 用户选择或移除了项 | `(value: SelectValue \| SelectValue[] \| null)` |
| `clear`             | 按下清空按钮       | —                                               |

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
