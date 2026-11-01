// 仅供仓库自身的类型检查使用，不随包发布。
// 开启 checkUnknownProps 后，普通元素上的 data-* 也要过属性检查，
// 而 Vue 的元素属性类型里没有 data-*，这里补上。
// 组件上的 data-* 由 dou-ui 与 @dou-ui/icons 发布的声明负责。

export interface TemplateDataAttributes {
  [key: `data-${string}`]: unknown
}

declare module 'vue' {
  interface HTMLAttributes extends TemplateDataAttributes {}
  interface SVGAttributes extends TemplateDataAttributes {}
}
