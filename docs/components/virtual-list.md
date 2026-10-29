# VirtualList 虚拟列表

数据量很大时，只渲染可视区域附近的条目，滚动依然流畅。

列表本身不画任何外观：没有底色、描边和内边距，外观交给放在里面的内容或外面的容器。

<script setup>
import { ref } from 'vue'
const rows = Array.from({ length: 10000 }, (_, index) => ({
  id: index,
  name: `deploy-${String(index).padStart(5, '0')}`,
  region: ['上海', '新加坡', '东京', '法兰克福'][index % 4],
}))
const list = ref()
const target = ref(5000)
const feed = ref(Array.from({ length: 30 }, (_, index) => `第 ${index + 1} 条`))
const loading = ref(false)
function more() {
  if (loading.value || feed.value.length >= 120) return
  loading.value = true
  setTimeout(() => {
    const start = feed.value.length
    feed.value = [...feed.value, ...Array.from({ length: 30 }, (_, index) => `第 ${start + index + 1} 条`)]
    loading.value = false
  }, 600)
}
</script>

## 基础用法

`items` 是数据，`item-size` 是每一项的高度（px），`height` 是视口高度。默认插槽拿到 `{ item, index }`。

<div class="demo demo--column">
  <DouCard padding="none">
    <DouVirtualList :items="rows" :item-size="36" item-key="id" :height="288">
      <template #default="{ item, index }">
        <div class="vl-row">
          <DouText mono>{{ item.name }}</DouText>
          <DouText variant="tertiary" size="sm">{{ item.region }} · #{{ index }}</DouText>
        </div>
      </template>
    </DouVirtualList>
  </DouCard>
</div>

```vue
<DouVirtualList :items="rows" :item-size="36" item-key="id" :height="288">
  <template #default="{ item, index }">
    <div class="row">{{ item.name }}</div>
  </template>
</DouVirtualList>
```

高度需要事先知道，这样每一项的位置是算出来的，而不是滚到那里才量出来的，滚动条和跳转都是准的。高度不一的列表传一个函数：`:item-size="(item, index) => (item.group ? 28 : 36)"`。

不传 `height` 时列表撑满父元素，父元素需要有确定的高度。

## 跳转到某一项

`scrollToIndex(index, align)` 把某一项滚进视口。`align` 默认 `'nearest'`，已经可见时不动，否则只滚最少的距离；也可以是 `'start'`、`'center'`、`'end'`。

<div class="demo demo--column">
  <DouSpace>
    <DouInputNumber v-model="target" :min="0" :max="9999" size="sm" />
    <DouButton size="sm" variant="outline" @click="list.scrollToIndex(target, 'center')">跳转</DouButton>
  </DouSpace>
  <DouCard padding="none">
    <DouVirtualList ref="list" :items="rows" :item-size="36" item-key="id" :height="216">
      <template #default="{ item, index }">
        <div class="vl-row" :class="{ 'vl-row--target': index === target }">
          <DouText mono>{{ item.name }}</DouText>
          <DouText variant="tertiary" size="sm">#{{ index }}</DouText>
        </div>
      </template>
    </DouVirtualList>
  </DouCard>
</div>

## 滚动加载

滚到距底部 `end-threshold`（默认 40px）以内时触发 `end-reached`，追加数据后列表变长，下一次到底会再次触发。

<div class="demo demo--column">
  <DouCard padding="none">
    <DouVirtualList :items="feed" :item-size="36" :height="216" @end-reached="more">
      <template #default="{ item }">
        <div class="vl-row">{{ item }}</div>
      </template>
    </DouVirtualList>
  </DouCard>
  <DouText variant="tertiary" size="sm">已加载 {{ feed.length }} 条{{ loading ? '，加载中…' : '' }}</DouText>
</div>

## 键盘与读屏

列表只是滚动容器，语义由内容决定：做成列表时给容器 `role="list"`、条目 `role="listitem"`，并用 `aria-setsize` / `aria-posinset` 告诉读屏器总数和位置，因为页面里只有一部分条目。需要键盘逐项移动时，参考 [Tree](./tree) 的做法：焦点留在容器上，用 `aria-activedescendant` 指向当前项，移动前先 `scrollToIndex`。

## API

### Props

| 名称           | 说明                                     | 类型                                                     | 默认值     |
| -------------- | ---------------------------------------- | -------------------------------------------------------- | ---------- |
| `items`        | 数据                                     | `T[]`                                                    | —          |
| `itemSize`     | 每一项的高度（px），或按项返回高度的函数 | `number \| (item: T, index: number) => number`           | —          |
| `itemKey`      | 唯一键所在的属性，或返回唯一键的函数     | `string \| (item: T, index: number) => string \| number` | 下标       |
| `height`       | 视口高度，数字为 px                      | `number \| string`                                       | 撑满父元素 |
| `overscan`     | 视口上下多渲染的条数                     | `number`                                                 | `4`        |
| `endThreshold` | 距底部多少 px 算作到底                   | `number`                                                 | `40`       |

### Events

| 名称          | 说明         | 参数             |
| ------------- | ------------ | ---------------- |
| `scroll`      | 滚动         | `(event: Event)` |
| `end-reached` | 滚到接近底部 | —                |

### Slots

| 名称      | 说明                               |
| --------- | ---------------------------------- |
| `default` | 一项内容，参数为 `{ item, index }` |
| `empty`   | 没有数据时显示                     |

### Exposes

| 名称            | 说明               | 类型                                                                         |
| --------------- | ------------------ | ---------------------------------------------------------------------------- |
| `scrollToIndex` | 把某一项滚进视口   | `(index: number, align?: 'start' \| 'center' \| 'end' \| 'nearest') => void` |
| `scrollTo`      | 滚到某个偏移（px） | `(offset: number) => void`                                                   |
| `el`            | 滚动容器元素       | `() => HTMLElement \| null`                                                  |

<style>
.vl-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  padding: 0 16px;
  border-bottom: 1px solid var(--dou-color-border-subtle);
  box-sizing: border-box;
}
.vl-row--target {
  background: color-mix(in oklab, var(--dou-color-text) 6%, transparent);
}
</style>
