<script setup lang="ts">
import { useNamespace } from 'dou-ui'
import { computed, getCurrentInstance, type ComputedRef } from 'vue'

/**
 * The chart drawn on the server, as an SVG filling the chart's box. Its own
 * component, after the chart's parts: on the server those are known only
 * once the chart's slot has rendered. In the browser it keeps the
 * server's drawing until the canvas has drawn.
 */
export interface StaticState {
  shown: ComputedRef<boolean>
  size: ComputedRef<{ width: number; height: number }>
  /** The drawing; empty in the browser, which takes the server's. */
  markup: ComputedRef<string>
  /** What the chart shows, read out. */
  label: ComputedRef<string>
}

defineOptions({ name: 'DouChartStatic' })

const { state } = defineProps<{ state: StaticState }>()
const ns = useNamespace('chart')
const { shown, size, label } = state
// taking over the server's page: its drawing, as the browser doesn't draw one
const taken = getCurrentInstance()?.vnode.el
const kept =
  typeof Element !== 'undefined' && taken instanceof Element && taken.matches(`.${ns.e('static')}`)
    ? taken.innerHTML
    : ''
const markup = computed(() => state.markup.value || kept)
</script>

<template>
  <svg
    v-if="shown"
    :class="ns.e('static')"
    xmlns="http://www.w3.org/2000/svg"
    :viewBox="`0 0 ${size.width} ${size.height}`"
    role="img"
    :aria-label="label"
    v-html="markup"
  />
</template>
