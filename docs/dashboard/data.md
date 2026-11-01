# 数据与筛选

格子通过数据源取数据。同一个数据源在同一组筛选下只请求一次，多个格子共用结果；筛选变化时取消旧请求，格子保留旧内容并显示加载状态，直到新数据回来。

<DocDemo src="dashboard/data" />

示例里两个指标格子共用 `summary` 数据源，一次筛选变化只发出 4 次请求。点“各地区”里的一行会按这个地区筛选其他格子，“各地区”自己仍然显示全部地区，标题栏显示“已按 华东 筛选”，点 × 取消。“城市前五”筛选的值是城市代码，显示的是城市名。

## 数据源

`sources` 按名字给出取数据的函数。函数收到当前生效的筛选 `filters` 和一个 `signal`，返回数据或 Promise：

```ts
import type { DashboardSources } from '@dou-ui/dashboard'

const sources: DashboardSources = {
  sales: ({ filters, signal }) =>
    fetch(`/api/sales?${new URLSearchParams(filters as Record<string, string>)}`, { signal }).then(
      (res) => res.json(),
    ),
}
```

格子在 `props.source` 里写数据源的名字。`filters` 里只有非空的值：`undefined`、`null`、`''` 和空数组都不算筛选。

请求不再需要时（筛选又变了，或者显示它的格子都被删掉了）`signal` 会被取消，把它传给 `fetch` 就能停止请求。

数据源也可以写成对象，加上两个选项：

```ts
const sources: DashboardSources = {
  // 只用到 date 一个筛选：别的筛选变化时不会重新请求
  calendar: { load: loadCalendar, filters: ['date'] },
  // 每 30 秒刷新一次，页面不可见时暂停，回到页面时补上
  live: { load: loadLive, interval: 30_000 },
}
```

取回的结果会保留一段时间，筛选改回之前的值时直接使用，不再请求。某个数据源换成了另一个函数（或者选项变了）时会重新请求，所以数据源要在组件外或 `setup` 里定义一次，不要写在模板里，否则每次重新渲染都会换成新函数。离视口较远的格子在滚动到附近之前不会请求数据。

## 在格子里读取数据

`useDashboardWidget()` 返回的 `data` 是数据源按当前筛选取回的结果。加载和出错由外框处理：加载时显示加载状态（120ms 之内完成不显示），出错时显示“加载失败”和“重试”按钮。

```vue
<script setup lang="ts">
import { useDashboardWidget } from '@dou-ui/dashboard'

const { data } = useDashboardWidget<{ source: string }, { amount: number }>()
</script>

<template>
  <DouStatistic :value="data?.amount ?? 0" />
</template>
```

`error` 是出错的原因，`refresh()` 重新请求这个格子的数据源。没有数据源的格子也可以自己用 `setStatus` 显示状态，见[加载、出错与空态](./dashboard#加载、出错与空态)。

## 筛选

筛选的值用 `v-model:filters` 绑定，是一个以筛选名为键的对象。应用可以直接修改它，也可以调用 `setFilter(key, value)` 和 `clearFilters()`：

```vue
<DouDashboard v-model="doc" v-model:filters="filters" :widgets="widgets" :sources="sources" />
```

格子里的 `filters` 是对这个格子生效的筛选。

## 格子之间联动

格子调用 `setFilter` 设置筛选，例如点了图表里的一根柱子。这个筛选作用于其他格子，设置它的格子自己不受影响，仍然显示全部数据，方便换一个值再点：

```ts
const { setFilter, ownFilters } = useDashboardWidget()

function pick(region: string) {
  // 再点一次同一个值时取消
  setFilter('region', ownFilters.value.region === region ? undefined : region)
}
```

设置筛选的格子标题栏会显示“已按 华东 筛选”，点 × 取消。值不适合直接显示时（例如 id），用 `label` 给出显示的文字：`setFilter('city', 310000, { label: '上海' })`。`ownFilters` 是这个格子设置的、仍然生效的筛选，可以用来标出选中的那一项。

同一个筛选被别处修改后（例如在筛选栏里换了值），就不再算作这个格子设置的；格子被删除时，它设置的筛选一起清除。

## 筛选栏

`DouDashboardFilterBar` 按 `fields` 列出筛选控件，通过 `for` 连接到仪表盘。格子设置的、`fields` 里没有的筛选也显示在筛选栏里，可以单独清除。

```vue
<DouDashboardFilterBar :for="dashboard" :fields="fields" />
<DouDashboard ref="dashboard" v-model:filters="filters" … />
```

```ts
const fields: DashboardFilterField[] = [
  { type: 'select', key: 'region', label: '地区', options: ['华东', '华北'] },
  { type: 'date-range', key: 'date', label: '日期' },
  { type: 'search', key: 'keyword', label: '城市' },
]
```

| 类型         | 值                                | 其他选项                             |
| ------------ | --------------------------------- | ------------------------------------ |
| `select`     | 选中的值；`multiple` 时是数组     | `options`、`multiple`、`placeholder` |
| `date-range` | `['YYYY-MM-DD', 'YYYY-MM-DD']`    | —                                    |
| `search`     | 输入的文字，停止输入 300ms 后生效 | `placeholder`                        |

默认插槽放在筛选栏最右边，可以加刷新按钮等。需要别的控件时，直接绑定 `filters` 里的值即可。

## API

### Dashboard Props

| 名称              | 说明                                                 | 类型               | 默认值 |
| ----------------- | ---------------------------------------------------- | ------------------ | ------ |
| `sources`         | 数据源，按名字给出；换成另一个函数的数据源会重新请求 | `DashboardSources` | —      |
| `v-model:filters` | 筛选的值                                             | `DashboardFilters` | `{}`   |

### Dashboard Exposes

| 名称                              | 说明                                             |
| --------------------------------- | ------------------------------------------------ |
| `setFilter(key, value, options?)` | 设置筛选，空值清除；`options.label` 是显示的文字 |
| `clearFilters()`                  | 清除全部筛选                                     |
| `refresh(source?)`                | 重新请求一个数据源，不传时全部重新请求           |
| `filters`                         | 当前筛选的值                                     |
| `linkedFilters`                   | 格子设置的筛选 `{ key, value, label, widget }`   |
| `document`                        | 当前文档                                         |

### DashboardSourceOptions

| 名称       | 说明                                     | 类型                                               |
| ---------- | ---------------------------------------- | -------------------------------------------------- |
| `load`     | 取数据                                   | `({ filters, signal, source }) => T \| Promise<T>` |
| `filters`  | 用到的筛选；其他筛选不传入，也不触发请求 | `string[]`                                         |
| `interval` | 显示时每隔多少毫秒刷新，页面不可见时暂停 | `number`                                           |

### useDashboardWidget

| 名称                              | 说明                                     |
| --------------------------------- | ---------------------------------------- |
| `data`                            | `props.source` 按当前筛选取回的结果      |
| `error`                           | 出错的原因                               |
| `filters`                         | 对这个格子生效的筛选（不含它自己设置的） |
| `setFilter(key, value, options?)` | 为其他格子设置筛选，空值清除             |
| `ownFilters`                      | 这个格子设置的、仍然生效的筛选           |
| `refresh()`                       | 重新请求这个格子的数据源                 |

### DashboardFilterBar Props

| 名称        | 说明                       | 类型                        | 默认值 |
| ----------- | -------------------------- | --------------------------- | ------ |
| `for`       | 要连接的仪表盘实例         | `DashboardExpose \| null`   | —      |
| `fields`    | 筛选控件                   | `DashboardFilterField[]`    | `[]`   |
| `clearable` | 有筛选时显示“清除筛选”按钮 | `boolean`                   | `true` |
| `messages`  | 替换语言包里的文字         | `DashboardMessagesOverride` | —      |

### DashboardFilterBar Slots

| 名称      | 说明         |
| --------- | ------------ |
| `default` | 放在控件后面 |
