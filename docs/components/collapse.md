# Collapse 折叠面板

把一组内容收进可以展开的标题行。标题之间只有细线，标题前一个小箭头，展开时转四分之一圈，面板平滑展开到自然高度；内容与标题文字对齐，而不是与箭头对齐。

<script setup>
import { ref } from 'vue'
const open = ref(['build'])
const one = ref(['a'])
</script>

## 基础用法

<div class="demo demo--column">
  <DouCollapse v-model="open">
    <DouCollapseItem value="build" title="构建设置">构建命令 <code>bun run build</code>，输出目录 <code>dist</code>。</DouCollapseItem>
    <DouCollapseItem value="env" title="环境变量">共 4 个变量，其中 1 个仅在生产环境可见。</DouCollapseItem>
    <DouCollapseItem value="danger" title="删除项目" disabled>删除后无法恢复。</DouCollapseItem>
  </DouCollapse>
</div>

```vue
<DouCollapse v-model="open">
  <DouCollapseItem value="build" title="构建设置">…</DouCollapseItem>
  <DouCollapseItem value="env" title="环境变量">…</DouCollapseItem>
  <DouCollapseItem value="danger" title="删除项目" disabled>…</DouCollapseItem>
</DouCollapse>
```

`v-model` 绑定展开项的 `value` 数组。面板内容在第一次展开时才渲染，之后收起也会保留。

## 手风琴与边框

`accordion` 让同一时间最多展开一项；`bordered` 把各项放进一个带细描边的容器。`extra` 插槽放在标题行末尾，不属于展开按钮。

<div class="demo demo--column">
  <DouCollapse v-model="one" accordion bordered>
    <DouCollapseItem value="a" title="付款方式">
      默认使用尾号 4242 的信用卡。
      <template #extra>信用卡</template>
    </DouCollapseItem>
    <DouCollapseItem value="b" title="发票信息">发票抬头与税号。</DouCollapseItem>
    <DouCollapseItem value="c" title="用量提醒">超过额度 80% 时发送邮件。</DouCollapseItem>
  </DouCollapse>
</div>

```vue
<DouCollapse v-model="open" accordion bordered>
  <DouCollapseItem value="a" title="付款方式">
    …
    <template #extra>信用卡</template>
  </DouCollapseItem>
</DouCollapse>
```

## 键盘与读屏

每个标题是一个原生按钮，放在 `role="heading"` 里（层级由 `headingLevel` 决定，默认 3），带 `aria-expanded` 与 `aria-controls`。面板是 `role="region"`，通过 `aria-labelledby` 指回标题。`Tab` 在标题之间移动，`Enter` / `Space` 展开或收起。

## API

### Collapse Props

| 名称           | 说明                       | 类型                    | 默认值  |
| -------------- | -------------------------- | ----------------------- | ------- |
| `modelValue`   | 展开项的值，配合 `v-model` | `(string \| number)[]`  | `[]`    |
| `accordion`    | 同一时间最多展开一项       | `boolean`               | `false` |
| `bordered`     | 带描边的容器               | `boolean`               | `false` |
| `headingLevel` | 标题在页面大纲中的层级     | `2 \| 3 \| 4 \| 5 \| 6` | `3`     |

### Collapse Events

| 名称                | 说明                   | 参数                                       |
| ------------------- | ---------------------- | ------------------------------------------ |
| `update:modelValue` | 展开项变化             | `(value: (string \| number)[])`            |
| `change`            | 用户展开或收起了某一项 | `(value: string \| number, open: boolean)` |

### CollapseItem Props

| 名称       | 说明     | 类型               | 默认值  |
| ---------- | -------- | ------------------ | ------- |
| `value`    | 项的值   | `string \| number` | —       |
| `title`    | 标题文字 | `string`           | `value` |
| `disabled` | 禁用     | `boolean`          | `false` |

### CollapseItem Slots

| 名称      | 说明                            |
| --------- | ------------------------------- |
| `default` | 面板内容                        |
| `title`   | 替换标题文字，参数为 `{ open }` |
| `extra`   | 标题行末尾的内容                |

### CSS 变量

| 变量                              | 说明               |
| --------------------------------- | ------------------ |
| `--dou-collapse-padding-x`        | 水平内边距         |
| `--dou-collapse-header-padding-y` | 标题行的垂直内边距 |
| `--dou-collapse-border`           | 分隔线与边框颜色   |
