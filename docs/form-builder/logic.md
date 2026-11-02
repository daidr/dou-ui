# 联动与表达式

选了某一项才出现另一个字段、勾上某个选项后另一个字段变成必填、金额由单价和数量算出来，这些逻辑写成表达式存在描述里，和字段一起保存、一起修改。

表达式是一门很小的语言，由渲染器自己解析和执行，不会交给 `eval` 或 `new Function`。它只能读表单的值、调用内置函数和你注册的函数，所以执行从数据库取回的描述是安全的。

## 显示、禁用与必填

节点上的三个属性接受表达式：

- `visibleWhen`：为真时才显示。隐藏的字段不渲染，提交时也不校验。分组隐藏时，里面的字段一起隐藏。
- `disabledWhen`：为真时禁用。分组禁用时，里面的字段一起禁用。
- `requiredWhen`：为真时必填，必填标记也跟着出现或消失。写了它就不再看 `required`。

表达式里用 `values.字段名` 读其他字段的值，嵌套字段写成 `values.contact.phone`。

<DocDemo src="form-builder/logic-visible" column />

隐藏字段的值仍留在 `model` 里，再次显示时不用重新填写；`submit` 拿到的值默认去掉了它们，见[隐藏字段的值](./structure#隐藏字段的值)。

## 公式

`formula` 让字段保存一个表达式的结果。它读到的值一变就立即重新计算，公式之间可以互相引用，按依赖顺序算出结果。

<DocDemo src="form-builder/logic-formula" column />

- 公式字段只用来显示结果：文本框、数字框等能设为只读的控件设为只读（数字框同时隐藏加减按钮），其他控件设为禁用。
- 算术结果会去掉小数的二进制误差，`0.1 * 3` 得到 `0.3`。
- 依赖的字段还没填时，公式字段是空的，而不是 0：乘、除、取余有一边为空时结果为空；加、减两边都为空时结果为空，只有一边为空时空的一边按 0 计算。需要别的规则时，可以写成 `empty(values.count) ? null : values.price * values.count`。

如果几个公式互相引用形成环（`a` 读 `b`，`b` 又读 `a`），这些公式都不会计算，渲染器在控制台提示一次。设计器可以用 `findFormulaCycles(form)` 提前找出它们。

公式写入的值不会触发 `change` 事件，`change` 只表示使用者填写了字段。

## 用表达式校验

规则里的 `check` 是一个表达式，结果为真才算通过。`value` 是这个字段自己的值，`values` 是整个表单。和 `min`、`pattern` 一样，`check` 不检查空值，是否必填交给 `required`。

`check` 读了其他字段时，那些字段改变后，如果这个字段正显示着错误，会立即重新检查。下面改动入住日期或勾选加床，离店日期和人数上的错误会随之消失。

<DocDemo src="form-builder/logic-check" column />

## 选项来源

选择类字段的选项可以在运行时加载。描述里的 `source` 只写来源的名字和一个参数表达式，加载函数通过渲染器的 `sources` 注册，所以描述里不会出现函数或接口地址。

```ts
source: { name: 'cities', arg: 'values.province' }
```

`arg` 表达式的结果就是交给加载函数的参数。要传多个值时写成列表，比如 `[values.province, values.kind]`。

<DocDemo src="form-builder/logic-source" column />

- 参数变化时重新加载。新的选项里如果没有字段当前的值，这个值会被清空（多选时只去掉不再提供的项），比如换了省份，城市就清空。
- 第一次加载不清空，所以编辑已有数据时，从接口取回的值会保留。`keep: true` 可以关掉自动清空。
- 同一个来源、同一个参数的结果会被缓存，几个字段问同一件事只请求一次；加载失败的结果不缓存，下次重新请求。
- 加载期间，支持 `loading` 的控件（如 `select`）会显示加载状态。
- 选项在服务端更新后，调用实例方法 `reloadSource(name)` 丢掉这个来源的缓存并重新加载，不传 `name` 时重新加载全部来源。

内置类型里，`select`、`radio-group`、`checkbox-group`、`segmented-control`、`cascader` 的选项写入 `options`，`tree-select` 写入 `data`。自定义字段类型用 `optionsProp` 指定由哪个属性接收选项，用 `fitValue(value, options)` 决定选项变化后怎样清理旧值（内置的 `fitToOptions` 处理单个值和列表，`fitPathToOptions` 处理级联的路径）。

## 表达式语法

| 写法                                                                     | 说明                                                                                                                                                                   |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `12`、`1.5`、`'上海'`、`"上海"`、`true`、`null`、`[1, 2]`                | 数字、文字、布尔值、空值、列表                                                                                                                                         |
| `values.city`、`values.contact.phone`、`values.list[0]`、`values['a-b']` | 读取表单的值，路径上缺了就是 `null`                                                                                                                                    |
| `value`                                                                  | 当前字段自己的值                                                                                                                                                       |
| `item.price`                                                             | 列表里同一项的值                                                                                                                                                       |
| `+ - * / %`                                                              | 算术。`+` 两边有文字时拼接文字。`* / %` 有一边为空时得到 `null`；`+ -` 两边都为空时得到 `null`，只有一边为空时按 0 计算；结果不是有限数字（比如除以 0）时也得到 `null` |
| `== !=`                                                                  | 按值比较，列表和对象逐项比较。数字和数字形式的文字按数字比较（文本框里的 `3` 等于 `3`），其他不做类型转换                                                              |
| `< <= > >=`                                                              | 比较数字或文字。一边是数字、另一边是数字形式的文字时按数字比较。`YYYY-MM-DD` 格式的日期可以直接比较                                                                    |
| `&& \|\| !`                                                              | 并且、或者、取反                                                                                                                                                       |
| `a ? b : c`                                                              | 条件                                                                                                                                                                   |
| `x in list`                                                              | `x` 在列表里，或者文字 `x` 出现在另一段文字里                                                                                                                          |

`false`、`null`、`0`、空文字和空列表都算假，其余都算真。这一点和 JavaScript 不同：空列表也算假，所以 `visibleWhen: 'values.tags'` 在一个标签都没选时为假。

表达式里只能出现 `values`、`value`、`item`（列表的一项，见[列表](./structure#列表)）和函数名。写成 `city == 'sh'` 会报错并提示改成 `values.city`；把 `==` 写成 `=` 也会提示。读不到对象自身的属性时（例如 `constructor`）结果是 `null`。

### 内置函数

| 函数                                  | 说明                                                   |
| ------------------------------------- | ------------------------------------------------------ |
| `len(x)`                              | 文字长度、列表项数或对象的键数，空值为 0               |
| `empty(x)`                            | 是否为空：`null`、空白文字、空列表、空对象             |
| `number(x)`                           | 转成数字，转不了时为 `null`                            |
| `sum(list)`、`min(list)`、`max(list)` | 对一个列表或多个参数求和、求最小值、求最大值，空值跳过 |
| `sum(list, 'key')`                    | 对列表每一项的 `key` 求和，`min`、`max` 同理           |
| `round(x, digits?)`                   | 四舍五入到 `digits` 位小数，默认取整；`x` 为空时为空   |
| `abs(x)`                              | 绝对值                                                 |
| `today(offset?)`                      | 今天的日期（`YYYY-MM-DD`），`offset` 为相对今天的天数  |
| `days(from, to)`                      | 从 `from` 到 `to` 相隔的天数                           |
| `contains(list, x)`                   | 同 `x in list`                                         |

### 自定义函数

渲染器的 `functions` 注册额外的函数，和内置函数同名时替换内置的那个。函数拿到的是参数的值，不应修改它们。函数抛错时表达式的结果为 `null`，控制台提示一次。

```vue
<DouFormRenderer :form="form" :functions="{ tax: (price) => price * 0.06 }" />
```

```ts
formula: 'round(values.price + tax(values.price), 2)'
```

### 出错时

无法解析的表达式会被忽略，控制台提示一次，并给出出错的位置。忽略时 `visibleWhen` 按显示处理，`disabledWhen` 按不禁用处理，`requiredWhen` 按 `required` 处理。

编辑器可以用 `checkExpression(source, { fields, functions })` 提前检查。它返回问题列表，每项带 `code`、出错的原文 `text` 和起止位置 `start` / `end`；传入字段名和函数名时，还会指出不存在的字段和函数。`message` 是给开发者看的英文说明，界面上请按 `code` 显示自己的文字：

| code                   | 含义                               | 界面文字示例                 |
| ---------------------- | ---------------------------------- | ---------------------------- |
| `unexpected-character` | 不认识的字符，或把 `&&` 写成了 `&` | 这里不能出现“{text}”         |
| `unterminated-string`  | 文字缺少结尾的引号                 | 文字缺少结尾的引号           |
| `unexpected-token`     | 这个位置不该出现这部分             | 这里不能出现“{text}”         |
| `unexpected-end`       | 表达式没写完                       | 表达式还没写完               |
| `unknown-name`         | 直接写了名字，没有加 `values.`     | 读取字段请写成 values.{text} |
| `assignment`           | 把 `==` 写成了 `=`                 | 比较请用 ==                  |
| `too-deep`             | 嵌套超过 64 层                     | 表达式嵌套太深               |
| `too-long`             | 超过 4000 个字符                   | 表达式太长                   |
| `unknown-field`        | 没有这个字段                       | 没有字段“{text}”             |
| `unknown-function`     | 没有这个函数                       | 没有函数“{text}”             |

## 性能

每个表达式按原文只解析一次，结果全局缓存，同一段表达式在多个字段上共用一份。执行时直接读取响应式的 `model`，所以每个表达式只订阅它真正读到的值：在一个字段里输入，只有读了这个字段的表达式重新计算。

性能基准的 `form-logic` 用例在每 10 个字段的分组里，让其余字段的显示、必填和一个公式都依赖分组里的第一个文本框。300 个字段时，在其中一个文本框里输入，脚本耗时约 3.5ms，只有这一组的表达式重新计算。

## API

### 节点属性

| 名称          | 说明                              | 适用于       |
| ------------- | --------------------------------- | ------------ |
| visibleWhen   | 为真时显示                        | 全部节点     |
| disabledWhen  | 为真时禁用                        | 全部节点     |
| requiredWhen  | 为真时必填，替代 `required`       | 字段         |
| formula       | 字段的值由表达式算出              | 存值的字段   |
| source        | 选项来源，`{ name, arg?, keep? }` | 带选项的字段 |
| rules[].check | 值要满足的表达式                  | 存值的字段   |

### 渲染器属性与实例方法

| 名称         | 说明                             | 类型                                                       |
| ------------ | -------------------------------- | ---------------------------------------------------------- |
| functions    | 表达式可以调用的函数             | `Record<string, (...args) => unknown>`                     |
| reloadSource | 实例方法，重新加载一个或全部来源 | `(name?: string) => void`                                  |
| sources      | 选项来源，按名字注册             | `Record<string, (arg) => unknown[] \| Promise<unknown[]>>` |

### 工具函数

| 名称                                                                | 说明                                                                                                   |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `compileExpression(source)`                                         | 解析表达式，返回 `evaluate`、读到的字段 `fields`、调用的函数 `calls`；解析失败时抛出 `ExpressionError` |
| `evaluateExpression(source, scope)`                                 | 解析并执行，`scope` 为 `{ values, value?, item?, functions? }`                                         |
| `parseExpression(source)`                                           | 只解析，返回语法树，供可视化的条件编辑使用                                                             |
| `checkExpression(source, options?)`                                 | 检查语法、字段和函数，返回问题列表                                                                     |
| `fitToOptions(value, options)` / `fitPathToOptions(value, options)` | 把值收窄到选项提供的范围                                                                               |
| `findFormulaCycles(form)`                                           | 找出互相引用的公式                                                                                     |
| `truthy(value)` / `isEmptyValue(value)` / `equalValues(a, b)`       | 表达式里真假、空值和相等的判断                                                                         |
