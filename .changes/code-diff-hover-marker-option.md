---
type: 新增
packages: [code]
---

DouCodeEditor 的 `CodeGutter` 和 DouCodeDiff 的 `CodeDiffGutter` 新增 `hoverMarker`：没有自己标记的每一行都显示这个标记，悬停时出现，适合“每一行都能点 + 写评论、加断点”这样的入口，不用再为每一行写一个标记。DouCodeDiff 里可以用 `side` 限定只显示在一侧，另一侧的空格子也不再响应点击。两者的 `markers` 都改为可选。`CodeGutter` 另加 `pressOn: 'markers'`，只让标记响应点击，空格子不显示手形光标。`hoverMarker.title` 可以写成函数，按行（DouCodeDiff 里还有一侧）给每个标记取名。
