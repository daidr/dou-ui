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
  table: { label: '表格', color: 'primary' },
  number: { label: '数字', color: 'success' },
  text: { label: '文字', color: 'warning', accepts: ['number'] },
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

### 执行顺序和数据分开

有的流程需要区分“先做什么后做什么”和“数据从哪里来”。编辑器不内置这两种连线，可以注册一个执行类型（例如上面的 `exec`），给它换一个形状和线宽，它和数据端口互不相连。下面的例子里，三角形端口表示执行顺序，圆形端口传递数据，“文字”端口也接受“数字”。

<DocDemo src="flow/port-types" column />

这个例子还打开了 `acyclic`，不允许连出环。

## 自定义规则

`can-connect` 在其他规则都通过后调用，返回 `false` 拒绝这条连线：

```vue
<DouFlowEditor
  v-model="doc"
  :can-connect="({ source, target }) => !(source.node === 'start' && target.node === 'end')"
/>
```

## 数量限制

端口的 `max` 限制它最多连几条线。输入端口默认是 1，连到已有连线的输入时会替换原来的线；把 `max` 设大可以接多条。输出端口默认不限。
