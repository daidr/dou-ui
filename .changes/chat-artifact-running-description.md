---
type: 改进
packages: [dou-ui]
---

DouChatArtifact 在 `status="running"` 时，传了 `description` 就带扫光显示它（比如“找报表数据从哪来 · 1/3”），没传才显示“正在生成”。之前运行中会忽略 `description`。完成后请把 `description` 换成结果的说明。
