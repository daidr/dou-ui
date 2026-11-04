# 更新日志

DouUI 的所有包（`dou-ui`、`@dou-ui/theme`、`@dou-ui/icons` 以及生态系统各包）使用同一个版本号，一起发布。
版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)；`1.0.0` 之前，次版本号（`0.x.0`）的变化可能包含不兼容的改动，会在「不兼容」一节单独列出。

预发布版本带 `-alpha.n` 或 `-beta.n` 后缀，分别以 npm 的 `alpha`、`beta` 标签发布；正式版以 `latest` 发布。正式版的一节汇总了它所有预发布版本的改动。

这个文件由发版脚本生成：改动先以碎片文件记在 [`.changes/`](./.changes/README.md) 里，发布时汇总到这里。

## 0.1.0-alpha.3 · 2026-11-04

### 不兼容

- **dou-ui、@dou-ui/theme、@dou-ui/flow、@dou-ui/form-builder**：Steps、NodeGraph 和流程编辑器默认节点的状态改用和聊天套件（ChatPlan、ChatToolCall、ChatConfirm）相同的词：`wait` → `pending`、`process` → `running`、`finish` → `done`，`error`、`blocked` 不变。迁移：

  - Steps：`status` 属性和 `items[].status` 里的旧值换成新值，`status` 的默认值随之变为 `running`；`title` / `description` 插槽里对 `status` 的判断改用新值；样式类 `.is-wait` / `.is-process` / `.is-finish` 换成 `.is-pending` / `.is-running` / `.is-done`；自定义语言包的 `steps.wait` / `steps.process` / `steps.finish` 换成 `steps.pending` / `steps.running` / `steps.done`。
  - NodeGraph：节点的 `status` 换成新值（不填时默认 `pending`）；DouNodeGraphLegend 自定义 `items` 里 `{ type: 'status', value }` 的 `value` 换成新值；样式类同上；CSS 变量 `--dou-node-graph-status-wait` / `-process` / `-finish` 换成 `-pending` / `-running` / `-done`；自定义语言包的 `nodeGraph.status.wait` / `process` / `finish` 换成 `pending` / `running` / `done`。
  - 流程编辑器默认节点：`data.status` 换成新值；样式类同上；CSS 变量 `--dou-flow-editor-status-wait` / `-process` / `-finish` 换成 `-pending` / `-running` / `-done`；自定义语言包的 `status.wait` / `process` / `finish` 换成 `pending` / `running` / `done`。未开始的状态点读作「未开始」，不再是「等待」。 ([#294](https://github.com/daidr/dou-ui/pull/294))

- **dou-ui、@dou-ui/theme**：聊天套件的状态名统一为和 ChatPlan 相同的一套：`pending` 未开始、`running` 进行中、`waiting` 等待别人（比如等用户确认）、`done` 已完成、`error` 出错。

  **先检查这一处，类型检查发现不了**：ChatToolCall 的 `pending` 仍然合法，但含义从“等待确认”变成了“未开始”。请搜索 `DouChatToolCall` 和 `type: 'tool'` 里的 `'pending'`，等待用户允许的调用改为 `'waiting'`。开发环境下，`pending` 的调用带 `actions` 插槽时会警告一次。

  | 组件                                              | 原来                    | 现在                         |
  | ------------------------------------------------- | ----------------------- | ---------------------------- |
  | ChatToolCall                                      | `pending`（等待确认）   | `waiting`                    |
  | ChatToolCall                                      | `success`（也是默认值） | `done`（默认值）             |
  | ChatToolCall                                      | —                       | 新增 `pending`，表示还没开始 |
  | ChatConfirm                                       | `pending`（也是默认值） | `waiting`（默认值）          |
  | ChatArtifact                                      | `generating`            | `running`                    |
  | ChatAttachments                                   | `uploading`、`success`  | `running`、`done`            |
  | ChatMessage 的 `tool`、`confirm`、`artifact` part | 同上对应组件            | 同上对应组件                 |
  - 样式类：`.dou-chat-tool-call--pending`、`--success` 改为 `--waiting`、`--done`；`.dou-chat-confirm.is-pending` 改为 `.is-waiting`；附件的 `.is-uploading`、`.is-success` 改为 `.is-running`、`.is-done`。
  - 语言包：`chat.toolSuccess` 改名为 `chat.toolDone`，新增 `chat.toolWaiting`，`chat.toolPending` 现在是“未开始”的文案。
  - 数据来自接口 JSON 等不经过类型检查的地方时，开发环境遇到不认识的 `status` 会警告一次，旧名字会提示对应的新名字。ChatConfirm 遇到不认识的值时不再显示为“已拒绝”。 ([#296](https://github.com/daidr/dou-ui/pull/296))

- **dou-ui、@dou-ui/theme**：Descriptions 原来把列表画成表格的 `bordered` 改为 `variant: 'plain' | 'table'`（默认 `'plain'`），`bordered` 现在和其他组件一样只表示外框：`table` 样式默认带外框，设为 `false` 时去掉外框，单元格之间的细线保留。迁移：把 `<DouDescriptions bordered>` 改成 `<DouDescriptions variant="table">`；对应的类名从 `is-bordered` 变为 `dou-descriptions--table`。新增 `--dou-descriptions-border` 调整外框颜色。 ([#301](https://github.com/daidr/dou-ui/pull/301))
- **@dou-ui/theme**：`--dou-layout-main-padding` 和 `--dou-layout-padding-x` 的默认值改为声明在 `.dou-layout-main` 和 `.dou-layout-header` / `.dou-layout-footer` 上，和其他组件变量一样；原来设在 `:root` 或外层容器上的，要改到这些类上。 ([#301](https://github.com/daidr/dou-ui/pull/301))
- **dou-ui、@dou-ui/theme**：Table 原来画列分隔线的 `bordered` 改名为 `columnDividers`，`bordered` 现在和其他组件一样表示外框（默认开）。迁移：把 `<DouTable bordered>` 改成 `<DouTable column-dividers>`；对应的类名从 `is-bordered` 变为 `is-column-dividers`。 ([#301](https://github.com/daidr/dou-ui/pull/301))
- **dou-ui**：ChatSteps 表示“是否还在进行”的 `running` 属性改名为 `live`，与 ChatPlan、ChatToolCall 一致；`title` 插槽的参数 `running` 也改为 `live`，ChatMessage 的 `steps` 片段同样改用 `live` 字段。请把 `:running="…"`、`{ type: 'steps', running }` 和插槽里的 `running` 改为 `live`。为 `false` 时，`running` 的步骤现在会换成静止的灰色圆点。 ([#305](https://github.com/daidr/dou-ui/pull/305))
- **@dou-ui/editor**：块编辑器的间距拆成两个：`--dou-editor-block-gap` 改为相邻两块之间的距离（原来是每块上下各留的距离，默认值从 `2px` 改为 `4px`，看起来不变；原来自定义了它的，把值乘以 2），新增 `--dou-editor-list-gap` 控制同一列表里相邻两项的距离，调大块间距时列表不再跟着变松。新增 `--dou-editor-reading-width` 限制正文宽度，编辑器更宽时正文居中、手柄显示在左侧边距里。代码块上下的距离也改为跟着块间距走。 ([#308](https://github.com/daidr/dou-ui/pull/308))

### 新增

- **dou-ui、@dou-ui/theme**：ChatPlan 新增 `collapsible`，设为 `false` 时是始终展开的纯面板，标题不能点击收起。 ([#293](https://github.com/daidr/dou-ui/pull/293))
- **dou-ui、@dou-ui/theme**：ChatPlan 的步骤新增 `waiting` 状态，表示这一步停下来等用户确认或外部任务完成，以警示色图标显示。 ([#293](https://github.com/daidr/dou-ui/pull/293))
- **dou-ui、@dou-ui/theme**：新增 Markdown 流式渲染组件 `DouMarkdown`：增量解析，已写完的块不再重新解析和渲染；写了一半的加粗、链接、表格、代码块直接以最终的样子显示；新内容逐步渐显，遵循减弱动态效果。每种元素都可以用同名插槽替换渲染，`:::名字` 写自定义块，`tip`、`warning` 等默认显示为 Alert。不解析 HTML，链接、图片和角标来源只允许安全协议，支持服务端渲染。同时导出 `parseMarkdown`、`createMarkdownParser` 和 `defaultSanitizeUrl`。

  ChatMessage 新增 `markdown`，文字和思考过程片段用 Markdown 渲染，正文中的 `[1]` 显示为消息来源的角标；可以传入选项对象，Markdown 的插槽加 `markdown-` 前缀使用。`text` 插槽的参数新增 `sources`。

  CodeBlock 新增 `streaming`，代码逐步到达时只高亮完整的行，新行逐行淡入；使用 `createCodeHighlighter` 时代码块的语法颜色现在能正确显示。 ([#297](https://github.com/daidr/dou-ui/pull/297))

- **dou-ui、@dou-ui/theme**：新增 StatusDot 状态点：五种语气色、三档尺寸，`ripple` 开启涟漪，减少动效时变为静止的光晕；涟漪只用 CSS 动画，大量使用也不影响性能。Timeline 当前步骤的涟漪改用它实现。 ([#300](https://github.com/daidr/dou-ui/pull/300))
- **dou-ui、@dou-ui/theme、@dou-ui/code、@dou-ui/flow、@dou-ui/gantt、@dou-ui/sheet、@dou-ui/pivot、@dou-ui/form-builder、@dou-ui/editor**：带外框的组件统一新增 `bordered`（默认 `true`），设为 `false` 时去掉边框和圆角，不留透明的 1px，聚焦时也不再画出边框，适合放进已经有边框的卡片或面板：FlowEditor、CodeEditor、CodeDiff、Gantt、Scheduler、Sheet、Pivot、FormBuilder、Table、CodeBlock、QRCode、CalendarView、LayoutFooter。边框颜色可以统一用 `--dou-<组件>-border` 调整，ColorPanel 新增 `--dou-color-panel-border`，LayoutHeader、LayoutAside、LayoutFooter 的分隔线分别新增 `--dou-layout-header-border`、`--dou-layout-aside-border`、`--dou-layout-footer-border`。 ([#301](https://github.com/daidr/dou-ui/pull/301))
- **@dou-ui/theme**：写死的内边距改为 CSS 变量：`--dou-layout-aside-padding`（侧栏正文和底部，默认 8px，设在 `.dou-layout-aside` 和窄屏抽屉 `.dou-layout-aside-drawer` 上）、`--dou-color-panel-padding`、`--dou-qrcode-padding`、`--dou-result-padding`。 ([#301](https://github.com/daidr/dou-ui/pull/301))
- **dou-ui**：Menu 新增 `itemContextmenu` 事件，参数是被右键的项和原生事件，配合 ContextMenu 可以知道右键点的是哪一项。 ([#303](https://github.com/daidr/dou-ui/pull/303))
- **dou-ui**：ChatPlan、ChatToolCall 新增 `live` 开关，默认 `true`。这一轮结束或被停止时设为 `false`：`running` 的步骤或调用仍是当前这一项，但转圈换成静止的灰色圆点、去掉扫光，不用再逐个改写状态。ChatMessage 的 `plan`、`tool` 片段也可以带 `live`。 ([#305](https://github.com/daidr/dou-ui/pull/305))
- **dou-ui、@dou-ui/theme**：ChatConfirm 和 ChatToolCall 新增 `withdrawn` 状态，表示用户回答之前助手已经不需要了，比如生成被停止或助手换了做法。ChatConfirm 收起为一行“已撤回”，图标和文字整体变淡，不再使用 `tone` 的颜色；ChatToolCall 显示“已撤回”。语言包新增 `chat.withdrawn` 和 `chat.toolWithdrawn`。

  ChatConfirm 回答或撤回后，如果焦点原本在它的按钮上，会留在卡片上而不是丢到页面；结果行一直挂载，读屏软件能播报新的结果。 ([#306](https://github.com/daidr/dou-ui/pull/306))

- **dou-ui、@dou-ui/theme**：Tabs 新增 `height`：设置后面板填满标签以外的空间并单独滚动，竖排时放不下的标签列也单独滚动、边缘渐隐。新增 `iconOnly` 和 TabPanel 的 `icon`，标签可以只显示图标，文字作为可读名称并在提示中显示。竖排时面板现在总是和标签列一样高。 ([#307](https://github.com/daidr/dou-ui/pull/307))
- **dou-ui**：ContextMenu 新增 `v-model:target` 和 `beforeOpen`：每次右键开始时先清空 `target`，由项的事件重新记下；`beforeOpen` 返回 `false` 时不打开，比如右键分组标题、表头或空隙时，右键交还给浏览器或外层的 ContextMenu。触发区域里的元素已经处理了这次右键（调用过 `preventDefault()`）时也不再打开，嵌套的 ContextMenu 只打开里面那个。 ([#309](https://github.com/daidr/dou-ui/pull/309))
- **dou-ui、@dou-ui/theme、@dou-ui/sheet、@dou-ui/form-builder**：菜单项新增 `description`，在文字下面显示一行说明：DropdownItem 的属性和插槽，以及 `ContextMenuItem`、`SheetMenuItem`、`FormBuilderMenuItem` 的字段。 ([#311](https://github.com/daidr/dou-ui/pull/311))
- **dou-ui、@dou-ui/theme**：ProgressGroup 新增 `legendDirection`：设为 `vertical` 时图例每项占一行，名称在前、数量靠右对齐，名称过长时以省略号截断，悬停可以看到全名；数量过长时换行，不会超出容器。默认的 `horizontal` 与之前一样并排显示。 ([#313](https://github.com/daidr/dou-ui/pull/313))
- **dou-ui、@dou-ui/theme**：Button 新增 `size="xs"`：高 24px，用于密集的行和工具栏里的次要操作，不用于主操作。在触屏上，`xs` 按钮和只有图标的按钮一样，可点击区域会扩展到约 40px。`xs` 是按钮独有的尺寸，表单和 FieldGroup 的 `size` 不会传成 `xs`。 ([#315](https://github.com/daidr/dou-ui/pull/315))
- **dou-ui、@dou-ui/theme**：菜单项可以分组并加小标题：新增 `DouDropdownGroup`，`DouDropdownRadioGroup` 也能写 `label` 和 `divided`；用数据写菜单项时写成 `{ type: 'group', label, children }`。 ([#316](https://github.com/daidr/dou-ui/pull/316))

### 改进

- **@dou-ui/flow、dou-ui**：流程图整理后更工整：一条直链上的节点上下（或左右）对齐，跨好几层的长连线从各层节点的空隙里绕过去，不再压在节点上，同一对节点之间的几条长连线错开并排；彼此不相连的几组节点分开排列，输出多于输入的节点排到靠近下游的位置，连线交叉也更少。长连线经过的点存在连线新增的 `points` 里。只移动一端或改变一端的大小时清掉，两端一起移动或复制粘贴时跟着平移。NodeGraph 同样把不相连的几组节点分开排列，输出多于输入的节点后移，交叉更少。 ([#312](https://github.com/daidr/dou-ui/pull/312))

### 修复

- **dou-ui**：ChatSources 和 ChatCitation 只把 http(s)、mailto、tel 和相对地址渲染成链接，`javascript:`、`data:` 这类地址不再可以点击，开发环境下会警告一次。 ([#298](https://github.com/daidr/dou-ui/pull/298))
- **dou-ui、@dou-ui/flow、@dou-ui/form-builder**：按需引入时，组件内部用到的其他组件也能读到 ConfigProvider `defaults` 里给它们的默认值，例如只引入 ChatMessage 时 `defaults.DouStreamText` 对消息里的文字同样生效；此前要先在别处引入过 StreamText 才有效。涉及 ChatMessage、Table、Pagination、ColorPicker、CommentThread、ContextMenu、白板的连接点、表单设计器的预览等所有嵌套使用其他组件的地方。 ([#299](https://github.com/daidr/dou-ui/pull/299))
- **dou-ui、@dou-ui/theme**：很长的标签不再撑出 InputTag、Select / TreeSelect / Cascader 多选的输入框，也不再超出 Tag 自身的宽度：放不下的文字以省略号结尾，用鼠标悬停时显示完整内容。这几个输入框放在网格或横向弹性布局里时，长内容也不会把它们撑宽。 ([#302](https://github.com/daidr/dou-ui/pull/302))
- **dou-ui**：Popover 的 `content` 插槽参数 `close` 与实例方法 `close()` 关闭时把焦点交还给触发元素；Popconfirm 点击取消或确定后同样如此。 ([#310](https://github.com/daidr/dou-ui/pull/310))
- **dou-ui**：`DouTooltip` 套在 `DouPopover`、`DouDropdown`、`DouPopconfirm`、`DouContextMenu` 外面（或反过来）时，两层的属性与事件都落到同一个触发元素上，点击不再失效，也不再需要额外包一层 `<span>`。弹出层打开后提示自动收起。提示文字与触发元素的 `aria-label` 相同时不再设置 `aria-describedby`，读屏不会把同一句话读两遍。 ([#314](https://github.com/daidr/dou-ui/pull/314))
- **dou-ui**：`trigger="hover"` 的 Dropdown、Popover 和 Menu 的弹出子菜单在手机上轻点打开后很快自己关上：轻点之后浏览器补发的鼠标事件被当成了指针离开。现在悬停只认鼠标，触屏和触控笔改为轻点打开、再点一下或点别处收起；触发元素是链接时，第一次轻点只打开弹出层。悬停的 Popover 也能用 `Enter` 打开，轻点或键盘打开时带上 `aria-expanded`。ChatCitation 的预览标题改为来源链接，键盘聚焦角标时会弹出预览。 ([#317](https://github.com/daidr/dou-ui/pull/317))

## 0.1.0-alpha.2 · 2026-11-04

### 不兼容

- **@dou-ui/theme**：`ToneTokens` 新增必填的 `soft`，手写完整 `ThemeTokens` 的主题要给每种语气补上：值用 `mixColors(DEFAULT, bg.surface, 0.07)` 算出，或者整组改用 `createTone(color, base)` 生成。用 `defineTheme` 在内置主题上覆盖的主题不受影响。 ([#289](https://github.com/daidr/dou-ui/pull/289))

### 新增

- **@dou-ui/theme**：每种语气色新增浅色底 `soft`（`--dou-color-primary-soft`、`--dou-color-warning-soft` 等），亮色和暗色主题各一套，等于语气色以 7% 混进表面色，和 soft 按钮、标签的底色一致，语气文字和正文在上面都不低于 4.5:1。`createTheme` / `createTone` 会一并生成。 ([#289](https://github.com/daidr/dou-ui/pull/289))

### 改进

- **dou-ui、@dou-ui/theme**：Alert 的 `action` 插槽放多个按钮时不再挤压正文：正文旁边放不下时，操作区换到正文下方，按钮之间也可以换行。新增 `--dou-alert-text-min` 控制正文至少保留的宽度。 ([#288](https://github.com/daidr/dou-ui/pull/288))
- **@dou-ui/flow**：白板图片上传失败时在屏幕下方显示错误提示，不再只有读屏能听到；新增 `onUploadError(file, error)` 选项，可以改用自己的方式提示。`upload` 没有返回 `src` 时也算失败，不再插入坏图。 ([#291](https://github.com/daidr/dou-ui/pull/291))

### 修复

- **@dou-ui/dashboard**：`deriveLayout` 推算较窄断点的布局时，同一行里原本一样宽的格子保持一样宽：例如 12 列里四个 3 列宽的格子在 6 列时排成两行、每行两个，不再变成 2/1/2/1；折不了行时留出空列。 ([#290](https://github.com/daidr/dou-ui/pull/290))
- **@dou-ui/flow、@dou-ui/dashboard**：`@dou-ui/flow/style` 和 `@dou-ui/dashboard/style` 也带上子路径（如 `@dou-ui/flow/whiteboard`、`@dou-ui/dashboard/widgets`）用到的组件样式，按需引入时白板的错误提示、仪表盘的小组件不再缺样式。 ([#291](https://github.com/daidr/dou-ui/pull/291))

## 0.1.0-alpha.1 · 2026-11-03

### 改进

- **@dou-ui/code**：触屏上的符号栏改为放在编辑器下方、随页面滚动，按住左端的拖动柄可以移到任意位置，不再贴着键盘；四个方向键换成一个摇杆，按下后放大，推得越远光标移动越快。 ([#285](https://github.com/daidr/dou-ui/pull/285))

### 修复

- **@dou-ui/code**：iOS Safari 上滚动页面时，代码编辑器的选区菜单不再越跑越远。 ([#285](https://github.com/daidr/dou-ui/pull/285))
- **@dou-ui/gantt**：设了 `range` 的甘特图和资源排期不能再无限往右滚动，滚到范围末端就停。 ([#286](https://github.com/daidr/dou-ui/pull/286))

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
