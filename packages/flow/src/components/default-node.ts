import { defineNodeType } from '../core/node-types'
import type { Component } from 'vue'
import type { FlowPortSpec } from '../core/model'
import DefaultNode from './default-node.vue'

export interface DefaultNodeData {
  [key: string]: unknown
  /** The title. */
  label?: string
  description?: string
  icon?: Component
  status?: 'wait' | 'process' | 'finish' | 'error'
  inputs?: Omit<FlowPortSpec, 'kind'>[]
  outputs?: Omit<FlowPortSpec, 'kind'>[]
}

/**
 * A titled card: an optional icon, a status dot and a description, then a
 * row per port, inputs on the left and outputs on the right. A single
 * unnamed input and output sit on the title row.
 */
export const defaultNode = defineNodeType<DefaultNodeData>({
  type: 'default',
  component: DefaultNode,
  ports: (node) => [
    ...(node.data?.inputs ?? []).map((port) => ({ ...port, kind: 'input' as const })),
    ...(node.data?.outputs ?? []).map((port) => ({ ...port, kind: 'output' as const })),
  ],
  defaults: () => ({ label: '' }),
})
