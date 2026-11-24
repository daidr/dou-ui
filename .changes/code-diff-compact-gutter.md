---
type: 改进
packages: [code]
---

优化 `DouCodeEditor` 与 `DouCodeDiff` 行号列宽度和窄屏布局：关闭行号且无折叠时移除 `DouCodeEditor` 行号栏尾部 12px 冗余留白；收紧 `DouCodeDiff` 在 `inline` / `split` 模式下的行号字号、列宽与符号列间距，并在容器宽度小于 480px 时启用紧凑行号布局；`CodeGutter` 与 `CodeDiffGutter` 新增 `overlay` 悬浮叠加模式（`DouCodeDiff` 支持 `true` 或 `'compact'`），行级操作按钮可不占固定列宽。
