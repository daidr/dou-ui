# 更新日志

`dou-ui`、`@dou-ui/theme`、`@dou-ui/icons`、`@dou-ui/editor`、`@dou-ui/sheet`、`@dou-ui/resolver` 与 `@dou-ui/nuxt` 使用同一个版本号，一起发布。
版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)；`1.0.0` 之前，次版本号（`0.x.0`）的变化可能包含不兼容的改动，会在这里单独标出。

新的改动先记在「未发布」下，发布时由 `bun run release <版本号>` 改成对应版本。

## 未发布

首个版本。

### 组件

- **基础**：Button、Icon、Text、Ellipsis、Highlight、Link、Typography、CopyButton、Toggle / ToggleGroup、CodeBlock、RelativeTime
- **布局**：Divider、Space、Grid、Masonry、Splitter、Layout、Scrollbar、Affix、Toolbar
- **表单**：Form / FormItem、Input、Textarea、Editable、InputNumber、InputTag、InputOTP、Checkbox、Radio、Switch、Slider、Rate、Select、Listbox、Autocomplete、Cascader、TreeSelect、DatePicker、TimePicker、InputDate、InputTime、ColorPicker、ColorPanel、Transfer、SegmentedControl、CheckTag、Upload、ImageCropper、FieldGroup
- **浮层**：Tooltip、Popover、Dropdown（菜单项支持勾选、单选与快捷键显示）、DropdownButton、ContextMenu、Dialog、Drawer（可滑动关闭，支持停靠点）、Popconfirm、Tour
- **反馈**：Alert、Banner、Toast、Spinner、Loading、Progress、ProgressGroup、Skeleton、Result
- **数据展示**：Card、Avatar、User、Badge、Tag、Kbd、Empty、Statistic、Countdown、CalendarHeatmap、Sparkline、Image、Carousel、Marquee、QRCode、Watermark、Descriptions、Collapse、Timeline、NodeGraph、CalendarView、Table、Tree、VirtualList、InfiniteScroll、Sortable
- **导航**：Menu、Menubar、Tabs、Steps、Anchor、Breadcrumb、PageHeader、Pagination、Command、BackTop
- **AI 对话**：ChatMessage、ChatList、ChatInput、StreamText、ChatSteps、ChatPlan、ChatReasoning、ChatToolCall、ChatSources、ChatCitation、ChatArtifact、ChatConfirm、ChatSuggestions、ChatAttachments、ChatContextMeter、Shimmer、ChatBubble
- **配置**：ConfigProvider（含组件默认属性与浮层渲染位置）、ColorMode；内置 `zhCN`、`zhTW` 与 `en` 语言包，语言包的 `region` 决定每周第一天、日期格式与数字分隔符
- **表单校验**：规则与整表 `schema` 可以直接使用 Standard Schema
- **组合式函数**：`useFloating`、`useLayer`、`useFocusTrap`、`useScrollLock` 等，可用于编写自己的浮层；`useHotkey` 绑定快捷键，`mod` 按平台取 ⌘ 或 Ctrl，支持按键序列；`useBreakpoints` 读取当前断点，`useClipboard` 复制文本，`useRovingFocus` 让一组控件共用一个 `Tab` 位置并用方向键移动焦点，`useNow` 提供定时更新的当前时间，`useElementSize` / `useResizeObserver` 读取元素尺寸，`useIntersection` 判断元素是否可见

### 主题

- 设计 Token 由 TypeScript 定义并生成 CSS 变量，内置亮色与暗色主题，可用 `defineTheme` 与 `themeToCss` 定制，`createTheme` 从品牌色生成亮暗两套主题
- 全局统一的断点（`sm` 640px、`md` 768px、`lg` 1024px、`xl` 1280px），从 `@dou-ui/theme` 导出为 `breakpoints`
- 所有样式位于 `dou.tokens`、`dou.base`、`dou.components` 三个级联层中，页面上不在级联层里的样式总能覆盖
- 语气色提供 `DEFAULT`、`on`、`text` 三个角色，文字对比度按 WCAG AA 取值
- 统一的动效 Token（时长、进退场曲线、位移、循环周期），`dou-fade`、`dou-zoom`、`dou-slide-*` 过渡预设，`DouCollapseTransition`；`ConfigProvider` 的 `motion` 可减少或关闭动画，`useReducedMotion` 供脚本动画使用

### 图标与按需引入

- `@dou-ui/icons`：配套的线性图标，可以单独使用
- `@dou-ui/editor`：块编辑器，文档由可以转换、拖动、嵌套的块组成，支持斜杠菜单、格式工具栏与 Markdown 快捷输入
- `@dou-ui/editor/collaboration`：基于 Yjs 的协同编辑扩展，显示其他人的光标与选区，撤销只针对自己的修改
- `@dou-ui/editor` 的 `image` 扩展：图片块，支持上传、粘贴、拖入与链接嵌入，可以调整宽度并填写说明文字
- `@dou-ui/editor` 的代码块支持语法高亮（与 CodeBlock 使用同一个高亮函数）、选择语言和复制代码
- `@dou-ui/editor` 新增折叠块与提示块
- `@dou-ui/editor` 的 `mention` 扩展：输入 `@` 搜索并提及某人，搜索可以是异步的
- `@dou-ui/editor` 新增表格：行列菜单、列宽、对齐、表头行与表头列、合并单元格，可以导入导出 HTML 与 Markdown
- Dropdown 无论以哪种方式打开，点击菜单以外的地方都会关闭（之前 `trigger="manual"` 的菜单不会）
- `@dou-ui/editor` 的表格可以拖动把手移动整行整列；手机上把手与按钮更大，不提供拖动调整列宽
- 新增 CommentThread 评论讨论：回复、编辑、删除、标记已解决，每次修改以 `CommentAction` 给出，`applyCommentAction` 可在别处重放
- `@dou-ui/editor` 支持评论：选中文字发起讨论，被评论的文字随文档保存并高亮，讨论放在 `v-model:comments`，只读时也能评论；协同扩展的 `comments` 选项同步讨论
- `@dou-ui/sheet` 支持评论：单元格的 `comment` 指向讨论，右键菜单或 `Ctrl/⌘+Alt+M` 发起，讨论跟着单元格移动，复制不带走、剪切带走；只读时也能评论；协同扩展的 `comments` 选项同步讨论
- 历史版本：`@dou-ui/editor` 与 `@dou-ui/sheet` 新增 `compare` 对比旧版本（只读，标出新增、删除和修改）、`nextChange` / `previousChange` 跳转、`restore` 恢复（一步撤销，协同时只写入有差异的部分）；`diffBlocks`、`diffText`、`diffWorkbooks`、`restoreWorkbook`，编辑器协同新增 `readMap`
- `@dou-ui/editor/collaboration` 支持表格：行、列、格子与合并单元格分开同步，移动行列和编辑格子不会互相覆盖，其他人的光标也会显示在格子里
- `@dou-ui/editor` 支持导入导出 HTML 与 Markdown（`blocksToHTML`、`htmlToBlocks`，以及 `@dou-ui/editor/markdown`），写法由各扩展声明
- `@dou-ui/sheet`：电子表格，横纵虚拟滚动、冻结行列、多区域选择、直接输入与输入法、数字与日期格式、命名样式、事务与撤销重做；复制粘贴（与其他表格软件互通）、填充柄、行列宽高拖动与自适应、插入删除隐藏移动行列、右键菜单（可自定义）；插入、删除、移动行列与剪切粘贴时公式引用随之改写；`paste` 事件可修改或取消粘贴，`meta.action` 标明每次修改的来源；合并单元格（行列操作时随之移动）；单元格类型 `date`（日历）、`select`（选项列表，选项可带语气色）、`checkbox`，工作簿 `types` 命名类型设置；`defineSheetExtension` 扩展（单元格类型、快捷键、右键菜单、浮层、修改钩子）与 `useSheet()`；多工作表：`DouSheetTabs` 标签栏（新建、重命名、复制、删除、拖动排序，均可撤销），`header` / `footer` 插槽，重命名和删除工作表时公式引用随之改写，每个工作表记住各自的选区和滚动位置；CSV 读写（`readCSV`、`sheetToCSV`、组件实例的 `toCSV`，自动识别分隔符，前导零和长数字保持文字）；`DouSheetToolbar` 格式工具栏（数字格式与小数位、粗斜体、下划线、删除线、文字与填充颜色、对齐、换行、合并、冻结、清除格式，可选按钮与插槽），`tr.styleCells` / `tr.formatCells` 修改区域样式与格式（相同外观共用一个样式），`Ctrl` + `B` / `I` / `U` 快捷键；大事务（如一次改动 20 万个单元格）不再变慢；公式：自研解析与按需计算，修改后只重新计算受影响的公式（长依赖链不爆栈），64 个常用函数（数学、逻辑、文字、日期、条件统计、查找），错误值与循环引用 `#CYCLE!`，`defineSheetFunction` 与扩展的 `functions` 自定义函数，复制、CSV 与读屏使用计算结果，`@dou-ui/sheet/formula` 单独提供计算引擎 `SheetFormulaEngine`
- `@dou-ui/pivot`：数据透视表，按行列字段分组汇总明细记录；树形行头与多级列表头、各级小计与总计（总计行固定在底部）、展开折叠（`v-model:collapsed`）、按组名或按某一列的数值排序、筛选、求和 / 计数 / 平均 / 最值 / 去重计数 / 中位数与 `defineAggregator` 自定义汇总；行列双向虚拟滚动，10 万条记录的分组汇总在几十毫秒内完成，调整排序和展开折叠不重新汇总；汇总内核 `@dou-ui/pivot/engine` 可脱离组件使用
- `@dou-ui/dashboard`：网格布局 `DouGridLayout`，拖动格子换位置、拖动边角改大小，其他格子自动让开（往上靠或自由摆放，拖到相邻格子上交换位置），尺寸限制与锁定项；`v-model` 只在一次拖动结束时更新；手机上长按后拖动、拖到边缘自动滚动、Esc 取消；键盘拿起、移动、缩放并由读屏播报位置；布局计算 `@dou-ui/dashboard/layout` 可脱离组件使用；按网格自身宽度切换断点（默认 12 / 6 / 1 列），较窄断点上拖动过的位置存进 `v-model:layouts`，未保存的由 `deriveLayout` 从最宽布局推出，一列时只能上下排序；`startDrop` 从外部列表拖入新格子；`handle` 配合 `DouGridLayoutHandle` 只从把手拖动；`data-dou-nodrag` 标记不触发拖动的区域（`@dou-ui/flow` 原来的 `data-flow-nodrag` 同步改名）；仪表盘 `DouDashboard`：JSON 文档按断点记录每个格子的位置，`defineDashboardWidget` 注册格子类型，格子组件用 `useDashboardWidget()` 读取设置、尺寸并显示加载 / 出错 / 空态；编辑时拖动标题栏移动、双击标题改名，菜单里有设置抽屉、全屏查看、复制和删除，Delete、Mod+D、复制粘贴与撤销重做快捷键；`DouDashboardPalette` 拖入或点击添加格子；`dispatch` / `applySteps` 修改步骤，`checkDocument` / `migrateDocument` 检查与迁移；视口外的格子延迟绘制，修改一个格子只重绘这一个；`sources` 数据源按“数据源 + 生效筛选”去重请求、保留结果、取消旧请求、按 `interval` 定时刷新（页面不可见时暂停），换成另一个函数的数据源重新请求，格子用 `data` 读取结果；`v-model:filters` 筛选，格子 `setFilter` 筛选其他格子并在标题栏显示“已按 × 筛选”；筛选栏 `DouDashboardFilterBar`；内置格子 `@dou-ui/dashboard/widgets`（统计数字、文字、表格），图表适配 `@dou-ui/dashboard/chart`（点柱子或扇区筛选其他格子）与透视表适配 `@dou-ui/dashboard/pivot`（点单元格按行列筛选），各带设置面板；`exportPNG` 导出整个仪表盘为图片，`print` 加载完所有格子后打印；协同编辑 `@dou-ui/dashboard/collaboration`（Yjs）：每个格子一份 `Y.Map`，各键、各断点的位置分开保存，同时修改不同格子或同一格子的不同设置都会保留，同时移动时各端按同样的规则排开；自己拖动时暂缓他人的修改；只撤销自己的修改；用对方的颜色框出他人所在的格子并标出名字和正在做的事；`DouDashboard` 的 `collaboration` 属性也可接入其他同步方式，`replaceWidgets` 算出两个仪表盘之间的步骤；区块：运营大盘、服务大盘、可自定义的首页
- `@dou-ui/pivot`：字段面板 `DouPivotFields`，拖动字段到筛选 / 列 / 行 / 值，手机上长按拖动、窄屏收进底部抽屉；字段菜单调整排序、分组、小计、汇总方式与位置；筛选弹层支持搜索、全选与虚拟列表；日期按年 / 季度 / 月 / 周 / 日分组、数字按区间分组（`by`）；表格式布局（`layout="tabular"`）与小计行；拖动调整列宽、双击按内容适应
- `@dou-ui/pivot`：大数据汇总，`data` 可以按列给出（`{ 字段: 数组 }`，数字列用 `Float64Array`）；超过 10 万条记录时在 worker 中汇总（`worker`），列数据只传一次、调整配置只发配置，过期结果直接丢弃，汇总较慢时表格上显示“正在汇总”；`@dou-ui/pivot/worker` 提供 `servePivot` 与 `createPivotWorker`，自定义汇总可以在自己的 worker 中注册；`engine` 属性接入自定义引擎（如服务端汇总），`PivotResult.pack` / `unpack` 负责结果的序列化；100 万条记录在 worker 中汇总约 250 毫秒
- `@dou-ui/pivot`：值的显示方式（`show`：占总计 / 行 / 列 / 上级的百分比、差值、差值百分比、累计、排名，不重新汇总）；计算值（`formula`，如 `销售额 / 杯数`，合计按“合计之比”计算，自带解析器、不执行代码，`parsePivotFormula` / `checkPivotFormula` 与 `PivotFormulaError`）；条件格式（`mark`：数据条与色阶）；按合计筛选（`filters` 的 `top` 与 `between`）；字段面板增加显示方式、条件格式、前 N 项菜单和“添加计算值”对话框
- `@dou-ui/pivot`：选择与复制（拖动、Shift + 方向键、Ctrl / ⌘ + A，复制为制表符文字和 HTML 表格，粘到 `DouSheet` 保留数值和格式）；导出 `toCSV`、`toSheet`（给 `DouSheet` 的工作簿，带格式、合并表头和冻结）、`toChartRows`（给 `@dou-ui/chart` 的透视图）、`toGrid`，以及 `print` 打印整张表并在每页重复表头；文档增加查看明细抽屉、导出、转成电子表格和透视图示例
- `@dou-ui/pivot`：读屏播报选中范围、复制结果和展开折叠（新增语言包文字 `selected`、`copied`、`expanded`、`collapsed`）；新增区块“销售分析”和“工单统计”
- `@dou-ui/pivot`：`highlight` 标出一个行分组和一个列分组；数据变化时选中的单元格留在原来的分组上，不再停在原来的位置
- `@dou-ui/resolver`：配合按需组件插件，自动导入组件和它的样式入口
- `@dou-ui/nuxt`：Nuxt 模块，组件、指令与函数自动导入，样式与配色模式开箱即用，支持服务端渲染
- 组件从 `dou-ui` 具名导入；样式可以全量引入 `dou-ui/style.css`，也可以按组件引入 `dou-ui/components/<name>/style`
