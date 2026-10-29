---
wide: true
---

<script setup>
import { icons } from '@dou-ui/icons/meta'
</script>

# 图标库

`@dou-ui/icons` 是与 DouUI 同一套视觉语言绘制的线性图标库：24 × 24 网格、随尺寸做光学补偿的细线、圆头圆角、颜色跟随文字，在不同尺寸下视觉粗细保持一致。它是独立的子包，不依赖 `dou-ui`，任何 Vue 3 项目都能用。目前共 {{ icons.length }} 个图标，会按需要逐步补充。

点击图标可以查看详情、复制引入代码或 SVG 源码。用法见 [安装与使用](./usage)，设计原则与绘制规则见 [设计规范](./design)。

<DocIconGallery />
