# Splitter 分割面板

将一块区域分为两部分，拖动分隔线可以调整各部分的大小。

<script setup>
import { ref } from 'vue'
const size = ref(30)
const collapsed = ref(false)
</script>

## 基础用法

<div class="demo" style="padding: 0; height: 240px; overflow: hidden">
  <DouSplitter v-model="size" :min="15" :max="70" collapsible v-model:collapsed="collapsed">
    <template #start><div class="split-pane">文件列表 · {{ size }}%</div></template>
    <template #end>
      <DouSplitter direction="vertical" :model-value="65">
        <template #start><div class="split-pane">编辑器</div></template>
        <template #end><div class="split-pane">终端</div></template>
      </DouSplitter>
    </template>
  </DouSplitter>
</div>

```vue
<DouSplitter v-model="size" :min="15" :max="70" collapsible>
  <template #start>文件列表</template>
  <template #end>
    <DouSplitter direction="vertical" :model-value="65">
      <template #start>编辑器</template>
      <template #end>终端</template>
    </DouSplitter>
  </template>
</DouSplitter>
```

`v-model` 是第一个面板占的百分比。需要三栏或更多时，像上面这样嵌套。Splitter 会撑满父元素，记得给父元素一个高度。

## 尺寸限制

`min` 和 `max` 限制第一个面板：数字是百分比，`'240px'` 这样的字符串是像素。第二个面板的最小尺寸由 `max` 间接决定。

```vue
<DouSplitter v-model="size" min="200px" :max="70">…</DouSplitter>
```

## 折叠

`collapsible` 允许把第一个面板收起：在分隔线上双击，或聚焦后按 `Enter`。`v-model:collapsed` 可以从外部控制，收起时 `v-model` 的值保持不变，展开后回到原来的大小。

## 键盘与读屏

分隔线是 `role="separator"`，可以聚焦，`aria-valuenow` 是第一个面板的百分比，并通过 `aria-controls` 指向它。

| 按键                      | 行为                        |
| ------------------------- | --------------------------- |
| `←` `→`（垂直时 `↑` `↓`） | 移动 `step`（默认 1%）      |
| `Shift` + 方向键          | 移动十倍                    |
| `Home` `End`              | 移到最小 / 最大             |
| `Enter`                   | 折叠或展开（`collapsible`） |

## API

### Splitter Props

| 名称          | 说明                               | 类型                         | 默认值         |
| ------------- | ---------------------------------- | ---------------------------- | -------------- |
| `modelValue`  | 第一个面板的百分比，配合 `v-model` | `number`                     | `50`           |
| `direction`   | 左右排列还是上下排列               | `'horizontal' \| 'vertical'` | `'horizontal'` |
| `min`         | 第一个面板的最小尺寸               | `number \| '${number}px'`    | `0`            |
| `max`         | 第一个面板的最大尺寸               | `number \| '${number}px'`    | `100`          |
| `collapsible` | 可以折叠第一个面板                 | `boolean`                    | `false`        |
| `collapsed`   | 是否折叠，配合 `v-model:collapsed` | `boolean`                    | `false`        |
| `step`        | 方向键每次移动的百分比             | `number`                     | `1`            |
| `disabled`    | 禁止调整                           | `boolean`                    | `false`        |
| `ariaLabel`   | 分隔线的名称                       | `string`                     | 语言包         |

### Splitter Events

| 名称                | 说明                   | 参数               |
| ------------------- | ---------------------- | ------------------ |
| `update:modelValue` | 大小变化               | `(value: number)`  |
| `update:collapsed`  | 折叠或展开             | `(value: boolean)` |
| `change`            | 一次拖动或按键调整结束 | `(value: number)`  |

### Splitter Slots

| 名称    | 说明                     |
| ------- | ------------------------ |
| `start` | 第一个面板（左边或上边） |
| `end`   | 第二个面板（右边或下边） |

<style>
.split-pane {
  box-sizing: border-box;
  height: 100%;
  padding: 12px 16px;
  color: var(--dou-color-text-secondary);
  font-size: 13px;
}
</style>
