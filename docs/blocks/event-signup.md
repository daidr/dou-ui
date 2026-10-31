---
wide: true
---

# 活动报名表

一场线下沙龙的报名表：在“设计表单”里增删字段、改校验和显示条件，切回“填写报名”立即按新的描述渲染；提交后右侧列出已报名的人和费用合计。

<DocDemo src="blocks/event-signup" column />

用到的组件：[表单设计器](../form-builder/builder)、[表单渲染器](../form-builder/)、[Segmented Control](../components/segmented-control)、[Tag](../components/tag)、[Empty](../components/empty)、[Toast](../components/toast)。

- 设计器和渲染器用的是同一个 `form`：设计器通过 `v-model` 交出新的描述，渲染器拿到后重新渲染，两者之间不需要转换。
- 选“线上直播”后，午餐、饮食和同行人都隐藏起来，提交的值里也不带它们（隐藏字段的值默认不提交）。
- “费用”是公式字段：`values.mode == 'onsite' ? 99 * (1 + len(values.guests)) : 0`，同行人增减时跟着变。
- 同行人是 `list` 字段，最多两位，每位的手机号单独校验。
- 右侧的明细按表单里的顺序和标签列出提交的值，选项显示成文字。这段转换在示例的 `form-summary.ts` 里，可以照着改成自己需要的格式。
- 填写区切到设计时只是隐藏、不卸载，回来时已填的值还在，设计里的修改也会立即用上。
- 示例不提交到服务端，提交的值只留在页面上。
