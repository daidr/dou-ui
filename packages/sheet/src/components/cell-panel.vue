<script setup lang="ts">
import { useFloating, useZIndex } from 'dou-ui'
import { computed, nextTick, shallowRef, useTemplateRef, watch } from 'vue'
import type { SheetCellPanelExpose, SheetResolvedType } from '../core/cell-type'
import type { SheetValue } from '../core/model'

/*
 * The floating box a cell type's panel sits in, under the cell being
 * edited. The editor keeps focus; keys reach the panel through `onKey`.
 */

const props = defineProps<{
  resolved: SheetResolvedType
  value: SheetValue
  text: string
  typed: boolean
  /** The editor, which the panel hangs under. */
  anchor: HTMLElement | undefined
}>()
const emit = defineEmits<{ pick: [value: SheetValue] }>()

const box = useTemplateRef<HTMLElement>('box')
const inner = shallowRef<(SheetCellPanelExpose & { activeId?: string | null }) | null>(null)

const open = computed(() => !!props.anchor)
const { style, placement, update } = useFloating(() => props.anchor, box, {
  open,
  placement: 'bottom-start',
  offset: 4,
})
const { next } = useZIndex()
const zIndex = next()
// the editor grows as text is typed; follow it
watch(
  () => props.text,
  () => void nextTick(update),
)

defineExpose({
  onKey: (event: KeyboardEvent) => inner.value?.onKey?.(event) ?? false,
  activeId: computed(() => inner.value?.activeId ?? null),
})
</script>

<template>
  <Transition name="dou-floating" appear>
    <div
      ref="box"
      class="dou-dropdown dou-floating dou-sheet__panel"
      :style="[style, { zIndex }]"
      :data-placement="placement"
      @mousedown.prevent
    >
      <component
        :is="resolved.definition.panel"
        :ref="(el: unknown) => (inner = el as typeof inner)"
        :value="value"
        :text="text"
        :typed="typed"
        :setup="resolved.setup"
        @pick="(v: SheetValue) => emit('pick', v)"
      />
    </div>
  </Transition>
</template>
