# 更新日志

`dou-ui`、`@dou-ui/theme`、`@dou-ui/icons` 与 `@dou-ui/resolver` 使用同一个版本号，一起发布。
版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)；`1.0.0` 之前，次版本号（`0.x.0`）的变化可能包含不兼容的改动，会在这里单独标出。

新的改动先记在「未发布」下，发布时由 `bun run release <版本号>` 改成对应版本。

## 未发布

首个版本。

### 组件

- **基础**：Button、Icon、Text、Ellipsis、Link、Typography、CopyButton
- **布局**：Divider、Space、Grid、Splitter、Layout、Scrollbar、Affix
- **表单**：Form / FormItem、Input、Textarea、InputNumber、InputTag、InputOTP、Checkbox、Radio、Switch、Slider、Rate、Select、Listbox、Autocomplete、Cascader、TreeSelect、DatePicker、TimePicker、InputDate、InputTime、ColorPicker、ColorPanel、Transfer、SegmentedControl、CheckTag、Upload、ImageCropper、FieldGroup
- **浮层**：Tooltip、Popover、Dropdown、ContextMenu、Dialog、Drawer、Popconfirm
- **反馈**：Alert、Banner、Toast、Spinner、Loading、Progress、Skeleton、Result
- **数据展示**：Card、Avatar、User、Badge、Tag、Kbd、Empty、Statistic、Countdown、Image、QRCode、Descriptions、Collapse、Timeline、FlowGraph、CalendarView、Table、Tree、VirtualList、InfiniteScroll、Sortable
- **导航**：Menu、Tabs、Steps、Anchor、Breadcrumb、PageHeader、Pagination、Command、BackTop
- **AI 对话**：ChatMessage、ChatList、ChatInput、StreamText、ChatSteps、ChatPlan、ChatReasoning、ChatToolCall、ChatSources、ChatCitation、ChatArtifact、ChatConfirm、ChatSuggestions、ChatAttachments、ChatContextMeter、Shimmer、ChatBubble
- **配置**：ConfigProvider、ColorMode；内置 `zhCN` 与 `en` 语言包

### 主题

- 设计 Token 由 TypeScript 定义并生成 CSS 变量，内置亮色与暗色主题，可用 `defineTheme` 与 `themeToCss` 定制
- 所有样式位于 `dou.tokens`、`dou.base`、`dou.components` 三个级联层中，页面上不在级联层里的样式总能覆盖
- 语气色提供 `DEFAULT`、`on`、`text` 三个角色，文字对比度按 WCAG AA 取值

### 图标与按需引入

- `@dou-ui/icons`：配套的线性图标，可以单独使用
- `@dou-ui/resolver`：配合按需组件插件，自动导入组件和它的样式入口
- 组件从 `dou-ui` 具名导入；样式可以全量引入 `dou-ui/style.css`，也可以按组件引入 `dou-ui/components/<name>/style`
