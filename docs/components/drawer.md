# Drawer 抽屉

从视口边缘滑出的面板，适合在不离开当前页面的情况下查看详情或编辑记录。属性和用法与 [对话框](./dialog) 基本一致。

除了位置与尺寸，抽屉的属性、事件与插槽和对话框一致。浮层的通用行为见 [浮层](../guide/overlays)。

<script setup>
import { ref } from 'vue'
const open = ref(false)
const placement = ref('right')
const show = (value) => {
  placement.value = value
  open.value = true
}
</script>

## 基础用法

<div class="demo">
  <DouButton v-for="value in ['right', 'left', 'top', 'bottom']" :key="value" variant="outline" @click="show(value)">{{ value }}</DouButton>
  <DouDrawer v-model:open="open" :placement="placement" title="部署详情">
    <DouSpace direction="vertical" block>
      <DouText variant="secondary">main · 39dc86b，3 分钟前由 daidr 触发。</DouText>
      <DouText variant="secondary">构建耗时 42 秒，产物 1.2 MB，已分发到 18 个节点。</DouText>
    </DouSpace>
    <template #footer="{ close }">
      <DouButton variant="outline" @click="close">关闭</DouButton>
      <DouButton @click="close">访问</DouButton>
    </template>
  </DouDrawer>
</div>

```vue
<DouDrawer v-model:open="open" placement="right" title="部署详情">
  <DouText variant="secondary">main · 39dc86b，3 分钟前由 daidr 触发。</DouText>
  <template #footer="{ close }">
    <DouButton variant="outline" @click="close">关闭</DouButton>
    <DouButton @click="close">访问</DouButton>
  </template>
</DouDrawer>
```

## 尺寸

`size` 是左右抽屉的宽度、上下抽屉的高度；数字为 px。默认左右 400px、上下 320px，并且不会超出视口。

```vue
<DouDrawer v-model:open="open" :size="560" title="编辑" />
<DouDrawer v-model:open="open" placement="bottom" size="50vh" title="日志" />
```

内容超出时，只有中间的内容区滚动，标题与底部操作保持可见。

## 键盘与读屏

与对话框相同：`role="dialog"`、`aria-modal="true"`，打开时焦点移入，`Tab` 在面板内循环，`Esc` 关闭后焦点回到打开前的元素。

## API

### Props

| 名称             | 说明                                | 类型                                                | 默认值    |
| ---------------- | ----------------------------------- | --------------------------------------------------- | --------- |
| `open`           | 是否打开，配合 `v-model:open`       | `boolean`                                           | `false`   |
| `title`          | 标题，同时为抽屉命名                | `string`                                            | —         |
| `placement`      | 从哪一边滑出                        | `'right' \| 'left' \| 'top' \| 'bottom'`            | `'right'` |
| `size`           | 左右为宽度、上下为高度；数字为 px   | `string \| number`                                  | —         |
| `closable`       | 显示右上角的关闭按钮                | `boolean`                                           | `true`    |
| `closeOnMask`    | 点击遮罩关闭                        | `boolean`                                           | `true`    |
| `closeOnEscape`  | 按 `Esc` 关闭                       | `boolean`                                           | `true`    |
| `lockScroll`     | 打开期间锁定页面滚动                | `boolean`                                           | `true`    |
| `destroyOnClose` | 关闭后卸载内容                      | `boolean`                                           | `false`   |
| `beforeClose`    | 关闭前调用，返回 `false` 则保持打开 | `() => boolean \| void \| Promise<boolean \| void>` | —         |
| `teleport`       | 渲染到哪里；`false` 为原地渲染      | `string \| HTMLElement \| false`                    | `'body'`  |

### Events

`update:open`、`open`、`opened`、`close`、`closed`，含义同 [对话框](./dialog#events)。

### Slots

| 名称      | 说明                       |
| --------- | -------------------------- |
| `default` | 内容，超出时滚动           |
| `title`   | 标题，替代 `title`         |
| `footer`  | 底部操作；参数 `{ close }` |

### CSS 变量

| 变量                   | 说明       |
| ---------------------- | ---------- |
| `--dou-drawer-size`    | 宽度或高度 |
| `--dou-drawer-mask`    | 遮罩颜色   |
| `--dou-drawer-bg`      | 面板底色   |
| `--dou-drawer-padding` | 内边距     |
