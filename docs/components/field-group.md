# FieldGroup 组合

将多个按钮或输入控件组合为一个整体，相邻的边框会合并，连接处的圆角变为直角。

<script setup>
import { CopyIcon, MinusIcon, PlusIcon, SearchIcon } from '@dou-ui/icons'
import { ref } from 'vue'
const view = ref('list')
const site = ref('ui.daidr.me')
const scope = ref('all')
const scopes = [
  { value: 'all', label: '全部' },
  { value: 'docs', label: '文档' },
  { value: 'issues', label: '议题' },
]
const keyword = ref('')
const amount = ref('128')
</script>

## 按钮组

<div class="demo">
  <DouFieldGroup>
    <DouButton variant="outline">日</DouButton>
    <DouButton variant="outline">周</DouButton>
    <DouButton variant="outline">月</DouButton>
  </DouFieldGroup>
  <DouFieldGroup>
    <DouButton variant="outline">
      <template #leading><MinusIcon /></template>
    </DouButton>
    <DouButton variant="outline">
      <template #leading><PlusIcon /></template>
    </DouButton>
  </DouFieldGroup>
  <DouFieldGroup>
    <DouButton tone="primary">发布</DouButton>
    <DouButton tone="primary">存为草稿</DouButton>
  </DouFieldGroup>
</div>

```vue
<DouFieldGroup>
  <DouButton variant="outline">日</DouButton>
  <DouButton variant="outline">周</DouButton>
  <DouButton variant="outline">月</DouButton>
</DouFieldGroup>
```

只是在几个选项里选一个时，用 [SegmentedControl](./segmented-control) 更合适；按钮组适合几个并列的动作。

## 输入组合

输入框、选择器旁边接按钮、下拉或一段固定文字。`DouFieldGroupText` 放不可编辑的文字或图标，比如协议前缀、单位。`block` 让组合占满一整行，输入类控件会分到剩下的宽度。

<div class="demo demo--column">
  <DouFieldGroup block>
    <DouFieldGroupText>https://</DouFieldGroupText>
    <DouInput v-model="site" />
    <DouButton variant="outline">
      <template #leading><CopyIcon /></template>
      复制
    </DouButton>
  </DouFieldGroup>
  <DouFieldGroup block>
    <DouSelect v-model="scope" :options="scopes" style="flex: 0 0 96px" />
    <DouInput v-model="keyword" placeholder="搜索">
      <template #prefix><SearchIcon /></template>
    </DouInput>
    <DouButton tone="primary">搜索</DouButton>
  </DouFieldGroup>
  <DouFieldGroup block>
    <DouInput v-model="amount" />
    <DouFieldGroupText>元 / 月</DouFieldGroupText>
  </DouFieldGroup>
</div>

```vue
<DouFieldGroup block>
  <DouFieldGroupText>https://</DouFieldGroupText>
  <DouInput v-model="site" />
  <DouButton variant="outline">复制</DouButton>
</DouFieldGroup>

<DouFieldGroup block>
  <DouSelect v-model="scope" :options="scopes" style="flex: 0 0 96px" />
  <DouInput v-model="keyword" placeholder="搜索" />
  <DouButton tone="primary">搜索</DouButton>
</DouFieldGroup>
```

按钮与文字保持自身宽度，其余控件平分剩下的空间。要让某个控件固定宽度，给它 `style="flex: 0 0 96px"`。

## 尺寸

`size` 会传给里面没有自己设置尺寸的控件，包括 `DouFieldGroupText`，一整组一起变。

<div class="demo demo--column">
  <DouFieldGroup v-for="size in ['sm', 'md', 'lg']" :key="size" :size="size">
    <DouFieldGroupText>{{ size }}</DouFieldGroupText>
    <DouInput placeholder="输入框" />
    <DouButton variant="outline">按钮</DouButton>
  </DouFieldGroup>
</div>

## 纵向

`orientation="vertical"` 让控件上下排列，边框在上下方向合并。

<div class="demo">
  <DouFieldGroup orientation="vertical">
    <DouButton variant="outline">上移</DouButton>
    <DouButton variant="outline">下移</DouButton>
    <DouButton variant="outline">删除</DouButton>
  </DouFieldGroup>
</div>

## API

### FieldGroup Props

| 名称          | 说明                                   | 类型                         | 默认值         |
| ------------- | -------------------------------------- | ---------------------------- | -------------- |
| `orientation` | 横向或纵向排列                         | `'horizontal' \| 'vertical'` | `'horizontal'` |
| `size`        | 里面没有自己设置尺寸的控件都用这个尺寸 | `'sm' \| 'md' \| 'lg'`       | —              |
| `block`       | 占满容器宽度                           | `boolean`                    | `false`        |

### Slots

| 名称      | 说明                                                 |
| --------- | ---------------------------------------------------- |
| `default` | 按钮、输入框、选择器等控件，以及 `DouFieldGroupText` |

`DouFieldGroupText` 没有属性，默认插槽放文字或图标。

### 键盘与读屏

- 组合渲染为 `role="group"`，纵向时带 `aria-orientation="vertical"`；需要名字时给它 `aria-label`。
- 里面每个控件保持自己的键盘行为，Tab 依次经过。
