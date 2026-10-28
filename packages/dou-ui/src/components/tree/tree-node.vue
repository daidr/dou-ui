<script setup lang="ts">
import { ChevronRightIcon } from '@dou-ui/icons'
import { computed, inject } from 'vue'
import { DouSpinner } from '../spinner'
import { treeContextKey } from './tree'
import type { TreeNodeSlotProps, TreeRow } from './tree'

defineOptions({ name: 'DouTreeNode' })

const props = defineProps<{ row: TreeRow }>()
const slots = defineSlots<{ default?: (props: TreeNodeSlotProps) => unknown }>()
const tree = inject(treeContextKey)!
const { ns } = tree

const key = computed(() => props.row.key)
const node = computed(() => props.row.node)
const selected = computed(() => tree.selectedKey.value === key.value)
const checked = computed(() => tree.isChecked(key.value))
const half = computed(() => !checked.value && tree.isHalf(key.value))
const loading = computed(() => tree.loading.has(key.value))

const classes = computed(() => [
  ns.e('node'),
  ns.is('active', tree.activeKey.value === key.value),
  ns.is('selected', selected.value),
  ns.is('disabled', !!node.value.disabled),
  ns.is('expanded', props.row.expanded),
])
</script>

<template>
  <div
    :id="tree.rowId(key)"
    role="treeitem"
    :class="classes"
    :style="{ '--dou-tree-level': row.level - 1 }"
    :aria-level="row.level"
    :aria-setsize="row.setSize"
    :aria-posinset="row.position"
    :aria-expanded="row.expandable ? row.expanded : undefined"
    :aria-selected="tree.props.selectable ? selected : undefined"
    :aria-checked="tree.props.checkable ? (half ? 'mixed' : checked) : undefined"
    :aria-disabled="node.disabled || undefined"
    :aria-busy="loading || undefined"
    @click="tree.onRowClick(row)"
  >
    <span v-if="row.level > 1" :class="ns.e('indent')" aria-hidden="true" />
    <span
      :class="[ns.e('toggle'), ns.is('leaf', !row.expandable)]"
      aria-hidden="true"
      @click.stop="row.expandable ? tree.toggle(node) : tree.onRowClick(row)"
    >
      <DouSpinner v-if="loading" :size="12" />
      <ChevronRightIcon v-else-if="row.expandable" />
    </span>
    <span
      v-if="tree.props.checkable"
      :class="[ns.e('checkbox'), ns.is('checked', checked), ns.is('indeterminate', half)]"
      aria-hidden="true"
      @click.stop="tree.setChecked(node, !checked)"
    >
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
        <path v-if="half" d="M4.5 8h7" stroke-linecap="round" />
        <path v-else d="M4 8.5l2.5 2.5L12 5.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </span>
    <span :class="ns.e('label')">
      <slot
        v-if="slots.default"
        :node="node"
        :level="row.level"
        :expanded="row.expanded"
        :selected="selected"
        :checked="checked"
        :indeterminate="half"
      />
      <template v-else>
        <template v-for="(part, at) in tree.parts(node)" :key="at">
          <mark v-if="part.match" :class="ns.e('match')">{{ part.text }}</mark>
          <template v-else>{{ part.text }}</template>
        </template>
      </template>
    </span>
  </div>
</template>
