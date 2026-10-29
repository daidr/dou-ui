import { withInstall } from '../../utils/install'
import Highlight from './highlight.vue'

export const DouHighlight = withInstall(Highlight)
export default DouHighlight

export { splitHighlight } from '../../utils/highlight'
export type { HighlightOptions, HighlightPart } from '../../utils/highlight'
export type * from './highlight'
export type HighlightInstance = InstanceType<typeof Highlight>

declare module 'vue' {
  export interface GlobalComponents {
    DouHighlight: typeof DouHighlight
  }
}
