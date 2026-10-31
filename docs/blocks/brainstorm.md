---
wide: true
---

# 头脑风暴

团队用便签讨论一个话题的白板：每个人的便签有自己的颜色，选中便签可以投票，右侧按票数排出结果，讨论完可以导出成图片。

<DocDemo src="blocks/brainstorm" column />

用到的组件：[流程编辑器](../flow/)与[白板](../flow/whiteboard)、[SegmentedControl](../components/segmented-control)、[Drawer](../components/drawer)、[Empty](../components/empty)。

- 白板是 `flowKit()`、`whiteboardKit()` 和一个自己的扩展。三个分类是分组节点，便签拖进分组就归到那一类，拖动分组时里面的便签一起移动。
- 新贴的便签由扩展的 `transaction` 记下作者，并换成作者的颜色。顶部切换成员只是为了在一个页面里演示多人，实际使用时作者就是当前登录的人。
- 投票存在便签的 `data.votes` 里，是一个人名数组，同一个人只能投一票。扩展用 `toolbarItems` 在选中的便签上方加了“赞同”按钮，再点一次取消。
- 点投票结果里的一项，会选中那张便签并移到画布中间。
- “导出图片”调用 `exportPNG()`，导出整块白板，见[导出图片](../flow/export)。
- 多人同时编辑时加上 `collaboration()` 扩展，便签、投票和分组都会同步，见[白板的协同编辑](../flow/whiteboard#协同编辑)。
- 宽度小于 720px 时，投票结果改为从底部弹出的抽屉。
