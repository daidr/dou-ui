import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitepress'
import type { DefaultTheme, MarkdownOptions } from 'vitepress'
import { demoCode } from './demo-code'
import { colorModeScript } from '../../packages/dou-ui/src/components/color-mode/use-color-mode'

const r = (path: string) => fileURLToPath(new URL(path, import.meta.url))

const markdown: MarkdownOptions = {
  config(md) {
    // Wrap code blocks so they get DouUI's copy button.
    const fence = md.renderer.rules.fence!
    md.renderer.rules.fence = (...args) => `<DocCode>${fence(...args)}</DocCode>`
  },
}

/** Each package of the ecosystem shows its own pages below the ecosystem overview. */
const ecosystem = (
  title: string,
  items: DefaultTheme.SidebarItem[],
): DefaultTheme.SidebarItem[] => [
  { text: '', items: [{ text: '生态系统概览', link: '/ecosystem/' }] },
  { text: title, items },
]

const editorSidebar = ecosystem('块编辑器', [
  { text: '介绍', link: '/editor/' },
  { text: '文档数据', link: '/editor/data' },
  { text: '快捷操作', link: '/editor/shortcuts' },
  { text: '用代码修改', link: '/editor/editing' },
  { text: '扩展', link: '/editor/extensions' },
  { text: '代码块', link: '/editor/code-block' },
  { text: '折叠块与提示块', link: '/editor/toggle-callout' },
  { text: '图片', link: '/editor/image' },
  { text: '提及', link: '/editor/mention' },
  { text: '评论', link: '/editor/comments' },
  { text: '表格', link: '/editor/table' },
  { text: '导入与导出', link: '/editor/import-export' },
  { text: '协同编辑', link: '/editor/collaboration' },
])

const flowSidebar = ecosystem('流程编辑器', [
  { text: '介绍', link: '/flow/' },
  { text: '文档数据', link: '/flow/data' },
  { text: '自定义节点', link: '/flow/custom-nodes' },
  { text: '端口类型与连接规则', link: '/flow/ports' },
  { text: '连线', link: '/flow/edges' },
  { text: '分组', link: '/flow/groups' },
  { text: '编辑交互', link: '/flow/editing' },
  { text: '扩展', link: '/flow/extensions' },
  { text: '协同编辑', link: '/flow/collaboration' },
  { text: '白板', link: '/flow/whiteboard' },
  { text: '导出图片', link: '/flow/export' },
  { text: '大型流程', link: '/flow/performance' },
])

const ganttSidebar = ecosystem('甘特图', [
  { text: '介绍', link: '/gantt/' },
  { text: '文档数据', link: '/gantt/data' },
  { text: '扩展', link: '/gantt/extensions' },
  { text: '协同编辑', link: '/gantt/collaboration' },
  { text: '资源排期', link: '/gantt/scheduler' },
])

const sheetSidebar = ecosystem('电子表格', [
  { text: '介绍', link: '/sheet/' },
  { text: '文档数据', link: '/sheet/data' },
  { text: '公式', link: '/sheet/formulas' },
  { text: '扩展', link: '/sheet/extensions' },
  { text: '导入导出 xlsx', link: '/sheet/xlsx' },
  { text: '协同编辑', link: '/sheet/collaboration' },
])
const codeSidebar = ecosystem('代码编辑器', [
  { text: '介绍', link: '/code/' },
  { text: '协同编辑', link: '/code/collaboration' },
])
const chartSidebar = ecosystem('图表', [{ text: '介绍', link: '/chart/' }])
const pivotSidebar = ecosystem('数据透视', [{ text: '介绍', link: '/pivot/' }])
const dashboardSidebar = ecosystem('仪表盘', [
  { text: '网格布局', link: '/dashboard/' },
  { text: '仪表盘', link: '/dashboard/dashboard' },
  { text: '数据与筛选', link: '/dashboard/data' },
  { text: '内置格子', link: '/dashboard/widgets' },
  { text: '协同编辑', link: '/dashboard/collaboration' },
])
const formBuilderSidebar = ecosystem('表单设计器', [
  { text: '介绍', link: '/form-builder/' },
  { text: '表单描述', link: '/form-builder/document' },
  { text: '字段类型', link: '/form-builder/fields' },
  { text: '联动与表达式', link: '/form-builder/logic' },
  { text: '标签页、分步与列表', link: '/form-builder/structure' },
  { text: '设计器', link: '/form-builder/builder' },
  { text: '协同编辑', link: '/form-builder/collaboration' },
])

export default defineConfig({
  lang: 'zh-CN',
  title: 'DouUI',
  description: '一个为自己打造的 Vue 3 组件库',
  cleanUrls: true,
  // DouUI's own color mode drives the site, not VitePress's.
  appearance: false,
  head: [
    // Apply the remembered color mode before the first paint.
    ['script', {}, colorModeScript()],
  ],
  // Header anchors stop below the sticky header.
  scrollOffset: 88,
  markdown,
  themeConfig: {
    nav: [
      { text: '指南', link: '/guide/philosophy' },
      { text: '组件', link: '/components/overview' },
      { text: '区块', link: '/blocks/login' },
      // The ecosystem packages keep their own paths.
      {
        text: '生态系统',
        link: '/ecosystem/',
        activeMatch:
          '^/(ecosystem|editor|flow|gantt|sheet|chart|form-builder|code|pivot|dashboard)(/|$)',
      },
      { text: '图标', link: '/icons/' },
      { text: '集成', link: '/integrations/vite' },
    ],
    sidebar: {
      '/blocks/': [
        {
          text: '区块',
          items: [
            { text: '登录页', link: '/blocks/login' },
            { text: '设置页', link: '/blocks/settings' },
            { text: '数据管理页', link: '/blocks/data' },
            { text: '仪表盘', link: '/blocks/dashboard' },
            { text: '经营看板', link: '/blocks/business' },
            { text: '实时监控', link: '/blocks/monitoring' },
            { text: '运营大盘', link: '/blocks/ops-board' },
            { text: '服务大盘', link: '/blocks/services' },
            { text: '可自定义的首页', link: '/blocks/home' },
            { text: '门店对比', link: '/blocks/compare' },
            { text: '销售分析', link: '/blocks/sales-analysis' },
            { text: '工单统计', link: '/blocks/ticket-stats' },
            { text: '部门预算', link: '/blocks/budget' },
            { text: '门店排班', link: '/blocks/shifts' },
            { text: 'AI 对话页', link: '/blocks/chat' },
            { text: '错误页', link: '/blocks/errors' },
            { text: '看板', link: '/blocks/kanban' },
            { text: '文件管理', link: '/blocks/files' },
            { text: 'AI 工作流', link: '/blocks/ai-workflow' },
            { text: '头脑风暴', link: '/blocks/brainstorm' },
            { text: '代码练习', link: '/blocks/code-practice' },
            { text: '配置编辑', link: '/blocks/config-editor' },
            { text: '发布排期', link: '/blocks/release-plan' },
            { text: '会议室预约', link: '/blocks/room-booking' },
            { text: '活动报名表', link: '/blocks/event-signup' },
            { text: '设备报修单', link: '/blocks/repair-order' },
          ],
        },
      ],
      '/ecosystem': [
        {
          text: '',
          items: [{ text: '概览', link: '/ecosystem/' }],
        },
        {
          text: '组件包',
          items: [
            { text: '块编辑器', link: '/editor/' },
            { text: '流程编辑器', link: '/flow/' },
            { text: '甘特图', link: '/gantt/' },
            { text: '电子表格', link: '/sheet/' },
            { text: '图表', link: '/chart/' },
            { text: '表单设计器', link: '/form-builder/' },
            { text: '代码编辑器', link: '/code/' },
            { text: '数据透视', link: '/pivot/' },
            { text: '仪表盘', link: '/dashboard/' },
          ],
        },
      ],
      '/editor': editorSidebar,
      '/flow': flowSidebar,
      '/gantt': ganttSidebar,
      '/sheet': sheetSidebar,
      '/chart': chartSidebar,
      '/form-builder': formBuilderSidebar,
      '/code': codeSidebar,
      '/pivot': pivotSidebar,
      '/dashboard': dashboardSidebar,
      '/icons': [
        {
          text: '图标',
          items: [
            { text: '图标库', link: '/icons/' },
            { text: '安装与使用', link: '/icons/usage' },
            { text: '设计规范', link: '/icons/design' },
          ],
        },
      ],
      '/integrations/': [
        {
          text: '集成',
          items: [
            { text: 'Vite', link: '/integrations/vite' },
            { text: 'Nuxt', link: '/integrations/nuxt' },
          ],
        },
      ],
      '/guide/': [
        {
          text: '指南',
          items: [
            { text: '设计原则', link: '/guide/philosophy' },
            { text: '视觉语言', link: '/guide/visual-language' },
            { text: '快速开始', link: '/guide/getting-started' },
            { text: '主题与 Token', link: '/guide/theming' },
            { text: '主题编辑器', link: '/guide/theme-editor' },
            { text: '国际化', link: '/guide/i18n' },
            { text: '浮层', link: '/guide/overlays' },
            { text: '组合式函数', link: '/guide/composables' },
            { text: '动效', link: '/guide/motion' },
            { text: '断点', link: '/guide/breakpoints' },
          ],
        },
      ],
      '/components/': [
        {
          text: '',
          items: [{ text: '概览', link: '/components/overview' }],
        },
        {
          text: '基础',
          items: [
            { text: 'Button 按钮', link: '/components/button' },
            { text: 'Toggle 切换按钮', link: '/components/toggle' },
            { text: 'Icon 图标', link: '/components/icon' },
            { text: 'Text 文本', link: '/components/text' },
            { text: 'Ellipsis 文本省略', link: '/components/ellipsis' },
            { text: 'Highlight 关键词高亮', link: '/components/highlight' },
            { text: 'Link 链接', link: '/components/link' },
            { text: 'Typography 排版', link: '/components/typography' },
            { text: 'CopyButton 复制按钮', link: '/components/copy-button' },
            { text: 'CodeBlock 代码块', link: '/components/code-block' },
          ],
        },
        {
          text: '布局',
          items: [
            { text: 'Divider 分割线', link: '/components/divider' },
            { text: 'Space 间距', link: '/components/space' },
            { text: 'Toolbar 工具栏', link: '/components/toolbar' },
            { text: 'Grid 栅格', link: '/components/grid' },
            { text: 'Masonry 瀑布流', link: '/components/masonry' },
            { text: 'Splitter 分割面板', link: '/components/splitter' },
            { text: 'Layout 布局', link: '/components/layout' },
            { text: 'Scrollbar 滚动条', link: '/components/scrollbar' },
            { text: 'Affix 固钉', link: '/components/affix' },
          ],
        },
        {
          text: '表单',
          items: [
            { text: 'Input 输入框', link: '/components/input' },
            { text: 'Textarea 多行输入', link: '/components/textarea' },
            { text: 'Editable 行内编辑', link: '/components/editable' },
            { text: 'InputNumber 数字输入', link: '/components/input-number' },
            { text: 'InputTag 标签输入', link: '/components/input-tag' },
            { text: 'InputOTP 验证码输入', link: '/components/input-otp' },
            { text: 'Checkbox 多选框', link: '/components/checkbox' },
            { text: 'Radio 单选框', link: '/components/radio' },
            { text: 'Switch 开关', link: '/components/switch' },
            { text: 'Slider 滑块', link: '/components/slider' },
            { text: 'Rate 评分', link: '/components/rate' },
            { text: 'Select 选择器', link: '/components/select' },
            { text: 'Listbox 列表选择', link: '/components/listbox' },
            { text: 'Autocomplete 自动补全', link: '/components/autocomplete' },
            { text: 'Cascader 级联选择', link: '/components/cascader' },
            { text: 'TreeSelect 树选择', link: '/components/tree-select' },
            { text: 'DatePicker 日期选择', link: '/components/date-picker' },
            { text: 'TimePicker 时间选择', link: '/components/time-picker' },
            { text: 'InputDate 日期输入', link: '/components/input-date' },
            { text: 'InputTime 时间输入', link: '/components/input-time' },
            { text: 'ColorPicker 颜色选择', link: '/components/color-picker' },
            { text: 'ColorPanel 取色面板', link: '/components/color-panel' },
            { text: 'Transfer 穿梭框', link: '/components/transfer' },
            { text: 'SegmentedControl 分段控制器', link: '/components/segmented-control' },
            { text: 'CheckTag 可选标签', link: '/components/check-tag' },
            { text: 'Upload 上传', link: '/components/upload' },
            { text: 'ImageCropper 图片裁剪', link: '/components/image-cropper' },
            { text: 'FieldGroup 组合', link: '/components/field-group' },
            { text: 'Form 表单', link: '/components/form' },
          ],
        },
        {
          text: '浮层',
          items: [
            { text: 'Tooltip 文字提示', link: '/components/tooltip' },
            { text: 'Popover 气泡卡片', link: '/components/popover' },
            { text: 'Dropdown 下拉菜单', link: '/components/dropdown' },
            { text: 'ContextMenu 右键菜单', link: '/components/context-menu' },
            { text: 'Dialog 对话框', link: '/components/dialog' },
            { text: 'Drawer 抽屉', link: '/components/drawer' },
            { text: 'Popconfirm 气泡确认', link: '/components/popconfirm' },
            { text: 'Tour 漫游引导', link: '/components/tour' },
          ],
        },
        {
          text: '反馈',
          items: [
            { text: 'Alert 提示条', link: '/components/alert' },
            { text: 'Banner 公告条', link: '/components/banner' },
            { text: 'Toast 轻提示', link: '/components/toast' },
            { text: 'Spinner 加载', link: '/components/spinner' },
            { text: 'Loading 加载遮罩', link: '/components/loading' },
            { text: 'Progress 进度条', link: '/components/progress' },
            { text: 'ProgressGroup 分段进度', link: '/components/progress-group' },
            { text: 'Skeleton 骨架屏', link: '/components/skeleton' },
            { text: 'Result 结果', link: '/components/result' },
          ],
        },
        {
          text: '数据展示',
          items: [
            { text: 'Card 卡片', link: '/components/card' },
            { text: 'Avatar 头像', link: '/components/avatar' },
            { text: 'User 用户', link: '/components/user' },
            { text: 'CommentThread 评论讨论', link: '/components/comment-thread' },
            { text: 'Badge 徽标', link: '/components/badge' },
            { text: 'Tag 标签', link: '/components/tag' },
            { text: 'Kbd 键盘按键', link: '/components/kbd' },
            { text: 'Empty 空状态', link: '/components/empty' },
            { text: 'Statistic 统计数值', link: '/components/statistic' },
            { text: 'Countdown 倒计时', link: '/components/countdown' },
            { text: 'RelativeTime 相对时间', link: '/components/relative-time' },
            { text: 'Image 图片', link: '/components/image' },
            { text: 'Carousel 轮播', link: '/components/carousel' },
            { text: 'Marquee 跑马灯', link: '/components/marquee' },
            { text: 'QRCode 二维码', link: '/components/qrcode' },
            { text: 'Watermark 水印', link: '/components/watermark' },
            { text: 'Descriptions 描述列表', link: '/components/descriptions' },
            { text: 'Collapse 折叠面板', link: '/components/collapse' },
            { text: 'Timeline 时间线', link: '/components/timeline' },
            { text: 'NodeGraph 节点图', link: '/components/node-graph' },
            { text: 'CalendarView 日历视图', link: '/components/calendar-view' },
            { text: 'CalendarHeatmap 日历热力图', link: '/components/calendar-heatmap' },
            { text: 'Sparkline 迷你图', link: '/components/sparkline' },
            { text: 'Table 表格', link: '/components/table' },
            { text: 'Tree 树', link: '/components/tree' },
            { text: 'VirtualList 虚拟列表', link: '/components/virtual-list' },
            { text: 'InfiniteScroll 滚动加载', link: '/components/infinite-scroll' },
            { text: 'Sortable 拖拽排序', link: '/components/sortable' },
          ],
        },
        {
          text: '导航',
          items: [
            { text: 'Menu 导航菜单', link: '/components/menu' },
            { text: 'Menubar 菜单栏', link: '/components/menubar' },
            { text: 'Tabs 标签页', link: '/components/tabs' },
            { text: 'Steps 步骤条', link: '/components/steps' },
            { text: 'Anchor 锚点导航', link: '/components/anchor' },
            { text: 'Breadcrumb 面包屑', link: '/components/breadcrumb' },
            { text: 'PageHeader 页头', link: '/components/page-header' },
            { text: 'Pagination 分页', link: '/components/pagination' },
            { text: 'Command 命令面板', link: '/components/command' },
            { text: 'BackTop 回到顶部', link: '/components/back-top' },
          ],
        },
        {
          text: 'AI 对话',
          items: [
            { text: '概览', link: '/components/chat' },
            { text: 'ChatMessage 对话消息', link: '/components/chat-message' },
            { text: 'ChatList 消息列表', link: '/components/chat-list' },
            { text: 'ChatInput 对话输入框', link: '/components/chat-input' },
            { text: 'StreamText 流式文字', link: '/components/stream-text' },
            { text: 'ChatSteps 执行步骤', link: '/components/chat-steps' },
            { text: 'ChatPlan 任务计划', link: '/components/chat-plan' },
            { text: 'ChatReasoning 思考过程', link: '/components/chat-reasoning' },
            { text: 'ChatToolCall 工具调用', link: '/components/chat-tool-call' },
            { text: 'ChatSources 引用来源', link: '/components/chat-sources' },
            { text: 'ChatArtifact 产物卡片', link: '/components/chat-artifact' },
            { text: 'ChatConfirm 操作确认', link: '/components/chat-confirm' },
            { text: 'ChatSuggestions 提示建议', link: '/components/chat-suggestions' },
            { text: 'ChatAttachments 附件列表', link: '/components/chat-attachments' },
            { text: 'ChatContextMeter 上下文用量', link: '/components/chat-context-meter' },
            { text: 'Shimmer 微光文字', link: '/components/shimmer' },
            { text: 'ChatBubble 消息气泡', link: '/components/chat-bubble' },
          ],
        },
        {
          text: '配置',
          items: [
            { text: 'ConfigProvider 全局配置', link: '/components/config-provider' },
            { text: 'ColorMode 颜色模式', link: '/components/color-mode' },
          ],
        },
      ],
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/daidr/dou-ui' }],
  },
  vite: {
    plugins: [demoCode(r('..'), markdown)],
    resolve: {
      // Docs always render the components from source.
      alias: [
        { find: /^dou-ui$/, replacement: r('../../packages/dou-ui/src/index.ts') },
        { find: /^@dou-ui\/theme$/, replacement: r('../../packages/theme/src/index.ts') },
        { find: /^dou-ui\/style\.css$/, replacement: r('../../packages/theme/src/index.css') },
        { find: /^@dou-ui\/icons$/, replacement: r('../../packages/icons/src/index.ts') },
        { find: /^@dou-ui\/icons\/meta$/, replacement: r('../../packages/icons/src/meta.ts') },
        {
          find: /^@dou-ui\/editor\/collaboration$/,
          replacement: r('../../packages/editor/src/collaboration/index.ts'),
        },
        {
          find: /^@dou-ui\/editor\/code$/,
          replacement: r('../../packages/editor/src/code/index.ts'),
        },
        {
          find: /^@dou-ui\/editor\/markdown$/,
          replacement: r('../../packages/editor/src/markdown/index.ts'),
        },
        { find: /^@dou-ui\/editor$/, replacement: r('../../packages/editor/src/index.ts') },
        {
          find: /^@dou-ui\/editor\/style\.css$/,
          replacement: r('../../packages/editor/src/style.css'),
        },
        {
          find: /^@dou-ui\/flow\/whiteboard$/,
          replacement: r('../../packages/flow/src/whiteboard/index.ts'),
        },
        {
          find: /^@dou-ui\/flow\/collaboration$/,
          replacement: r('../../packages/flow/src/collaboration/index.ts'),
        },
        { find: /^@dou-ui\/flow$/, replacement: r('../../packages/flow/src/index.ts') },
        {
          find: /^@dou-ui\/flow\/style\.css$/,
          replacement: r('../../packages/flow/src/style.css'),
        },
        {
          find: /^@dou-ui\/gantt\/scheduler$/,
          replacement: r('../../packages/gantt/src/scheduler/index.ts'),
        },
        {
          find: /^@dou-ui\/gantt\/collaboration$/,
          replacement: r('../../packages/gantt/src/collaboration/index.ts'),
        },
        { find: /^@dou-ui\/chart$/, replacement: r('../../packages/chart/src/index.ts') },
        {
          find: /^@dou-ui\/pivot\/engine$/,
          replacement: r('../../packages/pivot/src/engine/index.ts'),
        },
        {
          find: /^@dou-ui\/pivot\/worker$/,
          replacement: r('../../packages/pivot/src/worker/index.ts'),
        },
        {
          find: /^@dou-ui\/dashboard\/layout$/,
          replacement: r('../../packages/dashboard/src/layout/index.ts'),
        },
        {
          find: /^@dou-ui\/dashboard\/widgets$/,
          replacement: r('../../packages/dashboard/src/widgets/index.ts'),
        },
        {
          find: /^@dou-ui\/dashboard\/chart$/,
          replacement: r('../../packages/dashboard/src/chart/index.ts'),
        },
        {
          find: /^@dou-ui\/dashboard\/pivot$/,
          replacement: r('../../packages/dashboard/src/pivot/index.ts'),
        },
        {
          find: /^@dou-ui\/dashboard\/collaboration$/,
          replacement: r('../../packages/dashboard/src/collaboration/index.ts'),
        },
        { find: /^@dou-ui\/dashboard$/, replacement: r('../../packages/dashboard/src/index.ts') },
        {
          find: /^@dou-ui\/dashboard\/style\.css$/,
          replacement: r('../../packages/dashboard/src/style.css'),
        },
        { find: /^@dou-ui\/pivot$/, replacement: r('../../packages/pivot/src/index.ts') },
        {
          find: /^@dou-ui\/pivot\/style\.css$/,
          replacement: r('../../packages/pivot/src/style.css'),
        },
        {
          find: /^@dou-ui\/chart\/style\.css$/,
          replacement: r('../../packages/chart/src/style.css'),
        },
        { find: /^@dou-ui\/gantt$/, replacement: r('../../packages/gantt/src/index.ts') },
        {
          find: /^@dou-ui\/form-builder\/code$/,
          replacement: r('../../packages/form-builder/src/code/index.ts'),
        },
        {
          find: /^@dou-ui\/form-builder\/collaboration$/,
          replacement: r('../../packages/form-builder/src/collaboration/index.ts'),
        },
        {
          find: /^@dou-ui\/form-builder\/renderer$/,
          replacement: r('../../packages/form-builder/src/renderer/index.ts'),
        },
        {
          find: /^@dou-ui\/form-builder$/,
          replacement: r('../../packages/form-builder/src/index.ts'),
        },
        {
          find: /^@dou-ui\/form-builder\/style\.css$/,
          replacement: r('../../packages/form-builder/src/style.css'),
        },
        {
          find: /^@dou-ui\/gantt\/style\.css$/,
          replacement: r('../../packages/gantt/src/style.css'),
        },
        {
          find: /^@dou-ui\/code\/shiki$/,
          replacement: r('../../packages/code/src/shiki/index.ts'),
        },
        {
          find: /^@dou-ui\/code\/collaboration$/,
          replacement: r('../../packages/code/src/collaboration/index.ts'),
        },
        {
          find: /^@dou-ui\/code\/worker$/,
          replacement: r('../../packages/code/src/worker/index.ts'),
        },
        { find: /^@dou-ui\/code$/, replacement: r('../../packages/code/src/index.ts') },
        {
          find: /^@dou-ui\/code\/style\.css$/,
          replacement: r('../../packages/code/src/style.css'),
        },
        { find: /^@dou-ui\/sheet-xlsx$/, replacement: r('../../packages/sheet-xlsx/src/index.ts') },
        { find: /^@dou-ui\/sheet$/, replacement: r('../../packages/sheet/src/index.ts') },
        {
          find: /^@dou-ui\/sheet\/code$/,
          replacement: r('../../packages/sheet/src/code/index.ts'),
        },
        {
          find: /^@dou-ui\/sheet\/collaboration$/,
          replacement: r('../../packages/sheet/src/collaboration/index.ts'),
        },
        {
          find: /^@dou-ui\/sheet\/formula$/,
          replacement: r('../../packages/sheet/src/formula/index.ts'),
        },
        {
          find: /^@dou-ui\/sheet\/core$/,
          replacement: r('../../packages/sheet/src/core/index.ts'),
        },
        {
          find: /^@dou-ui\/sheet\/style\.css$/,
          replacement: r('../../packages/sheet/src/style.css'),
        },
      ],
    },
  },
})
