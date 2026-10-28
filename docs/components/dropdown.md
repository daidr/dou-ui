# Dropdown 下拉菜单

点击一个按钮，弹出一列操作。高亮的那一行是一层淡淡的底色，指针与键盘共用同一个高亮。菜单的圆角与行的圆角同心。

浮层的通用行为见 [浮层](../guide/overlays)。

<script setup>
import { ref } from 'vue'
const last = ref('无')
</script>

## 基础用法

默认插槽是触发元素，`menu` 插槽放 `DouDropdownItem`。选中一项时触发 `select`，参数是该项的 `value`。

<div class="demo">
  <DouDropdown @select="(value) => (last = value)">
    <DouButton variant="outline">更多操作</DouButton>
    <template #menu>
      <DouDropdownItem value="访问">访问</DouDropdownItem>
      <DouDropdownItem value="重新部署">重新部署</DouDropdownItem>
      <DouDropdownItem value="提升为生产环境" disabled>提升为生产环境</DouDropdownItem>
      <DouDropdownItem value="删除部署" tone="danger" divided>删除部署</DouDropdownItem>
    </template>
  </DouDropdown>
  <DouText variant="tertiary" size="sm">最近的操作：{{ last }}</DouText>
</div>

```vue
<DouDropdown @select="onSelect">
  <DouButton variant="outline">更多操作</DouButton>
  <template #menu>
    <DouDropdownItem value="visit">访问</DouDropdownItem>
    <DouDropdownItem value="redeploy">重新部署</DouDropdownItem>
    <DouDropdownItem value="promote" disabled>提升为生产环境</DouDropdownItem>
    <DouDropdownItem value="delete" tone="danger" divided>删除部署</DouDropdownItem>
  </template>
</DouDropdown>
```

- `disabled` 的项不可选，键盘导航会跳过它。
- `tone="danger"` 用于破坏性操作。
- `divided` 在该项上方画一条分隔线。

## 图标与快捷键

`prefix` 插槽放在文字前（通常是图标），`suffix` 放在行尾（例如快捷键）。

<div class="demo">
  <DouDropdown>
    <DouButton variant="outline">编辑</DouButton>
    <template #menu>
      <DouDropdownItem>
        <template #prefix><DouIcon><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="5" width="8" height="8" rx="1.5" /><path d="M3 10V4.5A1.5 1.5 0 0 1 4.5 3H10" stroke-linecap="round" /></svg></DouIcon></template>
        复制
        <template #suffix>⌘C</template>
      </DouDropdownItem>
      <DouDropdownItem>
        <template #prefix><DouIcon><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 13h10M5 10l6.5-6.5 1.5 1.5L6.5 11.5H5z" stroke-linejoin="round" /></svg></DouIcon></template>
        重命名
        <template #suffix>F2</template>
      </DouDropdownItem>
    </template>
  </DouDropdown>
</div>

```vue
<DouDropdownItem>
  <template #prefix><DouIcon>...</DouIcon></template>
  复制
  <template #suffix>⌘C</template>
</DouDropdownItem>
```

## 触发方式与宽度

`trigger="hover"` 指向即打开。`same-width` 让菜单至少与触发元素一样宽。选中后默认关闭，`:hide-on-select="false"` 可以保持打开。

<div class="demo">
  <DouDropdown trigger="hover" same-width>
    <DouButton variant="outline" style="width: 180px">指向打开</DouButton>
    <template #menu>
      <DouDropdownItem>个人资料</DouDropdownItem>
      <DouDropdownItem>团队设置</DouDropdownItem>
      <DouDropdownItem divided>退出登录</DouDropdownItem>
    </template>
  </DouDropdown>
</div>

## 键盘与读屏

菜单带有 `role="menu"`，每一项是 `role="menuitem"`。触发元素带 `aria-haspopup="menu"`、`aria-expanded` 与 `aria-controls`。

| 按键              | 作用                                                                |
| ----------------- | ------------------------------------------------------------------- |
| `Enter` / `Space` | 在触发元素上：打开并聚焦第一项；在项上：选中                        |
| `↓` / `↑`         | 在触发元素上：打开并聚焦第一项 / 最后一项；在菜单里：移动，首尾循环 |
| `Home` / `End`    | 第一项 / 最后一项                                                   |
| 字母              | 跳到下一个以它开头的项                                              |
| `Esc`             | 关闭，焦点回到触发元素                                              |
| `Tab`             | 关闭，焦点从触发元素继续向后                                        |

## API

### Dropdown Props

| 名称           | 说明                           | 类型                             | 默认值           |
| -------------- | ------------------------------ | -------------------------------- | ---------------- |
| `open`         | 是否打开，配合 `v-model:open`  | `boolean`                        | `false`          |
| `placement`    | 首选的一侧                     | `Placement`                      | `'bottom-start'` |
| `trigger`      | 打开方式                       | `'click' \| 'hover' \| 'manual'` | `'click'`        |
| `disabled`     | 不再打开                       | `boolean`                        | `false`          |
| `hideOnSelect` | 选中后关闭                     | `boolean`                        | `true`           |
| `sameWidth`    | 至少与触发元素一样宽           | `boolean`                        | `false`          |
| `showDelay`    | `hover` 时多久打开，毫秒       | `number`                         | `100`            |
| `hideDelay`    | `hover` 时离开后多久关闭，毫秒 | `number`                         | `150`            |
| `offset`       | 与触发元素的间距，px           | `number`                         | `6`              |
| `teleport`     | 渲染到哪里；`false` 为原地渲染 | `string \| HTMLElement \| false` | `'body'`         |

### Dropdown Events

| 名称          | 说明     | 参数                                     |
| ------------- | -------- | ---------------------------------------- |
| `update:open` | 打开状态 | `(open: boolean)`                        |
| `select`      | 选中一项 | `(value: string \| number \| undefined)` |

### Dropdown Slots

| 名称      | 说明                      |
| --------- | ------------------------- |
| `default` | 触发元素                  |
| `menu`    | 菜单项，`DouDropdownItem` |

### DropdownItem Props

| 名称       | 说明                    | 类型                    | 默认值      |
| ---------- | ----------------------- | ----------------------- | ----------- |
| `value`    | 传给 `select` 的值      | `string \| number`      | —           |
| `disabled` | 禁用                    | `boolean`               | `false`     |
| `tone`     | `danger` 用于破坏性操作 | `'neutral' \| 'danger'` | `'neutral'` |
| `divided`  | 上方画一条分隔线        | `boolean`               | `false`     |

### DropdownItem Slots

| 名称      | 说明           |
| --------- | -------------- |
| `default` | 文字           |
| `prefix`  | 文字前，如图标 |
| `suffix`  | 行尾，如快捷键 |

### CSS 变量

| 变量                            | 说明       |
| ------------------------------- | ---------- |
| `--dou-dropdown-bg`             | 菜单底色   |
| `--dou-dropdown-inset`          | 菜单内边距 |
| `--dou-dropdown-item-height`    | 行高       |
| `--dou-dropdown-item-radius`    | 行圆角     |
| `--dou-dropdown-item-active-bg` | 高亮行底色 |
