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
          ],
        },
      ],
      '/components/': [
        {
          text: '基础',
          items: [{ text: 'Button 按钮', link: '/components/button' }],
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
