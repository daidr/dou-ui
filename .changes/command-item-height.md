---
type: 修复
packages: [dou-ui, theme]
---

DouCommand / DouCommandDialog 的 `item` 插槽放两行或更高的内容时，行会跟着长高，高亮底色盖住整行，滚动定位也按实际高度来，不再固定 36px、溢出到下一行。开启 `virtual`（超过 100 条时默认开启）时也一样：渲染过的行按实际高度计算，没渲染的按最先显示的几行估算，上方的行高度变化时看到的内容不动；新增 `itemSize`（数字或 `(item) => number`），传了就固定每一行的高度、不再测量，内容超出时开发环境会提示。DouCommandDialog 现在也会把 `virtual` 和 `itemSize` 传给里面的列表，不传 `virtual` 时和 DouCommand 一样超过 100 条自动开启。

`line-height: 1` 和 `white-space: nowrap` 从 `.dou-command__item` 挪到了默认的标签和说明上：`item` 插槽里的内容现在用继承的行高，长文字会换行；需要单行省略时在插槽内容上自己加 `white-space: nowrap`。
