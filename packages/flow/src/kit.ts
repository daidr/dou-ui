import { defaultNode } from './components/default-node'
import { defineFlowExtension, type FlowExtension } from './core/extension'

/**
 * The editor's built-in parts as extensions: for now the default node
 * type. Pass it along with your own extensions, e.g.
 * `[flowKit(), aiNodes]`; without `extensions` the editor uses it alone.
 */
export function flowKit(): FlowExtension[] {
  return [defineFlowExtension({ name: 'default-node', nodeTypes: [defaultNode] })]
}
