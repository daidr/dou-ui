import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitepress'

const r = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  lang: 'zh-CN',
  title: 'DouUI',
  description: '一个为自己打造的 Vue 3 组件库',
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: '指南', link: '/guide/philosophy' },
      { text: '组件', link: '/components/button' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: '指南',
          items: [
            { text: '设计哲学', link: '/guide/philosophy' },
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
          ],
        },
        {
          text: '布局',
          items: [
            { text: 'Divider 分割线', link: '/components/divider' },
            { text: 'Space 间距', link: '/components/space' },
          ],
        },
        {
          text: '表单',
          items: [
            { text: 'Input 输入框', link: '/components/input' },
            { text: 'Textarea 多行输入', link: '/components/textarea' },
            { text: 'InputNumber 数字输入', link: '/components/input-number' },
            { text: 'Checkbox 多选框', link: '/components/checkbox' },
            { text: 'Radio 单选框', link: '/components/radio' },
            { text: 'Switch 开关', link: '/components/switch' },
            { text: 'Slider 滑块', link: '/components/slider' },
            { text: 'Select 选择器', link: '/components/select' },
            { text: 'SegmentedControl 分段控制器', link: '/components/segmented-control' },
            { text: 'Form 表单', link: '/components/form' },
          ],
        },
        {
          text: '浮层',
          items: [
            { text: 'Tooltip 文字提示', link: '/components/tooltip' },
            { text: 'Popover 气泡卡片', link: '/components/popover' },
            { text: 'Dropdown 下拉菜单', link: '/components/dropdown' },
            { text: 'Dialog 对话框', link: '/components/dialog' },
            { text: 'Drawer 抽屉', link: '/components/drawer' },
          ],
        },
        {
          text: '反馈',
          items: [
            { text: 'Alert 提示条', link: '/components/alert' },
            { text: 'Toast 轻提示', link: '/components/toast' },
            { text: 'Spinner 加载', link: '/components/spinner' },
            { text: 'Progress 进度条', link: '/components/progress' },
            { text: 'Skeleton 骨架屏', link: '/components/skeleton' },
          ],
        },
        {
          text: '数据展示',
          items: [
            { text: 'Card 卡片', link: '/components/card' },
            { text: 'Avatar 头像', link: '/components/avatar' },
            { text: 'Badge 徽标', link: '/components/badge' },
            { text: 'Tag 标签', link: '/components/tag' },
            { text: 'Kbd 键盘按键', link: '/components/kbd' },
            { text: 'Empty 空状态', link: '/components/empty' },
            { text: 'Descriptions 描述列表', link: '/components/descriptions' },
            { text: 'Table 表格', link: '/components/table' },
          ],
        },
        {
          text: '导航',
          items: [
            { text: 'Tabs 标签页', link: '/components/tabs' },
            { text: 'Breadcrumb 面包屑', link: '/components/breadcrumb' },
            { text: 'Pagination 分页', link: '/components/pagination' },
          ],
        },
        {
          text: '配置',
          items: [{ text: 'ConfigProvider 全局配置', link: '/components/config-provider' }],
        },
      ],
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/daidr/dou-ui' }],
  },
  vite: {
    resolve: {
      // Docs always render the components from source.
      alias: [
        { find: /^dou-ui$/, replacement: r('../../packages/dou-ui/src/index.ts') },
        { find: /^@dou-ui\/theme$/, replacement: r('../../packages/theme/src/index.ts') },
        { find: /^dou-ui\/style\.css$/, replacement: r('../../packages/theme/src/index.css') },
      ],
    },
  },
})
