---
wide: true
---

# 设备报修单

办公室 IT 报修：分“设备”“故障”“联系方式”三步填写，每一步点“下一步”时只检查这一步的字段；提交后在右侧生成工单。表单同样可以切到“设计表单”修改，切回来时已填的值和所在的步骤都保留。

<DocDemo src="blocks/repair-order" column />

用到的组件：[表单设计器](../form-builder/builder)、[表单渲染器](../form-builder/)、[Segmented Control](../components/segmented-control)、[Tag](../components/tag)、[Empty](../components/empty)、[Toast](../components/toast)。

- 三个步骤是 `steps` 里的三个 `page`，提交按钮写在渲染器的插槽里，只在最后一步出现。
- “故障现象”的选项来自 `source: { name: 'symptoms', arg: 'values.kind' }`，加载函数通过 `sources` 注册，设计器的预览和渲染器用同一份；换设备类型时选项重新加载。
- 选“网络”时不需要资产编号，选“笔记本”时才问系统，都是 `visibleWhen`。
- 勾选“其他”后“详细描述”变成必填：`requiredWhen: "contains(values.symptoms, '其他')"`。
- “预计响应”由紧急程度算出，是只读的公式字段，和其他值一起提交。
- 照片用 `upload` 字段，`autoUpload: false` 时文件随表单一起提交，由页面自己决定上传方式。
