# Scrollbar 滚动条

细细的滚动条画在内容上方，替代系统滚动条：面板宽度不会被滚动条挤掉，暗色主题下也不会出现一根突兀的浅色条。平时它是安静的，指针移入或正在滚动时才出现，指针放到上面会变粗一点，方便抓取。

<script setup>
const rows = Array.from({ length: 30 }, (_, i) => `第 ${i + 1} 条通知 · 部署 #${1024 + i} 已完成`)
const wide = Array.from({ length: 12 }, (_, i) => `列 ${i + 1}`)
</script>

## 基础用法

用 `height` 固定高度，内容超出时滚动。滚动区域可以用 <DouKbd>Tab</DouKbd> 聚焦，再用方向键滚动。

<div class="demo">
  <DouScrollbar :height="200" style="width: 320px; border: 1px solid var(--dou-color-border-subtle); border-radius: var(--dou-radius-control)">
    <div style="padding: 8px 12px">
      <DouText v-for="row in rows" :key="row" as="p" size="sm" variant="secondary" style="margin: 6px 0">{{ row }}</DouText>
    </div>
  </DouScrollbar>
</div>

```vue
<DouScrollbar :height="200">
  <p v-for="row in rows" :key="row">{{ row }}</p>
</DouScrollbar>
```

## 最大高度

`max-height` 让区域随内容长高，到上限后开始滚动，适合下拉面板和侧栏。

```vue
<DouScrollbar max-height="50vh">…</DouScrollbar>
```

## 横向滚动

不能换行的内容会把区域撑宽，横向滚动条随之出现；两个方向都能滚动时，两根滚动条互不重叠。`always` 让滚动条一直显示。

<div class="demo">
  <DouScrollbar always style="width: 360px; border: 1px solid var(--dou-color-border-subtle); border-radius: var(--dou-radius-control)">
    <div style="display: flex; gap: 8px; padding: 12px 12px 18px">
      <DouTag v-for="item in wide" :key="item" size="lg">{{ item }}</DouTag>
    </div>
  </DouScrollbar>
</div>

```vue
<DouScrollbar always>
  <div style="display: flex; gap: 8px">…</div>
</DouScrollbar>
```

## API

### Scrollbar Props

| 名称        | 说明                          | 类型               | 默认值  |
| ----------- | ----------------------------- | ------------------ | ------- |
| `height`    | 固定高度，数字为 px           | `number \| string` | —       |
| `maxHeight` | 随内容长高到此高度，数字为 px | `number \| string` | —       |
| `always`    | 一直显示滚动条                | `boolean`          | `false` |

### Scrollbar Events

| 名称     | 说明   | 参数                                        |
| -------- | ------ | ------------------------------------------- |
| `scroll` | 滚动时 | `{ scrollTop: number, scrollLeft: number }` |

### Scrollbar Exposes

| 名称       | 说明                                       | 类型                                 |
| ---------- | ------------------------------------------ | ------------------------------------ |
| `wrap`     | 真正滚动的元素                             | `HTMLElement \| null`                |
| `scrollTo` | 滚动到指定位置                             | `(options: ScrollToOptions) => void` |
| `update`   | 重新测量（内容尺寸以观察不到的方式变化时） | `() => void`                         |

### 键盘与读屏

- 滚动用的仍是原生滚动，滚轮、触控板、触屏与键盘都照常工作；画出来的滚动条带 `aria-hidden`。
- 可以滚动时，滚动区域可通过 <DouKbd>Tab</DouKbd> 聚焦，聚焦时显示焦点环。
