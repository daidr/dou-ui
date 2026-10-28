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
          text: '数据展示',
          items: [{ text: 'Tag 标签', link: '/components/tag' }],
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
