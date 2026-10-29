# InputTag 标签输入

将输入的内容转换为标签，适合填写关键词、邮箱列表等多个短值。

## 基础用法

输入后按 <DouKbd>Enter</DouKbd> 或输入逗号，当前文字就成为一个标签；首尾空白会去掉，重复的标签不会加入。输入框为空时按一下 <DouKbd>Backspace</DouKbd> 先选中最后一个标签，再按一下才删除，不会误删。

<DocDemo src="input-tag/basic" column style="max-width: 420px" />

粘贴一段用逗号、换行或制表符分隔的文字，会一次拆成多个标签。失去焦点时，还没回车的文字也会加成标签（`:add-on-blur="false"` 关闭）。

## 校验与上限

`validate` 决定一个标签能否加入，被拒绝的文字留在输入框里，方便修改；`max` 限制标签数量，到达上限后输入框隐藏。

<DocDemo src="input-tag/validate-max" column style="max-width: 420px" />

## 分隔符

`separators` 是输入时结束一个标签的字符，默认是半角与全角逗号，<DouKbd>Enter</DouKbd> 始终可以结束。

<DocDemo src="input-tag/separator" column style="max-width: 420px" />

## 尺寸与状态

与输入框一样有 `sm` / `md` / `lg` 三种尺寸，支持 `disabled`、`readonly` 与 `invalid`；在 [Form](./form) 里会跟随表单项的尺寸、禁用与校验状态。

<DocDemo src="input-tag/size-state" column style="max-width: 420px" />

## API

### InputTag Props

| 名称                    | 说明                             | 类型                                       | 默认值        |
| ----------------------- | -------------------------------- | ------------------------------------------ | ------------- |
| `modelValue`（v-model） | 标签                             | `string[]`                                 | `[]`          |
| `placeholder`           | 没有标签时的占位文字             | `string`                                   | —             |
| `size`                  | 尺寸                             | `'sm' \| 'md' \| 'lg'`                     | `'md'`        |
| `disabled`              | 禁用                             | `boolean`                                  | `false`       |
| `readonly`              | 只读                             | `boolean`                                  | `false`       |
| `invalid`               | 标记为无效                       | `boolean`                                  | `false`       |
| `clearable`             | 显示清空全部的按钮               | `boolean`                                  | `false`       |
| `max`                   | 最多几个标签                     | `number`                                   | —             |
| `separators`            | 输入时结束标签、粘贴时拆分的字符 | `string[]`                                 | `[',', '，']` |
| `allowDuplicates`       | 允许重复的标签                   | `boolean`                                  | `false`       |
| `addOnBlur`             | 失去焦点时把输入的文字加成标签   | `boolean`                                  | `true`        |
| `validate`              | 决定标签能否加入                 | `(tag: string, tags: string[]) => boolean` | —             |

其余属性（`name`、`aria-label` 等）会传给内部的原生输入框。

### InputTag Events

| 名称     | 说明         | 参数                           |
| -------- | ------------ | ------------------------------ |
| `add`    | 加入一个标签 | `(tag: string)`                |
| `remove` | 删除一个标签 | `(tag: string, index: number)` |
| `clear`  | 点击清空按钮 | —                              |

### InputTag Slots

| 名称     | 说明                                |
| -------- | ----------------------------------- |
| `prefix` | 输入框前的内容                      |
| `tag`    | 替换标签文字，参数 `{ tag, index }` |

### 键盘与读屏

- <DouKbd>Enter</DouKbd> 或分隔符加入标签；输入法组字时按 <DouKbd>Enter</DouKbd> 只确认文字，不会加入标签。
- 输入框为空时，<DouKbd>Backspace</DouKbd> 先选中最后一个标签，再按一次删除。
- 每个标签的删除按钮标签为“移除 + 标签文字”，读屏能分清删的是哪一个。
