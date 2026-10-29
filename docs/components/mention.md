# Mention 提及

在多行输入框里输入 `@`，就在光标处弹出一列可以提及的人；选中后把 `@名字` 连同一个空格插进文字里。列表和 [Autocomplete](./autocomplete) 是同一个菜单，键盘行为也一样。

<script setup>
import { ref } from 'vue'
const text = ref('')
const tagged = ref('')
const remote = ref('')
const loading = ref(false)
const found = ref([])
const members = [
  { value: 'daidr', label: 'Dairyn', description: '维护者' },
  { value: 'lin', label: '林一', description: '设计' },
  { value: 'zhou', label: '周舟', description: '前端' },
  { value: 'chen', label: '陈晨', description: '测试' },
  { value: 'bot', label: '部署机器人', description: '暂不可用', disabled: true },
]
const topics = [
  { value: '发版', label: '发版' },
  { value: '设计评审', label: '设计评审' },
  { value: '暗色主题', label: '暗色主题' },
]
const tagOptions = ref(members)
function onTagSearch(query, prefix) {
  tagOptions.value = prefix === '#' ? topics : members
}
let timer
function onRemoteSearch(query) {
  loading.value = true
  found.value = []
  clearTimeout(timer)
  timer = setTimeout(() => {
    found.value = members.filter((m) => !m.disabled && (m.label + m.value).toLowerCase().includes(query.toLowerCase()))
    loading.value = false
  }, 600)
}
</script>

## 基础用法

`options` 是可以提及的项：`value` 是插入的文字，`label` 是列表里显示的名字，`description` 是第二行的小字。输入时按 `value` 和 `label` 过滤。

<div class="demo demo--column" style="max-width: 480px">
  <DouMention v-model="text" :options="members" placeholder="输入 @ 提及成员" />
</div>

```vue
<DouMention v-model="text" :options="members" placeholder="输入 @ 提及成员" />
```

提及只在一个词的开头触发：邮箱里的 `@` 不会弹出列表；`@` 后面输入空格，提及就结束了。

## 多个前缀

`prefix` 可以是数组。`search` 事件带上当前的前缀，据此换一组选项，比如 `#` 用来提及话题。

<div class="demo demo--column" style="max-width: 480px">
  <DouMention v-model="tagged" :options="tagOptions" :prefix="['@', '#']" placeholder="@ 成员，# 话题" @search="onTagSearch" />
</div>

```vue
<DouMention
  v-model="text"
  :options="options"
  :prefix="['@', '#']"
  @search="(query, prefix) => (options = prefix === '#' ? topics : members)"
/>
```

## 远程搜索

设置 `:filter="false"` 关掉本地过滤，在 `search` 里请求接口，用 `loading` 显示加载态。

<div class="demo demo--column" style="max-width: 480px">
  <DouMention v-model="remote" :options="found" :filter="false" :loading="loading" placeholder="输入 @ 搜索" @search="onRemoteSearch" />
</div>

```vue
<DouMention v-model="text" :options="found" :filter="false" :loading="loading" @search="search" />
```

## API

### Mention Props

| 名称                    | 说明                                  | 类型                                                           | 默认值   |
| ----------------------- | ------------------------------------- | -------------------------------------------------------------- | -------- |
| `modelValue`（v-model） | 文字                                  | `string`                                                       | `''`     |
| `options`               | 可提及的项                            | `MentionOption[]`                                              | `[]`     |
| `prefix`                | 触发提及的字符                        | `string \| string[]`                                           | `'@'`    |
| `split`                 | 插入后跟随的字符                      | `string`                                                       | `' '`    |
| `filter`                | 本地过滤；`false` 交给 `search` 处理  | `boolean \| (query: string, option: MentionOption) => boolean` | `true`   |
| `loading`               | 列表显示加载中                        | `boolean`                                                      | `false`  |
| `rows`                  | 行数                                  | `number`                                                       | `3`      |
| `autosize`              | 随内容长高，见 [Textarea](./textarea) | `boolean \| { minRows?, maxRows? }`                            | `false`  |
| `size`                  | 尺寸                                  | `'sm' \| 'md' \| 'lg'`                                         | `'md'`   |
| `disabled`              | 禁用                                  | `boolean`                                                      | `false`  |
| `readonly`              | 只读                                  | `boolean`                                                      | `false`  |
| `invalid`               | 标记为无效                            | `boolean`                                                      | `false`  |
| `placeholder`           | 占位文字                              | `string`                                                       | —        |
| `teleport`              | 列表渲染到哪里                        | `string \| HTMLElement \| false`                               | `'body'` |

`MentionOption` 为 `{ value: string; label?: string; description?: string; disabled?: boolean }`。

### Mention Events

| 名称     | 说明                   | 参数                                      |
| -------- | ---------------------- | ----------------------------------------- |
| `search` | 正在输入的提及文字变化 | `(query: string, prefix: string)`         |
| `select` | 插入了一项             | `(option: MentionOption, prefix: string)` |

### Mention Slots

| 名称     | 说明                                       |
| -------- | ------------------------------------------ |
| `option` | 替换列表中的一项，参数 `{ option, query }` |
| `empty`  | 没有匹配项时显示                           |

### 键盘与读屏

- 列表打开时 <DouKbd>↑</DouKbd> <DouKbd>↓</DouKbd> 移动高亮，<DouKbd>Enter</DouKbd> 或 <DouKbd>Tab</DouKbd> 插入，<DouKbd>Esc</DouKbd> 关闭；输入法组字时按键不会被拦截。
- 焦点始终留在输入框里，高亮项通过 `aria-activedescendant` 告诉读屏。
