# 命令与工具栏按钮

命令按名字登记一个操作，带文字、图标和快捷键提示。工具栏按钮、右键菜单项和快捷键都可以写命令名来引用它。

## 执行命令

组件实例和 `useSheet()` 上的 `commands` 可以执行和查询命令。下面表格外的按钮通过 `ref` 执行内置命令，按钮的状态来自 `commands.pressed`。

<DocDemo src="sheet/commands" column />

```ts
const { commands } = useSheet()

commands.run('bold', true) // 加粗选区
commands.can('merge') // 现在能否合并
commands.pressed('filter') // 是否有筛选
commands.get('today.insert') // { name, label, icon, shortcut, toggle }
```

- `run` 在命令不能执行或没做任何事时返回 `false`；异步命令开始执行就返回 `true`。
- 命令名不存在时抛出错误，可以先用 `has` 判断。

## 定义命令

扩展的 `commands` 按名字登记命令，再在 `keymap`、`contextMenu`、`toolbar` 里引用：

```ts
import { CalendarIcon } from '@dou-ui/icons'
import { defineSheetCommand, defineSheetExtension } from '@dou-ui/sheet'

const today = defineSheetExtension({
  name: 'today',
  commands: {
    'today.insert': defineSheetCommand({
      label: '填入今天',
      icon: CalendarIcon,
      shortcut: 'mod+;',
      enabled: ({ readonly }) => !readonly.value,
      run: ({ active, transact }) => {
        transact((tr) => tr.updateCell(active.value, { value: '2026-11-01' }))
      },
    }),
  },
  keymap: () => ({ 'mod+;': 'today.insert' }),
  contextMenu: () => [{ key: 'today', command: 'today.insert' }],
  toolbar: () => [{ key: 'today', command: 'today.insert' }],
})
```

完整的例子见[扩展](./extensions#基础用法)。

- 命令名建议以扩展名开头，比如 `today.insert`。两个扩展登记了同名命令时抛出错误。
- `run` 的参数要写成可选的，比如 `run: (ctx, rate?: number) => …`。工具栏、菜单和快捷键调用时没有参数。
- 异步命令（返回 `Promise`）的错误要在命令里自己处理，表格不会等它结束，也不会捕获它的错误。
- 只读时表格不会替扩展的命令禁用。修改表格的命令要自己在 `enabled` 里判断 `readonly`，像上面那样；打印、导出这类不改表格的命令在只读时照常可用。

## 内置命令

表格自带的一部分功能登记成了命令，它们的工具栏按钮和快捷键都通过命令执行。用 `override` 替换后，快捷键和工具栏按钮都会运行新的实现。

| 命令                                            | 作用                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------- |
| `undo`、`redo`                                  | 撤销、重做                                                          |
| `cut`、`copy`、`paste`                          | 剪切、复制、粘贴                                                    |
| `bold`、`italic`、`underline`、`strike`、`wrap` | 切换样式；传 `true` 或 `false` 时直接设为开或关                     |
| `align.left`、`align.center`、`align.right`     | 水平对齐                                                            |
| `valign.top`、`valign.middle`、`valign.bottom`  | 垂直对齐                                                            |
| `decimals.more`、`decimals.fewer`               | 增加、减少小数位数                                                  |
| `merge`                                         | 合并选区，选区碰到合并单元格时取消合并                              |
| `sort.asc`、`sort.desc`                         | 按当前列升序、降序排序                                              |
| `filter`                                        | 加上或去掉筛选                                                      |
| `clear`                                         | 清除格式，值不变；不是右键菜单里的“清除内容”                        |
| `print`                                         | 打印当前工作表                                                      |
| `find`、`replace`                               | 打开查找、替换面板；可以传查询，见[查找和替换](./filter#查找和替换) |
| `find.next`、`find.previous`                    | 下一个、上一个查找结果                                              |
| `link`                                          | 插入或编辑当前单元格的链接                                          |
| `link.open`、`link.remove`                      | 打开当前单元格的链接；删除选区里的链接                              |
| `lock`                                          | 锁定或取消锁定选区，工作表受保护时不可用                            |
| `protect.sheet`、`protect.workbook`             | 保护或取消保护当前工作表、工作簿结构                                |

数字格式、颜色、冻结、条件格式和数据验证这些工具不是命令。

替换内置命令后，只有一个按钮的工具（`undo`、`redo`、`bold`、`italic`、`underline`、`strike`、`wrap`、`merge`、`link`、`filter`、`clear`）按新命令的文字、图标和 `pressed` 显示；对齐、小数位和排序这类组合工具保持原来的外观，只用新命令的 `run`、`enabled` 和 `pressed`。例子见[保护 · 不允许取消保护](./protect#不允许取消保护)。

## 快捷键

扩展的 `keymap` 写法和 `useHotkey` 一样，值是处理函数或命令名。

- 扩展的快捷键先于表格自己的按键处理，多个扩展按 `priority` 从高到低依次询问。
- 处理函数（或命令）没有返回 `false` 时，按键就算处理过了，表格阻止它的默认行为；返回 `false` 或命令不能执行时，交给下一个。
- 只在表格有焦点、没有在编辑单元格时触发。
- `keymap` 里写了不存在的命令名时，表格挂载时抛出错误。

## 工具栏按钮

扩展的 `toolbar` 返回 `DouSheetToolbar` 上的按钮。

- 没有指定 `tools` 时，扩展的按钮作为最后一组排在内置按钮后面；指定了 `tools` 时，写按钮的 `key` 决定位置。
- `tools` 里也可以直接写任何命令名，比如 `'print'`，显示成一个按钮。
- 按钮的 `key` 和内置工具同名，或者两个按钮的 `key` 相同时，抛出错误。
- 按钮既没有 `label` 也没有 `command` 时显示 `key`；没有 `run`、`command` 和 `children` 时点击不做任何事。开发环境下这两种情况都会在控制台警告。

## 右键菜单项

扩展的 `contextMenu` 返回的菜单项排在内置项前面。菜单项可以只写 `{ key, command }`，`label`、`icon`、`shortcut`、`disabled` 和 `run` 不写时从命令读取。`menu` 属性收到的菜单项已经补全，`label` 一定有值。

## API

### SheetCommand

| 名称       | 说明                                                                                 | 类型                                                 |
| ---------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| `label`    | 名字，显示在菜单和提示里；写成函数时跟着语言变化                                     | `string \| ((messages) => string)`                   |
| `icon`     | 图标                                                                                 | `Component`                                          |
| `shortcut` | 显示在旁边的快捷键，只是提示，按键要在 `keymap` 里绑定                               | `string`                                             |
| `run`      | 执行命令，`arg` 是 `commands.run(name, arg)` 传入的参数；返回 `false` 表示没做任何事 | `(ctx, arg?) => boolean \| void \| Promise<unknown>` |
| `enabled`  | 现在能不能执行，不能时按钮和菜单项变灰                                               | `(ctx) => boolean`                                   |
| `pressed`  | 开关类命令现在是否打开；有它时工具栏按钮是可以按下的开关                             | `(ctx) => boolean`                                   |
| `override` | 替换同名的内置命令；没有它时和内置命令重名会抛出错误                                 | `boolean`                                            |

### SheetCommands

| 名称              | 说明                                           |
| ----------------- | ---------------------------------------------- |
| `run(name, arg?)` | 执行命令，返回是否执行                         |
| `can(name)`       | 命令是否存在并且现在能执行                     |
| `pressed(name)`   | 开关类命令是否打开                             |
| `get(name)`       | 命令的文字、图标和快捷键；没有时为 `undefined` |
| `has(name)`       | 是否有这个命令                                 |
| `names()`         | 所有命令的名字，包括内置的和扩展加的           |

### SheetToolbarItem

| 名称       | 说明                                                               | 类型              |
| ---------- | ------------------------------------------------------------------ | ----------------- |
| `key`      | 在工具栏里唯一，`tools` 用它指定位置                               | `string`          |
| `command`  | 运行的命令；文字、图标、快捷键提示和状态都从命令来，下面写了的优先 | `string`          |
| `label`    | 读屏和提示里的名字；没有图标时直接显示文字                         | `string`          |
| `icon`     | 图标                                                               | `Component`       |
| `run`      | 点击时执行，没有 `command` 时需要                                  | `() => void`      |
| `disabled` | 是否不可用；不写时看命令的 `enabled`                               | `boolean`         |
| `pressed`  | 开关按钮是否按下；命令有 `pressed` 时自动跟随                      | `boolean`         |
| `shortcut` | 提示里显示的快捷键                                                 | `string`          |
| `children` | 有它时按钮打开一个菜单，菜单项和右键菜单的一样                     | `SheetMenuItem[]` |
