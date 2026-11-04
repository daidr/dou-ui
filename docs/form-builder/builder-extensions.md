---
wide: true
---

# 设计器扩展

扩展给设计器加上新的能力，也可以把设计器的各个面板自己摆放。

## 基础用法

一个扩展可以带字段类型、快捷键、工具栏按钮、节点菜单项、属性面板里的部分，以及对每次修改的处理，传给 `extensions`。下面的扩展在节点菜单（右键或节点上的 `⋯` 按钮）、工具栏和 `Alt + R` 上加了“切换必填”：

<DocDemo src="form-builder/builder-extension" column />

### 扩展的选项

| 选项              | 作用                                                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`            | 扩展的名字，同一个设计器里不能重复                                                                                                                      |
| `priority`        | 越大越先执行，默认 `100`                                                                                                                                |
| `fields`          | 字段类型，和 `fields` 属性一样出现在字段面板里                                                                                                          |
| `keymap`          | 画布或结构树有焦点时的快捷键，写法同 `useHotkey`；先于内置快捷键，返回 `false` 时交给后面处理                                                           |
| `toolbar`         | 工具栏按钮：`key`、`label`、`icon`、`run`，以及 `disabled`、`pressed`、`shortcut`（显示在提示里，并作为 `aria-keyshortcuts`；按键本身用 `keymap` 绑定） |
| `menu`            | 选中节点的菜单项，排在内置的移动、复制、放进分组、删除之后；`shortcut` 显示在菜单项末尾，`description` 显示在文字下面                                   |
| `inspector`       | 属性面板里追加的部分：`title` 和 `component`，没有选中节点时参数是 `undefined`                                                                          |
| `transaction`     | 每次修改提交前调用，可以往事务里追加步骤，它们和原来的修改是同一步撤销；撤销和重做不经过这里                                                            |
| `setup`           | 设计器挂载后调用，返回的函数在卸载时调用                                                                                                                |
| `marks`           | 节点上的标记：`key`、`label`、`color`，画布上显示为同色的框和名字，结构树里显示为圆点；渲染时读取，里面用到的响应式数据变化时会更新                     |
| `expressionInput` | 替换表达式输入框（公式、表达式规则、写成表达式的条件），设计器只读时收到 `readonly`；取第一个提供它的扩展，`codeExpressions()` 用它换成代码输入框       |
| `history`         | 替换内置的撤销记录，返回 `undo`、`redo`、`canUndo`、`canRedo`；只取第一个提供它的扩展，[协同编辑](./collaboration)用它只撤销自己的修改                  |

扩展里的函数拿到的参数和 `useFormBuilder()` 是同一个对象。扩展带来的字段类型也要交给渲染器，`resolveFormBuilderFields(fields, extensions)` 把两处的字段类型合在一起：

```ts
import { resolveFormBuilderFields } from '@dou-ui/form-builder'

const fields = resolveFormBuilderFields([chipField], [myExtension])
// <DouFormRenderer :form="form" :fields="fields" />
```

## 自己摆放面板

默认插槽会替换设计器的整个布局，可以把 `DouFormBuilderPalette`（字段面板）、`DouFormBuilderCanvas`（画布）、`DouFormBuilderInspector`（属性面板）、`DouFormBuilderOutline`（结构树）、`DouFormBuilderPreview`（预览）放在任何位置，它们共用同一个设计器的状态。`toolbar` 插槽在默认布局的撤销、重做按钮后面追加按钮。

<DocDemo src="form-builder/builder-parts" column />
