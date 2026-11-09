---
type: 修复
packages: [dou-ui]
---

DouButton 的默认插槽、`leading` 或 `trailing` 这一次没有渲染出内容时（比如里面只有一个 `v-if` 为假的数字），当作没有传这个插槽：有 `leading` 图标的按钮会变成和纯图标按钮一样的方形，也不再多出一个空的图标位。
