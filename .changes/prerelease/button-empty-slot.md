---
type: 修复
packages: [dou-ui]
pr: 421
version: 0.1.0-alpha.13
---

DouButton 的默认插槽、`leading` 或 `trailing` 没有渲染出内容时（比如里面只有一个 `v-if` 为假的数字），当作没有传这个插槽：有 `leading` 图标的按钮会变成和纯图标按钮一样的方形，也不再多出一个空的图标位。DouTag、DouCheckTag 和 DouLink 的 `leading` 插槽没有渲染出内容时，也不再留下空的图标位；DouLink 设了 `external` 而 `trailing` 没有渲染出内容时，仍显示外链箭头。
