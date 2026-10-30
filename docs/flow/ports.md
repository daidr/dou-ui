# 端口类型与连接规则

不做任何设置时，输出端口可以连到任何输入端口。需要限制时，按需要选用下面几层规则，每一层都是可选的。

## 数据类型

给端口写上 `dataType`，只有类型相同的端口才能相连。没有写类型或类型为 `'any'` 的端口可以和任何端口相连。`dataType` 也可以是数组，表示端口接受其中任意一种。

下面的例子里，“数字”不能连到“文字”，“表格”可以连到“画柱状图”。拖动时能连的端口会高亮，不能连的变淡。

<DocDemo src="flow/data-types" column />

## 注册端口类型

`port-types` 为类型设置外观和额外的连接规则：

```ts
const portTypes = {
  exec: { label: '执行', shape: 'triangle', edgeWidth: 2 },
  table: { label: '表格', shape: 'square' },
  number: { label: '数字', shape: 'diamond' },
  text: { label: '文字', accepts: ['number'] },
}
```

| 名称        | 说明                                              | 类型                                                                     |
| ----------- | ------------------------------------------------- | ------------------------------------------------------------------------ |
| `label`     | 类型的名称                                        | `string`                                                                 |
| `shape`     | 端口的形状                                        | `'circle' \| 'square' \| 'diamond' \| 'triangle'`                        |
| `color`     | 端口和从它连出的线的颜色，主题色名或任意 CSS 颜色 | `'neutral' \| 'primary' \| 'success' \| 'warning' \| 'danger' \| string` |
| `edgeWidth` | 连线粗细，默认 1px                                | `number`                                                                 |
| `dashed`    | 连线画成虚线                                      | `boolean`                                                                |
| `accepts`   | 这个类型的输入端口还接受哪些类型                  | `string[]`                                                               |

端口有多个类型时，外观取第一个类型。

区分类型优先用形状。颜色在界面里通常表示状态，例如红色表示出错，所以只在类型确实需要强调时才设置 `color`，并且不要用太多种。

### 执行顺序和数据分开

有的流程需要区分“先做什么后做什么”和“数据从哪里来”。编辑器不内置这两种连线，可以注册一个执行类型（例如上面的 `exec`），给它换一个形状和线宽，它和数据端口互不相连。下面的例子里，三角形端口表示执行顺序，其他形状的端口传递数据：方形是表格，菱形是数字，圆形是文字，“文字”端口也接受“数字”。

<DocDemo src="flow/port-types" column />

这个例子还打开了 `acyclic`，不允许连出环。

## 端口类型随数据变化

节点类型的 `ports` 可以写成函数，根据节点数据算出端口，端口的类型就能跟着节点里的表单变化。下面的“读取变量”和“设置变量”节点，端口类型由选中的变量决定：

```js
const variableNode = defineNodeType({
  type: 'variable',
  component: VariableNode,
  ports: (node) => [
    {
      id: 'value',
      kind: node.data.mode === 'get' ? 'output' : 'input',
      dataType: variables[node.data.name].type,
    },
  ],
})
```

类型变了以后，已有的连线可能就对不上了。编辑器不会自动删除这些连线，而是把它们画成红色虚线，并告诉读屏用户有几条。编辑器实例上的 `staleEdges` 是这些连线的 id，`removeStaleEdges()` 把它们一起删掉，算作一步撤销。端口被删掉时，连在上面的线也算对不上。

<DocDemo src="flow/variables" column />

## 自定义规则

`can-connect` 在其他规则都通过后调用。返回 `false` 拒绝这条连线；返回一段文字也是拒绝，这段文字会在松开时读给读屏用户，说明为什么不能连：

```vue
<DouFlowEditor
  v-model="doc"
  :can-connect="
    ({ source, target }) =>
      source.node === 'start' && target.node === 'end' ? '开始节点不能直接连到结束节点' : true
  "
/>
```

拖动连线时，编辑器会对每个端口调用一次 `can-connect`，用来决定哪些端口高亮，所以里面不要做耗时的计算。

## 连不上的时候

拖动时，指针停在不能连的端口上，这个端口和正在画的线会变红，指针变成禁止的样式。松开后连线不会生成，读屏会说明原因，例如“端口类型不匹配”“这样会连成环”。这些文字可以通过 `messages.refused` 修改。

`joinRefusal(doc, connection, ports, options)` 返回同样的原因，可以用来在界面上给出自己的提示。

## 数量限制

端口的 `max` 限制它最多连几条线。输入端口默认是 1，输出端口默认不限。端口已经连满时，新连线照样可以连上，这个端口上最早的那条线会被替换掉。
