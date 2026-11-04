---
type: 修复
packages: [dou-ui]
---

`trigger="hover"` 的 Dropdown、Popover 和 Menu 的弹出子菜单在手机上轻点打开后很快自己关上：轻点之后浏览器补发的鼠标事件被当成了指针离开。现在悬停只认鼠标，触屏和触控笔改为轻点打开、再点一下或点别处收起；触发元素是链接时，第一次轻点只打开弹出层。悬停的 Popover 也能用 `Enter` 打开，轻点或键盘打开时带上 `aria-expanded`。ChatCitation 的预览标题改为来源链接，键盘聚焦角标时会弹出预览。
