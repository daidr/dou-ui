# Listbox 列表选择

直接展示在页面中的选项列表，适合选项不多、希望一次看到全部选项的场景，例如设置页、侧栏筛选。

<script setup>
import { CloudIcon, DatabaseIcon, GlobeIcon, ServerIcon } from '@dou-ui/icons'
import { ref } from 'vue'
const region = ref('sh')
const regions = [
  { value: 'sh', label: '上海', description: '华东 2 · 延迟最低' },
  { value: 'bj', label: '北京', description: '华北 2' },
  { value: 'sg', label: '新加坡', description: '亚太东南 1' },
  { value: 'fra', label: '法兰克福', description: '欧洲中部 1', disabled: true },
]
const services = ref(['compute', 'storage'])
const serviceOptions = [
  { value: 'compute', label: '云服务器', icon: ServerIcon },
  { value: 'storage', label: '对象存储', icon: CloudIcon },
  { value: 'database', label: '数据库', icon: DatabaseIcon },
  { value: 'cdn', label: '内容分发', icon: GlobeIcon },
]
const city = ref(null)
const cities = [
  { label: '华东', options: ['上海', '杭州', '南京', '苏州', '合肥'] },
  { label: '华北', options: ['北京', '天津', '石家庄', '太原'] },
  { label: '华南', options: ['广州', '深圳', '厦门', '南宁'] },
]
</script>

## 基础用法

选项与 Select 的写法相同：字符串、数字，或带 `value`、`label` 的对象。对象还可以带 `description` 显示第二行。

<div class="demo">
  <DouListbox v-model="region" :options="regions" aria-label="区域" style="width: 280px" />
</div>

```vue
<DouListbox v-model="region" :options="regions" aria-label="区域" />
```

## 多选与图标

`multiple` 时点一下切换一项，`v-model` 是数组。选项的 `icon` 放在文字前面。

<div class="demo">
  <DouListbox v-model="services" :options="serviceOptions" multiple aria-label="服务" style="width: 240px" />
  <DouText variant="secondary">已选：{{ services.join('、') || '无' }}</DouText>
</div>

```vue
<DouListbox v-model="services" :options="serviceOptions" multiple aria-label="服务" />
```

## 分组、搜索与限高

分组的写法也与 Select 相同。`filterable` 在列表上方放一个搜索框，同时匹配标签与说明；`max-height` 限制列表高度，超出后列表内部滚动。

<div class="demo">
  <DouListbox v-model="city" :options="cities" filterable :max-height="240" aria-label="城市" style="width: 240px" />
</div>

```vue
<DouListbox v-model="city" :options="cities" filterable :max-height="240" aria-label="城市" />
```

## API

### Props

| 名称                    | 说明                                       | 类型                                                          | 默认值  |
| ----------------------- | ------------------------------------------ | ------------------------------------------------------------- | ------- |
| `modelValue`（v-model） | 选中的值，多选时为数组                     | `ListboxValue \| ListboxValue[] \| null`                      | —       |
| `options`               | 选项，字符串与数字同时作值与标签；可以分组 | `(ListboxOption \| ListboxOptionGroup \| string \| number)[]` | —       |
| `multiple`              | 多选，点一下切换一项                       | `boolean`                                                     | `false` |
| `filterable`            | 列表上方显示搜索框                         | `boolean`                                                     | `false` |
| `size`                  | 尺寸                                       | `'sm' \| 'md' \| 'lg'`                                        | `'md'`  |
| `disabled`              | 禁用                                       | `boolean`                                                     | `false` |
| `maxHeight`             | 列表最大高度，超出后滚动；数字为 px        | `number \| string`                                            | —       |
| `ariaLabel`             | 没有可见标签时给读屏的名字                 | `string`                                                      | —       |

`ListboxOption` 为 `{ value, label?, description?, icon?, disabled? }`，`ListboxOptionGroup` 为 `{ label, options, disabled? }`。

### Events

| 名称                | 说明               | 参数                                              |
| ------------------- | ------------------ | ------------------------------------------------- |
| `update:modelValue` | 值变化             | `(value: ListboxValue \| ListboxValue[] \| null)` |
| `change`            | 用户选中或取消选项 | 同上                                              |

### Slots

| 名称     | 说明                                        |
| -------- | ------------------------------------------- |
| `option` | 每个选项的内容，参数 `{ option, selected }` |
| `empty`  | 没有选项或搜索无结果时显示                  |

### Methods

| 名称    | 说明                         |
| ------- | ---------------------------- |
| `focus` | 聚焦列表；可搜索时聚焦搜索框 |

### 键盘与读屏

- 列表是 `role="listbox"`，多选时带 `aria-multiselectable`；选项是 `role="option"`，以 `aria-selected` 标明是否选中，当前项用 `aria-activedescendant` 指出。
- `↑` `↓` 移动并跳过禁用项，`Home` `End` 到首尾，`Enter` 或 `Space` 选中（多选时切换）。
- 列表聚焦时直接输入字母会跳到以它开头的选项，重复按同一个字母依次经过。
- 可搜索时焦点留在搜索框里，方向键照样移动列表中的当前项，`Enter` 选中。
- 在 [FormItem](./form) 里由表单项的标签命名。
