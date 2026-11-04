# Steps 步骤条

把流程拆成几个步骤，并显示当前进行到哪一步。

## 基础用法

<DocDemo src="steps/basic" column />

`current` 之前的步骤是“已完成”，之后的是“未开始”。单个步骤可以用 `status` 自己指定状态。手机上横排放不下时，可以像这个示例一样用 `useBreakpoints` 切到竖向，也可以保持横排，见[步骤较多](#步骤较多)。

## 步骤较多

横排放不下所有标题时，除当前步骤外的标题收起，只留序号。鼠标悬停或键盘聚焦到某一步时，提示里显示它的标题和说明（用了 `title`、`description` 插槽时显示插槽的内容）。触屏上没有悬停，看不到其他步骤的标题，需要时可以像[基础用法](#基础用法)一样在手机上改用竖向。连序号也放不下时，步骤条可以横向滚动，并始终把当前步骤滚到可见处。宽度变大、标题变短时会恢复显示全部标题，标题在显示后才变长（异步数据、字体加载）也会重新判断。

<DocDemo src="steps/many" column />

## 出错与竖向

`status` 改变当前这一步的状态，比如 `error`。`direction="vertical"` 竖向排列，适合放在侧边。

<DocDemo src="steps/error-vertical" />

## 可点击

`clickable` 让每一步变成按钮，点击跳到那一步，配合 `v-model:current`。禁用的步骤不能点。

<DocDemo src="steps/clickable" column />

## 分步表单

把一张表单拆成几步填写时，所有字段放在同一个 `DouForm` 里，只渲染当前这一步的字段。点“下一步”时用 `validate(fields)` 只校验这一步的字段，通过后再前进；已经走过的步骤可以点回去修改，后面的步骤通过 `disabled` 锁住。最后一步提交整个表单。

<DocDemo src="steps/form" column />

## 键盘与读屏

步骤条是一个有序列表 `<ol>`，当前步骤带 `aria-current="step"`。每一步标题后面有一段只给读屏的状态文字（“已完成”“进行中”等，来自语言包），不靠颜色和图形传达状态。步骤较多、标题收起时，读屏软件仍会读出每一步的标题和状态。可点击时每一步是原生按钮。

## API

### Props

| 名称        | 说明                      | 类型                                          | 默认值         |
| ----------- | ------------------------- | --------------------------------------------- | -------------- |
| `items`     | 步骤                      | `StepItem[]`                                  | `[]`           |
| `current`   | 当前步骤的下标，从 0 开始 | `number`                                      | `0`            |
| `status`    | 当前步骤的状态            | `'pending' \| 'running' \| 'done' \| 'error'` | `'running'`    |
| `direction` | 方向                      | `'horizontal' \| 'vertical'`                  | `'horizontal'` |
| `size`      | 尺寸                      | `'sm' \| 'md'`                                | `'md'`         |
| `clickable` | 点击跳到对应步骤          | `boolean`                                     | `false`        |

### StepItem

| 名称          | 说明                        | 类型         |
| ------------- | --------------------------- | ------------ |
| `title`       | 标题                        | `string`     |
| `description` | 说明                        | `string`     |
| `status`      | 覆盖由 `current` 推出的状态 | `StepStatus` |
| `icon`        | 替换圆点里的编号            | `Component`  |
| `disabled`    | 不可点击                    | `boolean`    |

### Events

| 名称             | 说明           | 参数                |
| ---------------- | -------------- | ------------------- |
| `update:current` | 当前步骤变化   | `(current: number)` |
| `change`         | 用户点了某一步 | `(current: number)` |

### Slots

| 名称          | 说明                                       |
| ------------- | ------------------------------------------ |
| `title`       | 替换标题，参数为 `{ item, index, status }` |
| `description` | 替换说明，参数为 `{ item, index, status }` |

### CSS 变量

| 变量                      | 说明             |
| ------------------------- | ---------------- |
| `--dou-steps-marker-size` | 圆点直径         |
| `--dou-steps-line`        | 未完成的连线颜色 |
| `--dou-steps-line-done`   | 已完成的连线颜色 |
