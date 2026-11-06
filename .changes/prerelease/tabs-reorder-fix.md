---
type: 修复
packages: [dou-ui]
pr: 371
version: 0.1.0-alpha.7
---

`DouTabs` 的面板顺序改变后（比如重排 `v-for` 的数据），标签的顺序会跟着变，之前只在面板挂载时排一次。
