# Layout 布局

应用页面的骨架：顶栏、侧栏、主区与页脚。这几块本身不做装饰，用的就是页面底色，只靠一条细线和主区分开，让表面与阴影都留给内容。含有侧栏的 `DouLayout` 横向排列，其余纵向排列，所以嵌套一层就能组合出常见的后台结构。

<script setup>
import { DashboardIcon, FolderIcon, SettingsIcon, UsersIcon } from '@dou-ui/icons'
import { ref } from 'vue'
const collapsed = ref(false)
const current = ref('overview')
const items = [
  { key: 'overview', label: '概览', icon: DashboardIcon },
  { key: 'projects', label: '项目', icon: FolderIcon },
  { key: 'members', label: '成员', icon: UsersIcon },
  { key: 'settings', label: '设置', icon: SettingsIcon },
]
</script>

## 基础用法

`DouLayoutHeader`、`DouLayoutAside`、`DouLayoutMain`、`DouLayoutFooter` 分别渲染为 `<header>`、`<aside>`、`<main>` 与 `<footer>`，页面的地标随之而来。

<div class="demo demo--column" style="padding: 0; overflow: hidden">
  <DouLayout style="height: 360px">
    <DouLayoutHeader>
      <DouText weight="medium">DouUI 控制台</DouText>
    </DouLayoutHeader>
    <DouLayout>
      <DouLayoutAside :width="200">
        <DouMenu v-model="current" :items="items" />
      </DouLayoutAside>
      <DouLayoutMain>
        <DouCard title="概览">主区放页面内容。</DouCard>
      </DouLayoutMain>
    </DouLayout>
    <DouLayoutFooter>© 2026 DouUI</DouLayoutFooter>
  </DouLayout>
</div>

```vue
<DouLayout>
  <DouLayoutHeader>DouUI 控制台</DouLayoutHeader>
  <DouLayout>
    <DouLayoutAside :width="200">
      <DouMenu v-model="current" :items="items" />
    </DouLayoutAside>
    <DouLayoutMain>…</DouLayoutMain>
  </DouLayout>
  <DouLayoutFooter>© 2026 DouUI</DouLayoutFooter>
</DouLayout>
```

侧栏写在主区后面时就在右侧，分隔线自动换到朝向主区的那一边。

## 可收起的侧栏

`collapsible` 在侧栏底部放一个收起 / 展开按钮，状态用 `v-model:collapsed` 绑定；收起后宽度变为 `collapsed-width`（默认 64px）。默认插槽拿得到 `collapsed`，直接传给 [Menu](./menu) 的 `collapsed`，菜单就缩成一列图标。`footer` 插槽固定在内容下方，适合放账户信息。

<div class="demo demo--column" style="padding: 0; overflow: hidden">
  <DouLayout style="height: 320px">
    <DouLayoutAside v-model:collapsed="collapsed" collapsible>
      <template #default="{ collapsed }">
        <DouMenu v-model="current" :items="items" :collapsed="collapsed" />
      </template>
    </DouLayoutAside>
    <DouLayoutMain>
      <DouText variant="secondary">侧栏{{ collapsed ? '已收起' : '已展开' }}</DouText>
    </DouLayoutMain>
  </DouLayout>
</div>

```vue
<DouLayoutAside v-model:collapsed="collapsed" collapsible>
  <template #default="{ collapsed }">
    <DouMenu v-model="current" :items="items" :collapsed="collapsed" />
  </template>
</DouLayoutAside>
```

## 吸顶

整页滚动时，`DouLayoutHeader` 加 `sticky` 停在顶部；`DouLayoutAside` 加 `sticky` 则停在顶栏下方、占满剩下的视口高度，侧栏内容过长时自己滚动。两者在同一个外层 `DouLayout` 里时，侧栏会自动让出顶栏的高度。

```vue
<DouLayout>
  <DouLayoutHeader sticky>…</DouLayoutHeader>
  <DouLayout>
    <DouLayoutAside sticky>…</DouLayoutAside>
    <DouLayoutMain>很长的页面内容</DouLayoutMain>
  </DouLayout>
</DouLayout>
```

主区的内边距来自 CSS 变量 `--dou-layout-main-padding`（默认 24px），顶栏与页脚的左右内边距来自 `--dou-layout-padding-x`（默认 20px）。

## API

### LayoutHeader Props

| 名称       | 说明               | 类型               | 默认值  |
| ---------- | ------------------ | ------------------ | ------- |
| `height`   | 高度，数字为 px    | `number \| string` | `56`    |
| `sticky`   | 页面滚动时停在顶部 | `boolean`          | `false` |
| `bordered` | 底部的分隔线       | `boolean`          | `true`  |

### LayoutAside Props

| 名称                   | 说明                      | 类型               | 默认值  |
| ---------------------- | ------------------------- | ------------------ | ------- |
| `width`                | 展开时的宽度，数字为 px   | `number \| string` | `240`   |
| `collapsedWidth`       | 收起时的宽度，数字为 px   | `number \| string` | `64`    |
| `collapsed`（v-model） | 是否收起                  | `boolean`          | `false` |
| `collapsible`          | 在底部显示收起 / 展开按钮 | `boolean`          | `false` |
| `sticky`               | 停在（吸顶的）顶栏下方    | `boolean`          | `false` |
| `bordered`             | 朝向主区一侧的分隔线      | `boolean`          | `true`  |

### LayoutAside Slots

| 名称      | 说明                           |
| --------- | ------------------------------ |
| `default` | 侧栏内容，参数 `{ collapsed }` |
| `footer`  | 固定在底部的内容，参数同上     |

### 键盘与读屏

- 各部分渲染为对应的 HTML 地标元素，读屏可以按地标跳转。
- 收起按钮的标签随状态在"收起侧栏"与"展开侧栏"之间切换，并带 `aria-expanded`。
