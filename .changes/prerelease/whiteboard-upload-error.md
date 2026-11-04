---
type: 改进
packages: [flow]
pr: 291
version: 0.1.0-alpha.2
---

白板图片上传失败时在屏幕下方显示错误提示，不再只有读屏能听到；新增 `onUploadError(file, error)` 选项，可以改用自己的方式提示。`upload` 没有返回 `src` 时也算失败，不再插入坏图。
