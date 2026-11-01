# 扩展

扩展把单元格类型、命令、快捷键、右键菜单项、工具栏按钮、导入导出方式、浮在表格上的组件和修改钩子打包在一起，用 `extensions` 传给表格，适合把一组相关的定制放在一处，在多个表格之间复用。

下面的例子用了两个扩展：一个加了“进度”单元格类型，画成进度条，输入 `60` 或 `60%` 都记为 0.6，右键菜单里多一项“标为完成”，作用于选中的所有进度单元格；另一个定义了“填入今天”命令，工具栏按钮、右键菜单（手机上长按）和 `Ctrl` / `⌘` + `;` 都运行它。

<DocDemo src="sheet/extension" column />

## 定义扩展

```ts
import { defineSheetCellType, defineSheetExtension } from '@dou-ui/sheet'

const progress = defineSheetExtension({
  name: 'progress',
  cellTypes: [
    defineSheetCellType({
      name: 'progress',
      parse: (text) => ({ value: Number.parseFloat(text) / 100 }),
      format: (value) => `${Math.round(Number(value) * 100)}%`,
      render: ProgressBar,
    }),
  ],
})

const extensions = [progress]
```

```vue-html
<DouSheet v-model="book" :extensions="extensions" />
```

`defineSheetExtension` 和 `defineSheetCellType` 只用来提供类型，返回传入的对象本身。扩展的名字不能重复，重复时会抛出错误。扩展列表在 `<script setup>` 里创建一次即可；模板里每次渲染写出的新数组，只要里面的扩展相同，就不会重新初始化。

编辑、选择、剪贴板、填充、合并和内置的单元格类型都是组件自带的，不是扩展。`extensions` 只在这些功能之上追加。

## 扩展的字段

| 名称          | 说明                                                                                                                                         | 类型                                                              |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `name`        | 扩展的名字                                                                                                                                   | `string`                                                          |
| `priority`    | 优先级，越大越先处理按键和钩子，默认 `100`                                                                                                   | `number`                                                          |
| `cellTypes`   | 单元格类型，见下文；和内置类型同名时替换内置的，多个扩展同名时用优先级高的                                                                   | `SheetCellType[]`                                                 |
| `functions`   | 公式里可以调用的函数，见[自定义函数](./formulas#自定义函数)；和内置函数同名时替换内置的                                                      | `SheetFunction[]`                                                 |
| `commands`    | 命令，按名字登记，工具栏按钮、菜单项和快捷键都可以引用，见下文                                                                               | `Record<string, SheetCommand>`                                    |
| `keymap`      | 表格有焦点、没有在编辑单元格时的快捷键，写法和 `useHotkey` 一样；值是处理函数或命令名。处理函数（或命令）返回 `false` 表示没处理，交给下一个 | `(ctx) => Record<string, ((event) => boolean \| void) \| string>` |
| `contextMenu` | 右键菜单的项，排在内置项前面；`menu` 属性收到的菜单项里也包括它们                                                                            | `(ctx, menu: SheetMenuContext) => SheetMenuItem[]`                |
| `toolbar`     | `DouSheetToolbar` 上的按钮，默认排在内置按钮后面，见下文                                                                                     | `(ctx) => SheetToolbarItem[]`                                     |
| `exporters`   | 导出方式，出现在工具栏的导出菜单里，`exportFile` 可以按名字使用；和内置的 `csv`、`png`、`svg` 同名时替换内置的，见下文                       | `SheetExporter[]`                                                 |
| `importers`   | 导入方式，用于工具栏的导入按钮、`importFile` 和拖入的文件；比内置的 CSV 先询问                                                               | `SheetImporter[]`                                                 |
| `overlays`    | 浮在表格上方的组件，不随表格滚动，可以用 `cellRect` 对准单元格                                                                               | `Component[]`                                                     |
| `history`     | 替换表格自带的撤销记录，多个扩展都有时用优先级最高的，见下文                                                                                 | `(ctx) => SheetHistoryHandler`                                    |
| `setup`       | 表格挂载后调用，可以返回一个函数，在卸载时调用                                                                                               | `(ctx) => void \| (() => void)`                                   |
| `transaction` | 表格里的每次修改和 `transact` 生效前按优先级调用，可以继续往里加步骤；撤销时加上的步骤一起撤销                                               | `(tr, ctx) => void`                                               |

`ctx` 和组件里 `useSheet()` 拿到的是同一个对象。

`history` 返回撤销和重做的实现，有它时表格不再记录自己的撤销步骤，撤销按钮、`Ctrl+Z` 和 `undo()` 都交给它。[协同编辑](./collaboration)用它只撤销自己的修改：

```ts
interface SheetHistoryHandler {
  /** 没有可以撤销的修改时返回 false */
  undo: () => boolean
  redo: () => boolean
  canUndo: () => boolean
  canRedo: () => boolean
}
```

## 单元格类型

单元格的 `type` 写类型的名字，或工作簿 `types` 里的名字（见[单元格类型](./#单元格类型)）。一个类型可以提供下面这些字段，都可以不写：

| 名称     | 说明                                                                                                                                                        | 类型                                            |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `name`   | 类型的名字                                                                                                                                                  | `string`                                        |
| `parse`  | 把输入的文字读成值，返回 `{ value, format? }`；返回 `undefined` 时按普通单元格读                                                                            | `(text, setup) => SheetInput \| undefined`      |
| `format` | 值显示成的文字；默认按单元格的 `format` 显示。复制成纯文本和读屏软件也用这段文字                                                                            | `(value, setup) => string \| undefined`         |
| `edit`   | 编辑框打开时的文字，要能被 `parse` 读回同样的值；默认用 `format` 的结果，没有 `format` 时用值本身                                                           | `(value, setup) => string \| undefined`         |
| `valid`  | 值是否符合这个类型：返回 `true`，或者返回 `false`、一句原因。不符合的单元格左上角有红色小三角，原因在悬停时显示，读屏也会读出。空单元格总是符合             | `(value, setup, messages) => boolean \| string` |
| `render` | 代替文字画在单元格里的组件。每个看得见的单元格都会画一个，要尽量轻；里面带 `data-sheet-toggle` 的元素被点击时切换值                                         | `Component`                                     |
| `panel`  | 编辑时显示在单元格下方的面板，比如日历；发出 `pick` 事件写入值并结束编辑                                                                                    | `Component`                                     |
| `toggle` | 有它时，空格、`F2`、双击和点 `data-sheet-toggle` 元素会切换值，不打开编辑框。空格切换选区里所有同类单元格：值相同时一起切换，不同时都变成空单元格切换后的值 | `(value, setup) => SheetValue`                  |
| `align`  | 单元格样式没有指定对齐时的对齐方式                                                                                                                          | `'left' \| 'center' \| 'right'`                 |
| `plain`  | 写进文件、给其他表格软件打开时用的值，比如评分写成数字；默认是值本身。导出方式通过 `source.plain` 读取                                                      | `(value, setup) => SheetValue`                  |

`setup` 是这个单元格的类型设置：工作簿 `types` 里对应的那一项，例如 `{ type: 'select', options: [...] }`；直接写类型名时是 `{ type: 'progress' }`。

`parse` 返回 `undefined` 时，文字按普通单元格读：数字、日期、`TRUE` 之类照常识别，其余原样存成文字。所以 `format`、`render` 要能处理不是这个类型的值，例如进度单元格里输入了文字，就只显示文字，`valid` 再把它标出来。`valid` 的第三个参数是当前语言的文案，内置类型用它给出“不是日期”“不在选项里”这样的原因；只返回 `false` 时显示通用的“不符合单元格类型”。

`render` 组件收到 `value`、`text`（`format` 之后的文字）、`setup` 和 `readonly`。读屏软件读的是 `text`，有 `toggle` 的类型读“已勾选”或“未勾选”，`render` 里的内容不会被读出，可以加 `aria-hidden`。

`panel` 组件收到 `value`（开始编辑时的值）、`text`（编辑框里现在的文字）、`typed`（开始编辑后是否输入过）和 `setup`。编辑框始终保有焦点，面板想处理按键时，暴露一个 `onKey(event)`，处理了返回 `true`：

```ts
const Panel = defineComponent({
  props: ['value', 'text', 'typed', 'setup'],
  emits: ['pick'],
  setup(props, { emit, expose }) {
    expose({
      onKey: (event: KeyboardEvent) => {
        if (event.key !== 'Enter') return false
        emit('pick', props.text.toUpperCase())
        return true
      },
    })
    return () => h('div', { class: 'my-panel' }, props.text)
  },
})
```

## 命令

命令按名字登记一个操作，带文字、图标和快捷键提示。工具栏按钮、右键菜单项和快捷键可以写命令名来引用它，文字、图标、快捷键提示、能否使用和是否按下都从命令读取：

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

| 名称       | 说明                                                                                                                     | 类型                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| `label`    | 名字，显示在菜单和提示里；写成函数时跟着语言变化                                                                         | `string \| ((messages) => string)`                   |
| `icon`     | 图标                                                                                                                     | `Component`                                          |
| `shortcut` | 显示在旁边的快捷键，只是提示，按键要在 `keymap` 里绑定                                                                   | `string`                                             |
| `run`      | 执行命令，`arg` 是 `commands.run(name, arg)` 传入的参数，工具栏、菜单和快捷键调用时没有参数；返回 `false` 表示没做任何事 | `(ctx, arg?) => boolean \| void \| Promise<unknown>` |
| `enabled`  | 现在能不能执行，不能时按钮和菜单项变灰，默认总是可以                                                                     | `(ctx) => boolean`                                   |
| `pressed`  | 开关类命令现在是否打开，比如当前单元格是否加粗；有它时工具栏按钮是可以按下的开关                                         | `(ctx) => boolean`                                   |
| `override` | 替换同名的内置命令；没有它时和内置命令重名会抛出错误，以免无意中替换                                                     | `boolean`                                            |

命令名建议以扩展名开头，比如 `today.insert`。两个扩展登记了同名命令时会抛出错误。`keymap` 里写了不存在的命令名时，表格挂载时就会抛出错误。

参数要写成可选的，比如 `run: (ctx, rate?: number) => …`，没有传时用默认值。异步命令（返回 `Promise`）的错误要在命令里自己处理，表格不会等它结束，也不会替你捕获。

只读时表格不会替扩展的命令禁用：修改表格的命令要自己在 `enabled` 里判断 `readonly`，像上面那样；打印、导出这类不改表格的命令在只读表格里照常可用。

表格自带的一部分功能登记成了命令（见下表），这些功能的工具栏按钮和快捷键都通过命令执行；数字格式、颜色、冻结、条件格式和数据验证这些工具不是命令。用 `override` 替换后，快捷键和工具栏按钮都会运行新的实现。只有一个按钮的工具（`undo`、`redo`、`bold`、`italic`、`underline`、`strike`、`wrap`、`merge`、`filter`、`clear`）会按新命令的文字、图标和 `pressed` 显示；对齐、垂直对齐、小数位和排序这类组合工具保持原来的外观，只用新命令的 `run`、`enabled` 和 `pressed`：

| 命令                                            | 作用                                                           |
| ----------------------------------------------- | -------------------------------------------------------------- |
| `undo`、`redo`                                  | 撤销、重做                                                     |
| `cut`、`copy`、`paste`                          | 剪切、复制、粘贴                                               |
| `bold`、`italic`、`underline`、`strike`、`wrap` | 切换样式；传 `true` 或 `false` 时直接设为开或关                |
| `align.left`、`align.center`、`align.right`     | 水平对齐                                                       |
| `valign.top`、`valign.middle`、`valign.bottom`  | 垂直对齐                                                       |
| `decimals.more`、`decimals.fewer`               | 增加、减少小数位数                                             |
| `merge`                                         | 合并选区，选区碰到合并单元格时取消合并                         |
| `sort.asc`、`sort.desc`                         | 按当前列升序、降序排序                                         |
| `filter`                                        | 加上或去掉筛选                                                 |
| `clear`                                         | 清除格式（样式和数字格式），值不变；不是右键菜单里的“清除内容” |
| `print`                                         | 打印当前工作表                                                 |

在扩展或组件里用 `useSheet().commands` 执行和查询命令：

```ts
const { commands } = useSheet()

commands.run('bold', true) // 加粗选区
commands.can('merge') // 现在能否合并
commands.pressed('filter') // 是否有筛选
commands.get('today.insert') // { name, label, icon, shortcut, toggle }
```

`run` 在命令不能执行或没做任何事时返回 `false`，异步命令开始执行就返回 `true`。命令名不存在时抛出错误。组件实例上也有同样的 `commands`，表格外的菜单栏可以通过 `ref` 调用。

## 工具栏按钮

扩展的 `toolbar` 返回 `DouSheetToolbar` 上的按钮。没有指定 `tools` 时，它们作为最后一组排在内置按钮后面；指定了 `tools` 时，在里面写按钮的 `key` 决定位置。`tools` 里也可以直接写任何命令名，比如 `'print'`，会显示成一个按钮。按钮的 `key` 和内置工具同名，或者两个按钮的 `key` 相同时，会抛出错误。

| 名称       | 说明                                                                 | 类型              |
| ---------- | -------------------------------------------------------------------- | ----------------- |
| `key`      | 在工具栏里唯一，`tools` 用它指定位置                                 | `string`          |
| `command`  | 运行的命令；文字、图标、快捷键提示和状态都从命令来，下面写了的优先   | `string`          |
| `label`    | 读屏和提示里的名字；没有图标时直接显示文字                           | `string`          |
| `icon`     | 图标                                                                 | `Component`       |
| `run`      | 点击时执行，没有 `command` 时需要                                    | `() => void`      |
| `disabled` | 是否不可用；不写时看命令的 `enabled`。只读表格不会自动禁用扩展的按钮 | `boolean`         |
| `pressed`  | 开关按钮是否按下；命令有 `pressed` 时自动跟随                        | `boolean`         |
| `shortcut` | 提示里显示的快捷键                                                   | `string`          |
| `children` | 有它时按钮打开一个菜单，菜单项和右键菜单的一样，也可以写 `command`   | `SheetMenuItem[]` |

按钮既没有 `label` 也没有 `command` 时显示 `key`，没有 `run`、`command` 和 `children` 时点击不做任何事，开发时两种情况都会在控制台警告一次。

右键菜单项同样可以只写 `{ key, command }`，`label`、`icon`、`shortcut`、`disabled` 和 `run` 不写时从命令来。`menu` 属性收到的菜单项已经补全，`label` 一定有值。

## 导出器与导入器

导出器把工作簿写成一种文件，导入器把一种文件读成工作簿。它们只读写数据，不依赖表格组件，所以也可以在脚本、Worker 或服务端使用（见[不含组件的入口](#不含组件的入口)）。

```ts
import { defineSheetExporter, defineSheetExtension } from '@dou-ui/sheet'

const json = defineSheetExporter({
  name: 'json',
  label: 'JSON (.json)',
  extension: 'json',
  mime: 'application/json',
  scopes: ['workbook', 'sheet'],
  export: (source) => JSON.stringify(source.sheets.map((s) => s.data)),
})

const extensions = [defineSheetExtension({ name: 'json', exporters: [json] })]
```

想让 `exportFile('json', { options })` 检查选项的类型，就把选项补进 `SheetExporterOptions`：

```ts
declare module '@dou-ui/sheet' {
  interface SheetExporterOptions {
    json: { indent?: number }
  }
}
```

| 导出器字段  | 说明                                                                                                                         | 类型                                                              |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `name`      | 名字，`exportFile(name)` 用它；两个扩展不能重名                                                                              | `string`                                                          |
| `label`     | 导出菜单里的名字                                                                                                             | `string \| ((messages) => string)`                                |
| `icon`      | 导出菜单里的图标；不写时按 `extension` 给一个文件图标，见[不含组件的入口](#不含组件的入口)                                   | `Component`                                                       |
| `extension` | 文件扩展名，不带点，下载时用                                                                                                 | `string`                                                          |
| `mime`      | 文件类型，返回字符串时用它包成 `Blob`                                                                                        | `string`                                                          |
| `scopes`    | 能导出什么，第一个是默认的范围；有多种时工具栏的导出菜单让用户选；默认三种都可以                                             | `('workbook' \| 'sheet' \| 'selection')[]`                        |
| `needs`     | `'view'` 表示要按表格画出来的样子导出（列宽、行高、页面主题的颜色），会拿到 `source.view`，只能在表格组件里用；默认 `'data'` | `'data' \| 'view'`                                                |
| `export`    | 写出文件，`options` 是 `exportFile` 传入的 `options`                                                                         | `(source, options?) => Blob \| string \| Promise<Blob \| string>` |

`source` 是导出时的工作簿和读取单元格的方法，单元格都用工作表序号、行、列（从 0 开始）指定：

| 名称                        | 说明                                                                                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `book`                      | 存储的工作簿                                                                                                                              |
| `scope`                     | 这次导出的范围                                                                                                                            |
| `sheets`                    | 要写的工作表，每项是 `{ index, data, bounds }`，`bounds` 是要写的单元格，空表为 `null`                                                    |
| `value(sheet, row, col)`    | 存储的值，公式单元格是公式本身                                                                                                            |
| `result(sheet, row, col)`   | 计算结果，错误是 `SheetError`                                                                                                             |
| `text(sheet, row, col)`     | 单元格显示的文字，和表格里一致                                                                                                            |
| `plain(sheet, row, col)`    | 写给其他表格软件的值：单元格类型的 `plain`，或计算结果（错误写成 `#DIV/0!` 这样的代码）                                                   |
| `style(sheet, row, col)`    | 单元格的样子：命名样式，叠加条件格式给的样式；`tone`、`fill` 已换成浅色主题下的具体颜色，放在 `color`、`background` 里。普通单元格为 `{}` |
| `format(sheet, row, col)`   | 数字格式                                                                                                                                  |
| `cellType(sheet, row, col)` | 单元格类型，普通单元格为 `undefined`                                                                                                      |
| `locale`、`messages`        | 语言和文案                                                                                                                                |
| `colWidth`、`rowHeight`     | 表格默认的列宽、行高（px），没有单独设过大小的列和行用它们；在表格里导出时取自 `col-width`、`row-height`                                  |
| `signal`                    | `exportFile` 传入的 `signal`，取消时中止                                                                                                  |
| `view`                      | 只有 `needs: 'view'` 的导出器在表格里导出时才有：`view.drawing(options?)` 返回导出的单元格按表格画出来的布局和颜色                        |

要把样式写成文件自己的格式（而不是叠加了条件格式的 `style`）时，可以读 `book.styles` 里的命名样式，用 `plainStyle(style)` 把 `tone`、`fill` 换成浅色主题下的 `color`、`background`；`lightThemeColor(css)` 把主题变量和 `color-mix(in oklab, …)` 算成 `#rrggbb`，其他颜色原样返回。[`@dou-ui/sheet-xlsx`](./xlsx) 用它们把条件格式写成文件里的规则。

```ts
import { lightThemeColor, plainStyle } from '@dou-ui/sheet'

plainStyle({ bold: true, fill: 'primary' }) // { bold: true, background: '#e6eaf7' }
lightThemeColor('var(--dou-color-danger)') // '#b2423e'
```

导入器读文件，返回 `{ book, warnings? }`。`warnings` 列出没能带过来的内容，会在 `import` 事件里交给使用者：

```ts
import { defineSheetImporter } from '@dou-ui/sheet'

const json = defineSheetImporter({
  name: 'json',
  label: 'JSON',
  accept: ['.json', 'application/json'],
  async import(file) {
    return { book: { sheets: JSON.parse(await file.text()) } }
  },
})
```

| 导入器字段 | 说明                                                                                                                  | 类型                                                                           |
| ---------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `name`     | 名字，`importFile(file, { importer })` 用它                                                                           | `string`                                                                       |
| `label`    | 这种文件叫什么，比如“CSV 文件”：文件没有名字时用在表格的提示里，也在 `useSheet().importers` 里交给你自己做的导入菜单  | `string \| ((messages) => string)`                                             |
| `accept`   | 能读的文件，写法和文件选择框的 `accept` 一样：扩展名如 `.csv`，或类型如 `text/csv`                                    | `string[]`                                                                     |
| `sniff`    | 按文件开头的字节判断能不能读，用于文件名看不出来的情况                                                                | `(head: Uint8Array) => boolean`                                                |
| `import`   | 读文件；`context` 里有 `messages`、`locale` 和 `signal`（导入被取消或表格卸载时中止）；出错时抛出错误，表格会提示原因 | `(file, context, options?) => SheetImportResult \| Promise<SheetImportResult>` |

不经过组件时，`exportWorkbook(book, exporter, options?)` 写出 `Blob`，会计算公式，`needs: 'view'` 的导出器在这里会报错；`options` 里的 `extensions` 提供工作簿用到的单元格类型和函数，`scope`、`sheet`（序号、`id` 或名字，默认第一张）、`range`、`signal` 和组件的 `exportFile` 一样，`colWidth`、`rowHeight` 是工作簿配合的列宽行高（和表格的 `col-width`、`row-height` 一样，默认 96、28），`options` 交给导出器。`readWorkbook(file, importer, options?)` 只读出 `{ book, warnings }`，不写进任何表格。内置的 CSV 导出器和导入器是 `csvExporter`、`csvImporter`，也可以这样用：

```ts
import { csvExporter, exportWorkbook } from '@dou-ui/sheet/core'

const blob = await exportWorkbook(book, csvExporter, { scope: 'sheet', sheet: 1 })
```

## 不含组件的入口

`@dou-ui/sheet` 带着表格组件，引入它就会加载 Vue 和组件。在 Worker 或服务端只读写数据时，从 `@dou-ui/sheet/core` 引入，它不加载 Vue，也不加载任何组件：

| 内容         | 导出                                                                                                                             |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| 文件读写     | `exportWorkbook`、`readWorkbook`、`createFileSource`、`csvExporter`、`csvImporter`、`defineSheetExporter`、`defineSheetImporter` |
| 单元格与区域 | `parseCell`、`parseRange`、`formatCell`、`formatRange`、`columnName`、`quoteSheet`、`renameReferencesAll` 等                     |
| 值与样式     | `cellOf`、`valueOf`、`formatValue`、`parseInput`、`meetsRule`、`plainStyle`、`lightThemeColor` 等                                |
| 修改         | `SheetTransaction`、`applySheetSteps`、`compactSheetSteps`、`sheetKey`                                                           |
| 扩展         | `defineSheetExtension`：把工作簿用到的单元格类型和函数交给 `exportWorkbook`                                                      |
| 单元格类型   | `defineSheetCellType`、`optionOf`                                                                                                |
| 文案         | `sheetMessagesFor`、`sheetLocales`                                                                                               |

这些在 `@dou-ui/sheet` 里也都有，在页面里用哪个都一样。公式引擎在 [`@dou-ui/sheet/formula`](./formulas#单独使用计算引擎)，同样不含组件。

```ts
// export.worker.ts
import {
  csvExporter,
  defineSheetCellType,
  defineSheetExtension,
  exportWorkbook,
  type SheetWorkbook,
} from '@dou-ui/sheet/core'

// 工作簿用到的单元格类型，和页面里交给表格的一样
const stars = defineSheetCellType({
  name: 'stars',
  format: (value) => '★'.repeat(Number(value)),
  plain: (value) => Number(value),
})
const extensions = [defineSheetExtension({ name: 'stars', cellTypes: [stars] })]

self.onmessage = async (event: MessageEvent<SheetWorkbook>) => {
  self.postMessage(await exportWorkbook(event.data, csvExporter, { extensions }))
}
```

公式函数用 `@dou-ui/sheet/formula` 的 `defineSheetFunction` 定义，同样放进扩展的 `functions`。

类型声明里，扩展和单元格类型的部分字段（如浮层、单元格的组件）用到了 Vue 和 DOM 的类型，所以 Worker 的 `tsconfig.json` 只写 `"lib": ["WebWorker"]` 时要开启 `skipLibCheck`（Vite 创建的项目默认开启），或者在 `lib` 里加上 `"DOM"`。

导出器不写 `icon` 时，导出菜单按 `extension` 给一个文件图标，比如 `.xlsx` 是表格文件的图标，`.json` 是 JSON 文件的图标，其他扩展名是普通文件图标。图标是 Vue 组件，所以 Worker 里也要用的导出器就不写 `icon`，Worker 引入它时不会加载图标和 Vue。

## 快捷键

扩展的快捷键先于表格自己的按键处理，多个扩展按 `priority` 从高到低依次询问。值可以是处理函数，也可以是命令名。处理函数（或命令）没有返回 `false` 时，按键就算处理过了，表格会阻止它的默认行为；命令不能执行时按键交给下一个。正在编辑单元格时不会触发。

## useSheet

在扩展的钩子、浮层组件、单元格类型的组件和表格的 `header`、`footer` 插槽里，`useSheet()` 返回当前表格的状态和操作：

| 名称                                                    | 说明                                                                                                                                                                                                                                            |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `doc`、`sheet`、`sheetIndex`                            | 工作簿、当前显示的工作表和它的序号                                                                                                                                                                                                              |
| `selection`、`active`                                   | 选区和键盘所在的单元格                                                                                                                                                                                                                          |
| `readonly`、`messages`                                  | 只读状态、当前语言的文案                                                                                                                                                                                                                        |
| `focused`                                               | 表格或单元格编辑框是否有键盘焦点                                                                                                                                                                                                                |
| `value(point)`、`result(point)`                         | 当前工作表里一个单元格的值（公式单元格是公式本身），和它的计算结果                                                                                                                                                                              |
| `forEachSelected(callback)`                             | 依次处理选中的每个单元格，合并单元格只算一次（左上角）                                                                                                                                                                                          |
| `cellType(point)`                                       | 单元格的类型 `{ name, definition, setup }`，`definition` 是类型本身；普通单元格为 `undefined`                                                                                                                                                   |
| `cellRect(point)`                                       | 单元格（或它所在的合并单元格）现在画在哪，看不见时为 `null`                                                                                                                                                                                     |
| `rangeRect(bounds)`                                     | 区域在视图里露出的部分画在哪，`cut` 标出被视图或冻结窗格挡住的边；完全看不见时为 `null`                                                                                                                                                         |
| `transact`、`undo`、`redo`、`canUndo`、`canRedo`        | 修改与撤销，同组件实例                                                                                                                                                                                                                          |
| `select`、`scrollTo`、`edit`、`focus`                   | 选择、滚动、编辑和聚焦，同组件实例                                                                                                                                                                                                              |
| `showSheet`、`toCSV`、`exportSVG`、`exportPNG`、`print` | 切换工作表、导出 CSV 和图片、打印，同组件实例                                                                                                                                                                                                   |
| `styleAt(point)`、`formatAt(point)`                     | 单元格的样式（没有时为 `{}`）和数字格式，合并单元格取左上角                                                                                                                                                                                     |
| `styleSelection(patch)`                                 | 修改选区的样式，规则同 `tr.styleCells`，`null` 去掉样式；返回是否有改动                                                                                                                                                                         |
| `formatSelection(format)`                               | 设置选区的数字格式，也可以传函数逐格计算，同 `tr.formatCells`                                                                                                                                                                                   |
| `clearFormatting()`                                     | 去掉选区的样式和数字格式                                                                                                                                                                                                                        |
| `merged`、`canMerge`、`merge()`、`unmerge()`            | 选区是否碰到合并单元格、能否合并；合并（会提示清空了几格）、取消合并                                                                                                                                                                            |
| `announce(text)`                                        | 让读屏软件播报一段文字                                                                                                                                                                                                                          |
| `commands`                                              | 执行和查询命令，见[命令](#命令)                                                                                                                                                                                                                 |
| `exportFile`、`saveFile`、`importFile`                  | 导出、导出并下载、导入文件，同组件实例，见[导入与导出](./#导入与导出)                                                                                                                                                                           |
| `exporters`、`importers`、`importAccept`                | 所有导出器、导入器，以及文件选择框能用的 `accept`；自己做导入导出按钮时用。每项是 `{ name, label, icon, extension, mime, scopes }`（导入器是 `{ name, label, accept }`），`label` 已按当前语言给出，`icon` 在导出器没写时是按扩展名给的文件图标 |
| `toolbarItems`                                          | 扩展加到工具栏上的按钮，按优先级排列；自己做工具栏时用                                                                                                                                                                                          |
| `editor`                                                | 正在编辑的单元格，供表格外的输入框使用，见下文                                                                                                                                                                                                  |

`editor` 让表格外的输入框和单元格一起编辑，`DouSheetFormulaBar` 就是用它做的：

| 名称                        | 说明                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| `cell`、`text`、`caret`     | 正在编辑的单元格（没有时为 `null`）、编辑中的文字和光标位置                              |
| `textAt(point)`             | 单元格编辑时显示的文字：公式，或按输入方式写出的值                                       |
| `input(text, caret?)`       | 改写编辑中的文字；还没在编辑时，开始编辑当前单元格                                       |
| `moveCaret(caret)`          | 输入框的光标被按键或点击移动后告诉表格                                                   |
| `key(event)`                | 按单元格编辑时的规则处理按键（补全、插入引用、`Enter`、`Tab`、`Esc`），处理了返回 `true` |
| `commit(move?)`、`cancel()` | 保存或放弃编辑，之后键盘回到表格                                                         |
| `attach(el, options?)`      | 登记输入框：焦点移到它上面时编辑不结束，函数列表显示在它下方；返回取消登记的函数         |
| `helpId`                    | 函数列表和参数提示的 id，用于 `aria-controls`                                            |
| `functions`                 | 公式可以调用的函数，包括内置的和扩展添加的                                               |

`attach` 的 `options`：`managed: true` 表示输入框自己按 `text` 和 `caret` 显示文字和光标，表格不改写它的值，适合文字不在这个元素里的输入框（例如代码编辑器）；`anchor` 是函数列表摆放在其下方的元素，默认是输入框本身。`DouSheetCodeFormulaBar` 就是这样接入的。

`cellRect` 和 `rangeRect` 的坐标从表格左上角算起，包括列标和行号，已经减去滚动的距离，可以直接给浮层组件用 `position: absolute` 摆放。
