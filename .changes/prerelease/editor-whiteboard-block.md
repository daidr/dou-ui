---
type: 新增
packages: [editor]
pr: 429
version: 0.1.0-alpha.15
---

新增 `@dou-ui/editor/flow`：`whiteboardBlock()` 在文档里放一块白板，`flowBlock()` 放自定义节点的流程图。文档里显示预览，双击、点“编辑”或选中后按 `Enter` 在全屏编辑器里绘制，撤销与文档共用历史；协同编辑时按节点和连线合并。块的 spec 新增 `mergeProps`，自定义块的列表属性也能逐项合并。
