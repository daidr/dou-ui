---
type: 修复
packages: [dou-ui, theme]
---

很长的标签不再撑出 InputTag、Select / TreeSelect / Cascader 多选的输入框，也不再超出 Tag 自身的宽度：放不下的文字以省略号结尾，鼠标悬停显示完整内容。这几个输入框放在网格或横向弹性布局里时，长内容也不会把它们撑宽。
