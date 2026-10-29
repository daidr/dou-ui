<template>
  <DouEllipsis style="max-width: 280px">
    DouUI 的组件都支持亮色与暗色两套主题，并且在两套主题下都检查过文字对比度。
  </DouEllipsis>
  <DouEllipsis :lines="2" style="max-width: 280px">
    表单控件都可以放进 Form 里统一校验：标签、说明与错误信息由 FormItem
    负责，控件只关心自己的值。尺寸和禁用状态也会从表单传到每个控件上。
  </DouEllipsis>
</template>
