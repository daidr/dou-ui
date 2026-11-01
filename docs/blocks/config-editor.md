---
wide: true
---

# 配置编辑

在页面上修改一个服务的 YAML 配置：边写边按规则检查，写错的地方直接标出；保存前可以先看和上次保存相比改了哪些地方。

<DocDemo src="blocks/config-editor" column />

用到的组件：[代码编辑器](../code/)与[对比视图](../code/#对比视图)、[PageHeader](../components/page-header)、[SegmentedControl](../components/segmented-control)、[Badge](../components/badge)、[Toast](../components/toast)。

- 规则写在一个对象里：哪些配置项必填、值的格式、可选的值。扩展的 `lint` 按缩进读出每一项和它在文本里的位置，把问题标在对应的键或值上；写错地域时，提示里可以直接改成可选的值之一。
- 扩展的 `completion` 按光标所在的层级补全键名，已经写过的顶层配置不再列出；在 `region:` 后面补全可选的地域。键名作为片段插入，有下一级的配置会换行并缩进。
- 有错误时不能保存，提醒（比如不认识的配置项）不影响保存。上方的摘要随输入更新。
- “查看改动”用 `DouCodeDiff` 对比上次保存的内容，右侧可以继续修改；“还原”回到上次保存的内容。
- 这里只读出配置文件常用的写法（按缩进分层的键值和 `- ` 列表）。完整的 YAML 可以交给 YAML 解析库读出，再用同样的方式给出诊断。
