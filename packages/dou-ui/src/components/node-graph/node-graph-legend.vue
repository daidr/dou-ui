<script setup lang="ts">
import { FlagIcon } from '@dou-ui/icons'
import { computed } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import type { NodeGraphLegendItem, NodeGraphLegendProps, GraphNodeStatus } from './node-graph'

defineOptions({ name: 'DouNodeGraphLegend' })

const props = defineProps<NodeGraphLegendProps>()

const ns = useNamespace('node-graph-legend')
const { t } = useLocale()

const statuses: GraphNodeStatus[] = ['pending', 'running', 'done', 'blocked', 'error']

const list = computed<NodeGraphLegendItem[]>(() => {
  if (props.items) return props.items
  const nodes = props.nodes
  const used = (test: (node: NonNullable<typeof nodes>[number]) => boolean) =>
    !nodes || nodes.some(test)
  const items: NodeGraphLegendItem[] = []
  if (used((n) => n.kind === 'milestone')) {
    items.push({ type: 'kind', value: 'task', label: t('nodeGraph.kind.task') })
    items.push({ type: 'kind', value: 'milestone', label: t('nodeGraph.kind.milestone') })
  }
  for (const status of statuses) {
    if (used((n) => (n.status ?? 'pending') === status))
      items.push({ type: 'status', value: status, label: t(`nodeGraph.status.${status}`) })
  }
  if (used((n) => !!n.incomplete))
    items.push({ type: 'incomplete', label: t('nodeGraph.incomplete') })
  if (used((n) => n.progress != null))
    items.push({ type: 'progress', label: t('nodeGraph.progress') })
  return items
})
</script>

<template>
  <div :class="ns.b()">
    <div :class="ns.e('title')">{{ title ?? t('nodeGraph.legend') }}</div>
    <ul :class="ns.e('list')">
      <li v-for="item in list" :key="`${item.type}-${item.value}`" :class="ns.e('item')">
        <span :class="ns.e('swatch')" aria-hidden="true">
          <span
            v-if="item.type === 'kind' && item.value === 'milestone'"
            class="dou-node-graph__milestone is-pending"
          >
            <FlagIcon />
          </span>
          <span v-else-if="item.type === 'kind'" :class="ns.e('task')" />
          <span
            v-else-if="item.type === 'status'"
            :class="['dou-node-graph__dot', `is-${item.value}`]"
          />
          <span v-else-if="item.type === 'incomplete'" :class="ns.e('incomplete')" />
          <span v-else :class="ns.e('progress')" />
        </span>
        <span :class="ns.e('label')">{{ item.label }}</span>
      </li>
    </ul>
  </div>
</template>
