/**
 * 任何组件上都能写的 `data-*` 属性，原样透传到组件的根元素。
 *
 * 模板类型检查会把组件上的 `data-foo` 转成 `dataFoo` 再核对，所以两种写法都要接受。
 * 驼峰的一种只用一条 `data${Capitalize<string>}`，代价是裸写的 `data` 也会被接受：
 * 拆成按首字母的几十条能拦住它，但每个组件上的每个属性都要逐条比较，
 * 所有装了 dou-ui 的项目类型检查都会慢上约一半。有 `data` prop 的组件以自己的 prop 为准，不受影响。
 */
export interface DataAttributes {
  [key: `data-${string}`]: unknown
  [key: `data${Capitalize<string>}`]: unknown
}

// 开启 checkUnknownProps 后，模板里组件上的属性要和 props 逐个对上。
// aria-* 不会被转成驼峰，`<DouButton aria-label="…">` 会因为没有 `aria-label` 这个 prop 报错；
// data-* 会被转成 `dataFoo`，同样对不上。这里让所有组件都接受这两类属性：
// 它们本来就会作为透传属性落到根元素上，声明了 `ariaLabel` 的组件在运行时也照常收到这个 prop。
declare module 'vue' {
  interface AriaAttributes {
    /** 直接写成文字的补充说明，不必像 `aria-describedby` 那样另放一个元素。 */
    'aria-description'?: string
  }
  interface AllowedComponentProps extends AriaAttributes, DataAttributes {}
}
