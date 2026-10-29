import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitepress'
import type { MarkdownOptions } from 'vitepress'
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
      { text: '组件', link: '/components/button' },
      { text: '图标', link: '/icons/' },
    ],
    sidebar: {
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
      '/guide/': [
        {
          text: '指南',
          items: [
            { text: '设计原则', link: '/guide/philosophy' },
            { text: '视觉语言', link: '/guide/visual-language' },
            { text: '快速开始', link: '/guide/getting-started' },
            { text: '主题与 Token', link: '/guide/theming' },
            { text: '浮层', link: '/guide/overlays' },
            { text: '路线图', link: '/guide/roadmap' },
          ],
        },
      ],
      '/components/': [
        {
          text: '基础',
          items: [
            { text: 'Button 按钮', link: '/components/button' },
            { text: 'Icon 图标', link: '/components/icon' },
            { text: 'Text 文本', link: '/components/text' },
            { text: 'Link 链接', link: '/components/link' },
            { text: 'Typography 排版', link: '/components/typography' },
            { text: 'CopyButton 复制按钮', link: '/components/copy-button' },
          ],
        },
        {
          text: '布局',
          items: [
            { text: 'Divider 分割线', link: '/components/divider' },
            { text: 'Space 间距', link: '/components/space' },
            { text: 'Grid 栅格', link: '/components/grid' },
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
            { text: 'ColorPicker 颜色选择', link: '/components/color-picker' },
            { text: 'Transfer 穿梭框', link: '/components/transfer' },
            { text: 'SegmentedControl 分段控制器', link: '/components/segmented-control' },
            { text: 'Upload 上传', link: '/components/upload' },
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
          ],
        },
        {
          text: '反馈',
          items: [
            { text: 'Alert 提示条', link: '/components/alert' },
            { text: 'Toast 轻提示', link: '/components/toast' },
            { text: 'Spinner 加载', link: '/components/spinner' },
            { text: 'Loading 加载遮罩', link: '/components/loading' },
            { text: 'Progress 进度条', link: '/components/progress' },
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
            { text: 'Badge 徽标', link: '/components/badge' },
            { text: 'Tag 标签', link: '/components/tag' },
            { text: 'Kbd 键盘按键', link: '/components/kbd' },
            { text: 'Empty 空状态', link: '/components/empty' },
            { text: 'Statistic 统计数值', link: '/components/statistic' },
            { text: 'Countdown 倒计时', link: '/components/countdown' },
            { text: 'Image 图片', link: '/components/image' },
            { text: 'QRCode 二维码', link: '/components/qrcode' },
            { text: 'Descriptions 描述列表', link: '/components/descriptions' },
            { text: 'Collapse 折叠面板', link: '/components/collapse' },
            { text: 'Timeline 时间线', link: '/components/timeline' },
            { text: 'CalendarView 日历视图', link: '/components/calendar-view' },
            { text: 'Table 表格', link: '/components/table' },
            { text: 'Tree 树', link: '/components/tree' },
            { text: 'VirtualList 虚拟列表', link: '/components/virtual-list' },
          ],
        },
        {
          text: '导航',
          items: [
            { text: 'Menu 导航菜单', link: '/components/menu' },
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
      ],
    },
  },
})
