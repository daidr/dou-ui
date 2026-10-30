# 更新日志

`dou-ui`、`@dou-ui/theme`、`@dou-ui/icons`、`@dou-ui/editor`、`@dou-ui/resolver` 与 `@dou-ui/nuxt` 使用同一个版本号，一起发布。
版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)；`1.0.0` 之前，次版本号（`0.x.0`）的变化可能包含不兼容的改动，会在这里单独标出。

新的改动先记在「未发布」下，发布时由 `bun run release <版本号>` 改成对应版本。

## 未发布

首个版本。

### 组件

- **基础**：Button、Icon、Text、Ellipsis、Highlight、Link、Typography、CopyButton、Toggle / ToggleGroup、CodeBlock、RelativeTime
- **布局**：Divider、Space、Grid、Masonry、Splitter、Layout、Scrollbar、Affix、Toolbar
- **表单**：Form / FormItem、Input、Textarea、InputNumber、InputTag、InputOTP、Checkbox、Radio、Switch、Slider、Rate、Select、Listbox、Autocomplete、Cascader、TreeSelect、DatePicker、TimePicker、InputDate、InputTime、ColorPicker、ColorPanel、Transfer、SegmentedControl、CheckTag、Upload、ImageCropper、FieldGroup
- **浮层**：Tooltip、Popover、Dropdown（菜单项支持勾选、单选与快捷键显示）、DropdownButton、ContextMenu、Dialog、Drawer、Popconfirm、Tour
- **反馈**：Alert、Banner、Toast、Spinner、Loading、Progress、ProgressGroup、Skeleton、Result
- **数据展示**：Card、Avatar、User、Badge、Tag、Kbd、Empty、Statistic、Countdown、CalendarHeatmap、Sparkline、Image、Carousel、Marquee、QRCode、Watermark、Descriptions、Collapse、Timeline、FlowGraph、CalendarView、Table、Tree、VirtualList、InfiniteScroll、Sortable
- **导航**：Menu、Menubar、Tabs、Steps、Anchor、Breadcrumb、PageHeader、Pagination、Command、BackTop
- **AI 对话**：ChatMessage、ChatList、ChatInput、StreamText、ChatSteps、ChatPlan、ChatReasoning、ChatToolCall、ChatSources、ChatCitation、ChatArtifact、ChatConfirm、ChatSuggestions、ChatAttachments、ChatContextMeter、Shimmer、ChatBubble
- **配置**：ConfigProvider（含组件默认属性与浮层渲染位置）、ColorMode；内置 `zhCN`、`zhTW` 与 `en` 语言包，语言包的 `region` 决定每周第一天、日期格式与数字分隔符
- **表单校验**：规则与整表 `schema` 可以直接使用 Standard Schema
- **组合式函数**：`useFloating`、`useLayer`、`useFocusTrap`、`useScrollLock` 等，可用于编写自己的浮层；`useHotkey` 绑定快捷键，`mod` 按平台取 ⌘ 或 Ctrl，支持按键序列；`useBreakpoints` 读取当前断点，`useClipboard` 复制文本，`useRovingFocus` 让一组控件共用一个 `Tab` 位置并用方向键移动焦点，`useNow` 提供定时更新的当前时间

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
- `@dou-ui/editor` 支持导入导出 HTML 与 Markdown（`blocksToHTML`、`htmlToBlocks`，以及 `@dou-ui/editor/markdown`），写法由各扩展声明
- `@dou-ui/resolver`：配合按需组件插件，自动导入组件和它的样式入口
- `@dou-ui/nuxt`：Nuxt 模块，组件、指令与函数自动导入，样式与配色模式开箱即用，支持服务端渲染
- 组件从 `dou-ui` 具名导入；样式可以全量引入 `dou-ui/style.css`，也可以按组件引入 `dou-ui/components/<name>/style`
