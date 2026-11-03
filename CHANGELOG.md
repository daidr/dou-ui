# 更新日志

DouUI 的所有包（`dou-ui`、`@dou-ui/theme`、`@dou-ui/icons` 以及生态系统各包）使用同一个版本号，一起发布。
版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)；`1.0.0` 之前，次版本号（`0.x.0`）的变化可能包含不兼容的改动，会在「不兼容」一节单独列出。

预发布版本带 `-alpha.n` 或 `-beta.n` 后缀，分别以 npm 的 `alpha`、`beta` 标签发布；正式版以 `latest` 发布。正式版的一节汇总了它所有预发布版本的改动。

这个文件由发版脚本生成：改动先以碎片文件记在 [`.changes/`](./.changes/README.md) 里，发布时汇总到这里。

## 0.1.0-alpha.0 · 2026-11-03

首个版本。

### dou-ui：组件

- **基础**：Button、Icon、Text、Ellipsis、Highlight、Link、Typography、CopyButton、Toggle / ToggleGroup、CodeBlock、RelativeTime
- **布局**：Divider、Space、Grid、Masonry、Splitter、Layout、Scrollbar、Affix、Toolbar
- **表单**：Form / FormItem、Input、Textarea、Editable、InputNumber、InputTag、InputOTP、Checkbox、Radio、Switch、Slider、Rate、Select、Listbox、Autocomplete、Cascader、TreeSelect、DatePicker、TimePicker、InputDate、InputTime、ColorPicker、ColorPanel、Transfer、SegmentedControl、CheckTag、Upload、ImageCropper、FieldGroup
- **浮层**：Tooltip、Popover、Dropdown（菜单项支持勾选、单选与快捷键显示，无论以哪种方式打开，点击菜单以外都会关闭）、DropdownButton、ContextMenu、Dialog、Drawer（可滑动关闭，支持停靠点）、Popconfirm、Tour
- **反馈**：Alert、Banner、Toast、Spinner、Loading、Progress、ProgressGroup、Skeleton、Result
- **数据展示**：Card、Avatar、User、Badge、Tag、Kbd、Empty、Statistic、Countdown、CalendarHeatmap、Sparkline、Image、Carousel、Marquee、QRCode、Watermark、Descriptions、Collapse、Timeline、NodeGraph、CalendarView、Table、Tree、VirtualList、InfiniteScroll、Sortable
- **导航**：Menu、Menubar、Tabs、Steps、Anchor、Breadcrumb、PageHeader、Pagination、Command、BackTop
- **AI 对话**：ChatMessage、ChatList、ChatInput、StreamText、ChatSteps、ChatPlan、ChatReasoning、ChatToolCall、ChatSources、ChatCitation、ChatArtifact、ChatConfirm、ChatSuggestions、ChatAttachments、ChatContextMeter、Shimmer、ChatBubble
- **配置**：ConfigProvider（含组件默认属性与浮层渲染位置）、ColorMode；内置 `zhCN`、`zhTW` 与 `en` 语言包，语言包的 `region` 决定每周第一天、日期格式与数字分隔符
- **表单校验**：规则与整表 `schema` 可以直接使用 Standard Schema
- **组合式函数**：`useFloating`、`useLayer`、`useFocusTrap`、`useScrollLock` 等，可用于编写自己的浮层；`useHotkey` 绑定快捷键，`mod` 按平台取 ⌘ 或 Ctrl，支持按键序列；`useBreakpoints` 读取当前断点，`useClipboard` 复制文本，`useRovingFocus` 让一组控件共用一个 `Tab` 位置并用方向键移动焦点，`useNow` 提供定时更新的当前时间，`useElementSize` / `useResizeObserver` 读取元素尺寸，`useIntersection` 判断元素是否可见

### @dou-ui/theme：主题

- 设计 Token 由 TypeScript 定义并生成 CSS 变量，内置亮色与暗色主题，可用 `defineTheme` 与 `themeToCss` 定制，`createTheme` 从品牌色生成亮暗两套主题
- 全局统一的断点（`sm` 640px、`md` 768px、`lg` 1024px、`xl` 1280px），从 `@dou-ui/theme` 导出为 `breakpoints`
- 所有样式位于 `dou.tokens`、`dou.base`、`dou.components` 三个级联层中，页面上不在级联层里的样式总能覆盖
- 语气色提供 `DEFAULT`、`on`、`text` 三个角色，文字对比度按 WCAG AA 取值
- 统一的动效 Token（时长、进退场曲线、位移、循环周期），`dou-fade`、`dou-zoom`、`dou-slide-*` 过渡预设，`DouCollapseTransition`；`ConfigProvider` 的 `motion` 可减少或关闭动画，`useReducedMotion` 供脚本动画使用

### @dou-ui/icons：图标

- 配套的线性图标，每个图标都是独立的组件，按需引入，也可以脱离 DouUI 单独使用

### @dou-ui/editor：块编辑器

- 文档由可以转换、拖动、嵌套的块组成，支持斜杠菜单、格式工具栏与 Markdown 快捷输入
- 内置标题、列表、引用、代码块（语法高亮、选择语言、复制）、折叠块与提示块；`image` 扩展提供图片块（上传、粘贴、拖入、链接嵌入，可调整宽度并填写说明），`mention` 扩展输入 `@` 提及某人
- 表格：行列菜单、列宽、对齐、表头行与表头列、合并单元格，拖动把手移动整行整列
- 导入导出 HTML 与 Markdown（`blocksToHTML`、`htmlToBlocks`、`@dou-ui/editor/markdown`），写法由各扩展声明
- 评论：选中文字发起讨论，讨论放在 `v-model:comments`，只读时也能评论；评论讨论组件 CommentThread 也可以单独使用
- 历史版本：`compare` 对比旧版本，`nextChange` / `previousChange` 跳转改动，`restore` 一步恢复；`diffBlocks`、`diffText` 比较文档
- 协同编辑 `@dou-ui/editor/collaboration`（Yjs）：显示其他人的光标与选区，表格的行、列、格子分开同步，评论一起同步，撤销只针对自己的修改

### @dou-ui/sheet：电子表格

- 横纵虚拟滚动、冻结行列、多区域选择、直接输入与输入法、数字与日期格式、命名样式、事务与撤销重做
- 复制粘贴与其他表格软件互通，填充柄，行列宽高拖动与自适应，插入、删除、隐藏、移动行列，可自定义的右键菜单；行列操作时公式引用与合并单元格随之改写
- 单元格类型 `date`、`select`、`checkbox`，多工作表与标签栏 `DouSheetTabs`，格式工具栏 `DouSheetToolbar`，CSV 读写
- 公式：自研解析与按需、增量计算，常用的数学、逻辑、文字、日期、统计、查找函数，`defineSheetFunction` 自定义函数；编辑栏、引用着色与函数补全；计算引擎 `@dou-ui/sheet/formula` 可单独使用
- 排序、筛选、条件格式、数据验证、分组折叠行列、批注、评论与历史版本
- 导出图片 `exportSVG` / `exportPNG`，按 A4 分页打印
- 扩展系统：`defineSheetExtension`、`defineSheetCommand`、`defineSheetExporter` / `defineSheetImporter`；不含组件的入口 `@dou-ui/sheet/core` 可在 Worker 或服务端使用
- 协同编辑 `@dou-ui/sheet/collaboration`：并发插删行列不错位，显示他人的选区和正在编辑的格子，只撤销自己的修改

### @dou-ui/sheet-xlsx：xlsx 导入导出

- 把 `@dou-ui/sheet` 的工作簿写成 `.xlsx`，或从 `.xlsx` 读入，不依赖第三方库；支持值、公式、格式、样式、合并、冻结、分组、批注、验证、条件格式与筛选，导入时列出放不下的内容

### @dou-ui/chart：图表

- 由外壳 `DouChart` 与系列、坐标轴组合而成；系列画在 canvas 上，刻度、图例等是可选中、可读屏的文字
- 折线、面积、柱状（堆叠、横向）、散点与气泡、饼图与环形图、组合图与双数值轴，以及热力图、雷达图、漏斗图、瀑布图、直方图、箱线图、仪表盘、矩形树图、旭日图；`defineChartSeries` 自定义系列
- 提示框与多图联动、图例开关、缩放与框选（`DouChartZoom`、`DouChartBrush`、`DouChartRange`）、参考线与标注、数据标签、数据表视图与键盘浏览
- 百万个点的抽稀、按列给出数据、实时追加；导出 SVG / PNG，服务端渲染时输出静态 SVG

### @dou-ui/flow：流程编辑器与白板

- `DouFlowEditor`：在可以平移、缩放的画布上摆放节点、连接端口；对齐参考线与吸附，框选，撤销重做，键盘操作与触屏手势
- 拖出与改接连线、端口类型与连接规则、拖入节点、右键与长按菜单、分组框、小地图与一键整理；贝塞尔、折线、直线三种连线，视口外不渲染
- 白板 `@dou-ui/flow/whiteboard`：形状、便签、文字、连接线、压感画笔、图片、缩放与旋转，导出 SVG / PNG
- 协同编辑 `@dou-ui/flow/collaboration`：按字段合并，显示他人的选中和拖动，只撤销自己的修改
- 用 `data-dou-nodrag` 标记不触发拖动的区域，与 `@dou-ui/dashboard` 相同

### @dou-ui/gantt：甘特图与资源排期

- `DouGantt`：任务表格与时间轴两栏，时间精确到分钟，工作日历（含调休），小时到年六级刻度与连续缩放，纵横虚拟渲染；汇总任务、里程碑与依赖线
- 拖动与调整任务条、拖进度、拉线建依赖、行拖动排序与缩进、行内编辑，事务与撤销重做；自动排期、拖动时预览被推动的任务、关键路径
- 资源排期 `@dou-ui/gantt/scheduler`：按人员或会议室分行，负载条与超载提示，跨行拖动
- 基线对比，导出 PNG / SVG / CSV，打印，`importCSV` 按 ID 更新任务
- 扩展 `defineGanttExtension`；协同编辑 `@dou-ui/gantt/collaboration`

### @dou-ui/code：代码编辑器

- `DouCodeEditor`：只绘制可见行，大文件流畅编辑，输入法内联组字，键盘与触控
- 内置轻量语言的增量分词（与 CodeBlock 共用语法色），自动缩进、括号闭合、注释；多光标、列选择、查找替换、折叠与自动换行
- 装饰、诊断、补全与代码片段、对比视图、可选的小地图；Yjs 协同与 Shiki 适配
- 语言服务 `@dou-ui/code/lsp`：补全、悬停、参数提示、问题与跳转定义

### @dou-ui/form-builder：表单设计器

- 用一份 JSON 描述表单，`DouFormRenderer` 渲染成 `DouForm` 并校验；栅格、分组、标签页、分步、可增删排序的列表字段，自定义字段类型
- 安全的表达式（不执行任意代码）控制显示、禁用、必填与公式联动；描述的结构校验与版本迁移
- 设计器 `DouFormBuilder`：字段面板、画布、属性面板与结构树，拖入、排序、调整宽度，可视化条件与校验规则编辑，多端预览，导入导出 JSON
- 只需要渲染时从 `@dou-ui/form-builder/renderer` 引入，不带设计器的代码；协同编辑 `@dou-ui/form-builder/collaboration`

### @dou-ui/pivot：数据透视表

- 按行列字段分组汇总明细记录：树形行头与多级列表头、小计与总计、展开折叠、排序与筛选，求和、计数、平均、最值、去重计数、中位数与 `defineAggregator` 自定义汇总；行列双向虚拟滚动
- 字段面板 `DouPivotFields`：拖动字段到筛选、列、行、值，日期与数值分组，表格式布局，调整列宽
- 值的显示方式（占比、差值、累计、排名）、计算值、数据条与色阶、前 N 项与按合计筛选
- 大数据：按列给出数据，在 worker 中汇总百万条记录（`@dou-ui/pivot/worker`），也可以接入服务端汇总；汇总内核 `@dou-ui/pivot/engine` 可脱离组件使用
- 选择与复制、导出 CSV、转成 `@dou-ui/sheet` 工作簿或 `@dou-ui/chart` 的数据、打印；读屏播报选中、复制与展开折叠

### @dou-ui/dashboard：仪表盘

- 网格布局 `DouGridLayout`：拖动换位置、拖动边角改大小，其他格子自动让开；按网格自身宽度切换断点并分别保存布局，手机上长按拖动，键盘操作并由读屏播报；布局计算 `@dou-ui/dashboard/layout` 可单独使用
- 仪表盘 `DouDashboard`：JSON 文档记录格子与位置，`defineDashboardWidget` 注册格子类型；编辑与查看模式、撤销重做、添加格子的面板 `DouDashboardPalette`
- 数据源按“数据源 + 筛选”去重请求并定时刷新，视口外的格子延迟加载；筛选栏与格子之间互相筛选
- 内置统计数字、文字、表格格子，`@dou-ui/dashboard/chart` 与 `@dou-ui/dashboard/pivot` 适配图表和透视表；导出图片与打印
- 协同编辑 `@dou-ui/dashboard/collaboration`（Yjs）：同时修改不同格子或同一格子的不同设置都会保留，显示他人所在的格子，只撤销自己的修改

### 集成与引入方式

- 组件从 `dou-ui` 具名导入；样式可以全量引入 `dou-ui/style.css`，也可以按组件引入 `dou-ui/components/<name>/style`
- `@dou-ui/resolver`：配合按需组件插件，自动导入组件和它的样式入口，覆盖 `dou-ui`、各生态包与图标
- `@dou-ui/nuxt`：Nuxt 模块，组件、指令与函数自动导入，样式与配色模式开箱即用，支持服务端渲染
