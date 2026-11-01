---
wide: true
---

# 代码练习

在线练习一道编程题：左边是题目和示例，右边写代码，点“运行测试”逐条检查结果；写完后可以和参考答案并排对比。

<DocDemo src="blocks/code-practice" column />

用到的组件：[代码编辑器](../code/)与[对比视图](../code/#对比视图)、[PageHeader](../components/page-header)、[Card](../components/card)、[SegmentedControl](../components/segmented-control)、[Tag](../components/tag)、[Alert](../components/alert)。

- 代码在 Web Worker 里运行，写出死循环也不会卡住页面，超过 1 秒自动停止。实际使用时，代码通常交给服务器的沙箱运行，页面只显示结果。
- 编辑器上的检查来自一个扩展的 `lint`：没有定义 `formatPrice` 时标红；留下的 `console.log` 标出提示，提示里的“删除这一行”是诊断的 `actions`。
- 同一个扩展的 `completion` 提供几个常用方法，按 `Ctrl` + `Space` 打开，也可以输入时自动出现。
- “对比参考答案”用 `DouCodeDiff` 把自己的代码和参考答案放在一起，宽度不够时改为单栏显示。
