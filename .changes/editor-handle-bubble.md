---
type: 不兼容
packages: [editor]
---

块把手改成浮在正文左侧的圆角气泡，不再占用宽度，鼠标移到把手上才出现 `+`：`--dou-editor-gutter` 默认从 `56px`（触屏 `32px`）改为 `0`，正文从编辑器左边开始，把手放在外层容器的内边距里，放不下时移进正文。只读时不再强制为 `0`，设置的空白只读时也保留（只读时要去掉，另写 `.dou-editor.is-readonly { --dou-editor-gutter: 0px }`）；对比版本时为 `16px`。要保留原来的左侧空白：`.dou-editor { --dou-editor-gutter: 56px }`，触屏另加 `@media (pointer: coarse) { .dou-editor { --dou-editor-gutter: 32px } }`。宽表格向左滚动时，左边移到离编辑器左边 10px 处。
