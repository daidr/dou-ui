# Autocomplete 自动补全

一个普通的输入框，边输入边给出建议。它和 Select 的区别在于：值就是输入框里的文字，建议只是帮忙填写，不选也可以提交任意内容。

<script setup>
import { ref } from 'vue'
const framework = ref('')
const frameworks = ['Vue', 'Vite', 'VitePress', 'Vitest', 'Nuxt', 'Pinia', 'Bun', 'oxlint']
const email = ref('')
const domains = ['qq.com', '163.com', 'gmail.com', 'outlook.com']
const emailSuggest = (query) => {
  if (!query || query.includes('@') && query.split('@')[1].length > 0 && domains.some((d) => d === query.split('@')[1])) return []
  const [name, host = ''] = query.split('@')
  return domains.filter((d) => d.startsWith(host)).map((d) => `${name}@${d}`)
}
const city = ref('')
const cities = ['北京', '上海', '广州', '深圳', '杭州', '成都', '南京', '武汉', '西安', '苏州']
const search = (query) =>
  new Promise((resolve) => setTimeout(() => resolve(cities.filter((c) => c.includes(query)).map((c) => ({ value: c, description: '城市' }))), 400))
</script>

## 基础用法

<div class="demo">
  <DouAutocomplete v-model="framework" :options="frameworks" placeholder="喜欢的工具" style="width: 240px" />
</div>

```vue
<DouAutocomplete v-model="value" :options="['Vue', 'Vite', 'VitePress']" />
```

建议按输入的文字过滤（不区分大小写），命中的部分加粗标出。选项可以是字符串，也可以是 `{ value, label, description, disabled }`。`filter` 传函数自定义匹配，传 `false` 则总是显示全部建议。

## 由输入生成建议

`fetch` 根据当前文字返回建议，可以是普通函数，也可以返回 Promise。下面的例子在 `@` 后面补全邮箱域名：

<div class="demo">
  <DouAutocomplete v-model="email" :fetch="emailSuggest" :debounce="0" :min-length="1" :highlight="false" placeholder="邮箱" style="width: 240px" />
</div>

```vue
<DouAutocomplete v-model="email" :fetch="suggest" :debounce="0" :min-length="1" />
```

## 异步建议

请求在停止输入 `debounce` 毫秒后发出（默认 200）；先发出的请求如果晚回来，结果会被丢弃，列表不会闪回旧内容。等待时列表里显示"加载中…"。

<div class="demo">
  <DouAutocomplete v-model="city" :fetch="search" :min-length="1" placeholder="城市" clearable style="width: 240px" />
</div>

```vue
<DouAutocomplete v-model="city" :fetch="(query) => api.searchCities(query)" :min-length="1" />
```

## 插槽

`prefix` 放在文字前面，`option` 自定义每一条建议（参数 `{ option, query }`），`empty` 在没有建议时显示；不提供 `empty` 时，没有建议就直接收起列表。

## 键盘与读屏

输入框本身是 `role="combobox"`，`aria-autocomplete="list"`，高亮的建议通过 `aria-activedescendant` 告诉读屏，焦点始终留在输入框里。

| 按键    | 行为                                       |
| ------- | ------------------------------------------ |
| `↓` `↑` | 打开列表 / 在建议间移动                    |
| `Enter` | 选中高亮的建议；没有高亮时交给表单（提交） |
| `Esc`   | 收起列表                                   |

## API

### Autocomplete Props

| 名称          | 说明                             | 类型                                           | 默认值           |
| ------------- | -------------------------------- | ---------------------------------------------- | ---------------- |
| `modelValue`  | 文字，配合 `v-model`             | `string`                                       | —                |
| `options`     | 按文字过滤的建议                 | `(AutocompleteOption \| string)[]`             | `[]`             |
| `fetch`       | 根据文字取建议                   | `(query: string) => Source \| Promise<Source>` | —                |
| `filter`      | `options` 的匹配方式             | `boolean \| (option, query) => boolean`        | `true`           |
| `debounce`    | `fetch` 前等待的毫秒数           | `number`                                       | `200`            |
| `minLength`   | 至少输入几个字才给建议           | `number`                                       | `0`              |
| `highlight`   | 标出命中的部分                   | `boolean`                                      | `true`           |
| `placeholder` | 占位文字                         | `string`                                       | —                |
| `clearable`   | 显示清空按钮                     | `boolean`                                      | `false`          |
| `size`        | 尺寸，默认取表单或全局配置       | `'sm' \| 'md' \| 'lg'`                         | `'md'`           |
| `disabled`    | 禁用                             | `boolean`                                      | `false`          |
| `invalid`     | 标记为无效                       | `boolean`                                      | `false`          |
| `placement`   | 列表弹出的位置                   | `Placement`                                    | `'bottom-start'` |
| `teleport`    | 列表渲染到哪里，`false` 留在原处 | `string \| HTMLElement \| false`               | `'body'`         |

其余属性（如 `name`、`maxlength`）传给原生输入框。

### Autocomplete Events

| 名称                | 说明         | 参数                           |
| ------------------- | ------------ | ------------------------------ |
| `update:modelValue` | 文字变化     | `(value: string)`              |
| `select`            | 选中一条建议 | `(option: AutocompleteOption)` |

### Autocomplete Slots

| 名称     | 说明                                   |
| -------- | -------------------------------------- |
| `prefix` | 文字前面的内容                         |
| `option` | 每一条建议，参数为 `{ option, query }` |
| `empty`  | 没有建议时显示                         |
