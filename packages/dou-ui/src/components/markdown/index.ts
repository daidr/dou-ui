import { withInstall } from '../../utils/install'
import Markdown from './markdown.vue'

export const DouMarkdown = withInstall(Markdown)
export default DouMarkdown

export type * from './markdown'
export { createMarkdownParser, parseMarkdown } from './parser'
export type { MarkdownParser } from './parser'
export { defaultSanitizeUrl } from './url'
export type MarkdownInstance = InstanceType<typeof Markdown>

declare module 'vue' {
  export interface GlobalComponents {
    DouMarkdown: typeof DouMarkdown
  }
}
