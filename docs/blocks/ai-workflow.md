---
wide: true
---

# AI 工作流

可视化编排的 AI 工作流：在画布上摆放步骤、拖动端口连线，选中一个步骤后在设置面板里修改它；提示词等文本可以引用前面步骤的结果。

<DocDemo src="blocks/ai-workflow" column />

用到的组件：[流程编辑器](../flow/)、[Form](../components/form)、[Select](../components/select)、[Slider](../components/slider)、[Textarea](../components/textarea)、[Dropdown](../components/dropdown)、[Drawer](../components/drawer)。

- 每种步骤是一个节点类型，它们合起来是一个扩展（`defineFlowExtension`），和 `flowKit()` 一起传给 `extensions`。扩展的 `transformPaste` 让粘贴出来的步骤清掉运行状态。
- 步骤只用一种连线，表示“然后做什么”；数据靠文本里的 <code v-pre>{{步骤.结果}}</code> 引用。设置面板只列出连线上游的步骤，可以点一下插入。
- “判断”有“是”和“否”两个出口，各连一个后续步骤。打开了 `acyclic`，不会连出环。
- “添加步骤”把新步骤放在选中步骤的下方并连好；没有选中时放在画布中间。
- “试运行”沿连线依次点亮每一步。运行状态写进节点数据时不进撤销历史（`transact` 的 `history: false`）。
- 流程从上到下排列（`direction="vertical"`），端口在节点的上下两边。控制栏的“整理”也按这个方向重新排列步骤，可以撤销。
- 宽度小于 720px 时，设置面板改为从底部弹出的抽屉，点按步骤时打开。
