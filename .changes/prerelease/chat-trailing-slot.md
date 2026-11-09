---
type: 新增
packages: [dou-ui]
pr: 400
version: 0.1.0-alpha.11
---

DouMarkdown、DouStreamText、DouChatMessage 新增 `trailing` 插槽：内容跟在正文最后一个字后面、和文字同一行，适合放“已编辑”这类常驻标记。在 Markdown 里位置和流式光标相同，最后一块是代码块或分隔线时单独占一行；在 ChatMessage 里跟在最后一个文字片段末尾，不受 `actionsVisible` 影响。
