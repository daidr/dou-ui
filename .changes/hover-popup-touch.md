---
type: 修复
packages: [dou-ui]
---

`trigger="hover"` 的 Dropdown、Popover 和 Menu 的弹出子菜单在手机上轻点打开后很快自己关上：轻点之后浏览器补发的鼠标事件被当成了指针离开。现在悬停只认鼠标和触控笔，触屏改为轻点打开、再点一下或点别处收起。
