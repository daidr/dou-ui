import { defineNodeType } from '../core/node-types'
import { drawCard } from '../export/draw'
import type { Component } from 'vue'
import type { FlowPortSpec } from '../core/model'
import DefaultNode from './default-node.vue'

const px = (value: string, fallback: number) => Number.parseFloat(value) || fallback

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
  draw(node, draw) {
    const data = node.data ?? {}
    const t = draw.messages
    const parts = [drawCard(draw)]
    const head = draw.style('dou-flow-default-node__head')
    const headHeight = px(head.minHeight, 44)
    const inputs = data.inputs ?? []
    const outputs = data.outputs ?? []
    const inline =
      inputs.length <= 1 && outputs.length <= 1 && ![...inputs, ...outputs].some((p) => p.label)
    let left = 12
    let right = draw.width - 12
    if (data.icon) {
      const box = draw.style('dou-flow-default-node__icon')
      const y = (headHeight - 24) / 2
      parts.push(
        `<rect x="${left}" y="${y}" width="24" height="24" rx="${px(box.borderTopLeftRadius, 6)}" fill="${draw.color(box.backgroundColor)}"/>`,
        draw.icon(
          data.icon,
          { x: left + 4, y: y + 4, width: 16, height: 16 },
          draw.color(box.color),
        ),
      )
      left += 32
    }
    if (data.status) {
      const dot = draw.style(`dou-flow-default-node__status is-${data.status}`)
      parts.push(
        `<circle cx="${right - 4}" cy="${headHeight / 2}" r="4" fill="${draw.color(dot.backgroundColor)}"/>`,
      )
      right -= 16
    }
    const title = draw.style('dou-flow-default-node__title')
    parts.push(
      draw.text(
        data.label ?? '',
        { x: left, y: 0, width: Math.max(0, right - left), height: headHeight },
        { weight: title.fontWeight, valign: 'middle', nowrap: true, lineHeight: headHeight },
      ),
    )
    let y = headHeight
    if (data.description) {
      const text = draw.style('dou-flow-default-node__description')
      const lineHeight = px(text.lineHeight, 20)
      const width = draw.width - 24
      const lines = draw.text(
        data.description,
        { x: 12, y: y - 4, width, height: 1e6 },
        {
          size: px(text.fontSize, 12),
          lineHeight,
          color: draw.color(text.color),
        },
      )
      parts.push(lines)
      y += (lines.match(/<tspan/g)?.length ?? 1) * lineHeight + 12 - 4
    }
    if (!inline) {
      const rows = draw.style('dou-flow-default-node__ports')
      const row = draw.style('dou-flow-default-node__row')
      parts.push(
        `<rect x="1" y="${y}" width="${draw.width - 2}" height="1" fill="${draw.color(rows.borderTopColor)}"/>`,
      )
      y += 1 + px(rows.paddingTop, 3)
      const height = px(row.height, 28)
      const size = px(row.fontSize, 12)
      const color = draw.color(row.color)
      const half = (draw.width - 24) / 2
      for (let i = 0; i < Math.max(inputs.length, outputs.length); i++) {
        const input = inputs[i]
        const output = outputs[i]
        const box = (x: number) => ({ x, y: y + i * height, width: half - 4, height })
        const options = { size, color, valign: 'middle' as const, nowrap: true, lineHeight: height }
        if (input) parts.push(draw.text(input.label ?? t.input, box(12), options))
        if (output)
          parts.push(
            draw.text(output.label ?? t.output, box(draw.width / 2 + 4), {
              ...options,
              align: 'end',
            }),
          )
      }
    }
    for (const id of draw.ports.keys()) parts.push(draw.port(id))
    return parts.join('')
  },
})
