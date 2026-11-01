<script setup lang="ts">
import { useNamespace } from 'dou-ui'
import type { ComputedRef } from 'vue'

/** The chart's data as a table, shown in its place. */
export interface TableState {
  shown: ComputedRef<boolean>
  caption: ComputedRef<string>
  head: ComputedRef<string[]>
  /** Each row's cells; the first is the row's head. */
  rows: ComputedRef<string[][]>
  /** A line under a table cut short. */
  more: ComputedRef<string>
  /** Escape in the table: back to the chart. */
  close: () => void
}

defineOptions({ name: 'DouChartTable' })

const { state } = defineProps<{ state: TableState }>()
const ns = useNamespace('chart')
const { shown, caption, head, rows, more } = state

function onKeydown(event: KeyboardEvent) {
  // the chart's own keys are for its tooltip
  event.stopPropagation()
  if (event.key === 'Escape') state.close()
}
</script>

<template>
  <!-- scrolls on its own, so it can take focus and be scrolled with the keys -->
  <!-- oxlint-disable-next-line vuejs-accessibility/no-noninteractive-tabindex -->
  <div
    v-if="shown"
    :class="ns.e('table')"
    tabindex="0"
    @keydown="onKeydown"
    @pointerdown.stop
    @pointermove.stop
    @wheel.stop
    @dblclick.stop
  >
    <table>
      <caption>
        {{
          caption
        }}
      </caption>
      <thead>
        <tr>
          <th v-for="(cell, i) in head" :key="i" scope="col">{{ cell }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, r) in rows" :key="r">
          <template v-for="(cell, i) in row" :key="i">
            <th v-if="i === 0" scope="row">{{ cell }}</th>
            <td v-else>{{ cell }}</td>
          </template>
        </tr>
      </tbody>
    </table>
    <p v-if="more" :class="ns.e('table-more')">{{ more }}</p>
  </div>
</template>
