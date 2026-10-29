# @dou-ui/icons

为 [DouUI](https://github.com/daidr/dou-ui) 绘制的 Vue 3 线性图标库，也可以单独使用。每个图标都是独立的组件，按需引入，不会把用不到的图标打包进来。

```sh
bun add @dou-ui/icons
```

```vue
<script setup lang="ts">
import { SearchIcon } from '@dou-ui/icons'
</script>

<template>
  <SearchIcon />
</template>
```

图标的尺寸与颜色跟随文字。原始 SVG 在 `@dou-ui/icons/svg/<name>.svg`，图标的名称与分类在 `@dou-ui/icons/meta`。
绘制规则见 [设计规范](https://github.com/daidr/dou-ui/blob/main/docs/icons/design.md)。

许可证：MIT
