---
type: 修复
packages: [dou-ui, theme]
---

DouCommand / DouCommandDialog 的 `item` 插槽放两行或更高的内容时，行会跟着长高，高亮底色盖住整行，滚动定位也按实际高度来，不再固定 36px、溢出到下一行。开启 `virtual`（超过 100 条时默认开启）时行高固定，新增 `itemSize`（数字或 `(item, index) => number`，默认 36）来指定；内容超出时开发环境会提示。DouCommandDialog 现在也会把 `virtual` 传给里面的列表。
