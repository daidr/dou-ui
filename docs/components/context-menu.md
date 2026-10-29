# ContextMenu 右键菜单

在一块区域上点右键，在指针处弹出一列操作，代替浏览器自带的菜单。菜单项就是 [Dropdown](./dropdown) 的 `DouDropdownItem`，两种菜单长得一样、键盘行为也一样。

<script setup>
import { CopyIcon, EditIcon, FolderOpenIcon, TrashIcon } from '@dou-ui/icons'
import { ref } from 'vue'
const last = ref('无')
const files = ['设计稿.fig', '路线图.md', '发布说明.md']
const target = ref('')
</script>

## 基础用法

默认插槽是触发区域（取第一个元素，不额外包一层），`menu` 插槽放菜单项。选中一项触发 `select`，参数是该项的 `value`。

<div class="demo demo--column">
  <DouContextMenu @select="(value) => (last = value)">
    <div style="display: grid; place-items: center; height: 160px; border: 1px dashed var(--dou-color-border-strong); border-radius: var(--dou-radius-container); color: var(--dou-color-text-tertiary)">
      在这里点右键
    </div>
    <template #menu>
      <DouDropdownItem value="打开">
        <template #prefix><DouIcon><FolderOpenIcon /></DouIcon></template>
        打开
      </DouDropdownItem>
      <DouDropdownItem value="重命名">
        <template #prefix><DouIcon><EditIcon /></DouIcon></template>
        重命名
        <template #suffix>F2</template>
      </DouDropdownItem>
      <DouDropdownItem value="复制">
        <template #prefix><DouIcon><CopyIcon /></DouIcon></template>
        复制
        <template #suffix>⌘C</template>
      </DouDropdownItem>
      <DouDropdownItem value="删除" tone="danger" divided>
        <template #prefix><DouIcon><TrashIcon /></DouIcon></template>
        删除
      </DouDropdownItem>
    </template>
  </DouContextMenu>
  <DouText variant="tertiary" size="sm">最近的操作：{{ last }}</DouText>
</div>

```vue
<DouContextMenu @select="onSelect">
  <div class="area">在这里点右键</div>
  <template #menu>
    <DouDropdownItem value="open">打开</DouDropdownItem>
    <DouDropdownItem value="rename">重命名</DouDropdownItem>
    <DouDropdownItem value="delete" tone="danger" divided>删除</DouDropdownItem>
  </template>
</DouContextMenu>
```

菜单在指针右下方打开，下方或右侧放不下时翻到另一边。按 <DouKbd>Esc</DouKbd>、点击别处、滚动页面或切走窗口都会关闭。

## 针对某一项

一个菜单可以服务整个列表：在列表项的 `contextmenu` 事件里记下是哪一项，再在 `select` 里处理。

<div class="demo demo--column">
  <DouContextMenu @select="(value) => (last = `${value}「${target}」`)">
    <ul style="margin: 0; padding: 4px; list-style: none; border: 1px solid var(--dou-color-border-subtle); border-radius: var(--dou-radius-container)">
      <li v-for="file in files" :key="file" tabindex="0" style="padding: 8px 12px; border-radius: var(--dou-radius-control); cursor: default" @contextmenu="target = file">{{ file }}</li>
    </ul>
    <template #menu>
      <DouDropdownItem value="打开">打开</DouDropdownItem>
      <DouDropdownItem value="删除" tone="danger">删除</DouDropdownItem>
    </template>
  </DouContextMenu>
  <DouText variant="tertiary" size="sm">最近的操作：{{ last }}</DouText>
</div>

```vue
<DouContextMenu @select="(action) => run(action, target)">
  <ul>
    <li v-for="file in files" :key="file" tabindex="0" @contextmenu="target = file">
      {{ file }}
    </li>
  </ul>
  <template #menu>…</template>
</DouContextMenu>
```

## 从脚本打开

通过 ref 调用 `open(x, y)` 在视口中的某一点打开，例如长按时；`close()` 关闭。`v-model:open` 可以读写打开状态，`disabled` 时保留浏览器自带的菜单。

## API

### ContextMenu Props

| 名称              | 说明                         | 类型                             | 默认值   |
| ----------------- | ---------------------------- | -------------------------------- | -------- |
| `open`（v-model） | 是否打开                     | `boolean`                        | `false`  |
| `disabled`        | 保留浏览器自带的菜单         | `boolean`                        | `false`  |
| `hideOnSelect`    | 选中后关闭                   | `boolean`                        | `true`   |
| `teleport`        | 渲染到哪里，`false` 原地渲染 | `string \| HTMLElement \| false` | `'body'` |

### ContextMenu Events

| 名称     | 说明     | 参数                                     |
| -------- | -------- | ---------------------------------------- |
| `select` | 选中一项 | `(value: string \| number \| undefined)` |

### ContextMenu Slots

| 名称      | 说明                             |
| --------- | -------------------------------- |
| `default` | 触发区域，第一个元素接收右键事件 |
| `menu`    | 菜单项，`DouDropdownItem`        |

### ContextMenu Exposes

| 名称    | 说明           | 类型                             |
| ------- | -------------- | -------------------------------- |
| `open`  | 在视口某点打开 | `(x: number, y: number) => void` |
| `close` | 关闭           | `() => void`                     |

### 键盘与读屏

- 菜单是 `role="menu"`，打开后焦点进入菜单：<DouKbd>↑</DouKbd> <DouKbd>↓</DouKbd> 在项之间移动，<DouKbd>Home</DouKbd> / <DouKbd>End</DouKbd> 到首尾，<DouKbd>Enter</DouKbd> 或 <DouKbd>Space</DouKbd> 选中，输入首字母跳到对应项。
- 聚焦的元素上按菜单键或 <DouKbd>Shift</DouKbd> + <DouKbd>F10</DouKbd> 也会打开，菜单出现在该元素左下角。
- <DouKbd>Esc</DouKbd> 或 <DouKbd>Tab</DouKbd> 关闭菜单，焦点回到打开前的位置。
