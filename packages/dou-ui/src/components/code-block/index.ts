import { withInstall } from '../../utils/install'
import CodeBlock from './code-block.vue'

export const DouCodeBlock = withInstall(CodeBlock)
export default DouCodeBlock

export type * from './code-block'
export type CodeBlockInstance = InstanceType<typeof CodeBlock>

declare module 'vue' {
  export interface GlobalComponents {
    DouCodeBlock: typeof DouCodeBlock
  }
}
