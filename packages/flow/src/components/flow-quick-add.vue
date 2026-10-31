<script setup lang="ts">
import { DouCommand, useFloating, useLayer, useZIndex, type CommandItem } from 'dou-ui'
import { computed, nextTick, shallowRef, useTemplateRef, watch } from 'vue'
import { useFlowEditor } from '../context'
import type { Point } from '../core/model'
import type { NodeTypeSpec } from '../core/node-types'

const props = defineProps<{
  /** Where the edge was dropped, on screen, and the types offered. */
  state: { client: Point; types: NodeTypeSpec[]; touch: boolean } | null
}>()
const emit = defineEmits<{ choose: [type: string | null] }>()
const slots = defineSlots<{
  /** Replaces the search list. */
  default?: (props: {
    types: NodeTypeSpec[]
    choose: (type: string) => void
    close: () => void
  }) => unknown
}>()

const { messages } = useFlowEditor()
const panel = useTemplateRef<HTMLElement>('panel')
const command = useTemplateRef<InstanceType<typeof DouCommand>>('command')
const open = computed(() => !!props.state)
const query = shallowRef('')

const items = computed<CommandItem[]>(() =>
  (props.state?.types ?? []).map((spec) => ({
    value: spec.type,
    label: spec.palette!.label,
    group: spec.palette!.group,
    description: spec.palette!.description,
    keywords: spec.palette!.keywords,
    icon: spec.palette!.icon,
  })),
)

// Hangs off the point where the edge was dropped.
const anchor = {
  getBoundingClientRect() {
    const at = props.state?.client
    return at ? new DOMRect(at.x, at.y, 0, 0) : new DOMRect()
  },
}
const { style, placement, update } = useFloating(() => (open.value ? anchor : null), panel, {
  open,
  placement: 'bottom-start',
  offset: 6,
})
const { next } = useZIndex()
const zIndex = shallowRef(0)
useLayer({
  open,
  elements: () => [panel.value],
  onOutside: () => emit('choose', null),
  onEscape: () => emit('choose', null),
})

/** A label cut into the matched letters and the rest. */
function parts(text: string, indices: number[]) {
  const hit = new Set(indices)
  const out: { text: string; match: boolean }[] = []
  for (let i = 0; i < text.length; i++) {
    const match = hit.has(i)
    const last = out[out.length - 1]
    if (last && last.match === match) last.text += text[i]
    else out.push({ text: text[i]!, match })
  }
  return out
}

watch(open, (value) => {
  if (!value) return
  query.value = ''
  zIndex.value = next()
  void nextTick(() => {
    update()
    // A phone's keyboard would cover the list: search only when typing is likely.
    if (!props.state?.touch) command.value?.focus()
  })
})
</script>

<template>
  <Teleport to="body">
    <Transition name="dou-floating">
      <div
        v-if="state"
        ref="panel"
        class="dou-dropdown dou-floating dou-flow-quick-add"
        :class="{ 'is-custom': slots.default }"
        :style="[style, { zIndex }]"
        :data-placement="placement"
      >
        <slot
          v-if="slots.default"
          :types="state.types"
          :choose="(type: string) => emit('choose', type)"
          :close="() => emit('choose', null)"
        />
        <DouCommand
          v-else
          ref="command"
          v-model:query="query"
          :items="items"
          :placeholder="messages.search"
          :aria-label="messages.search"
          :empty-text="messages.noTypes"
          :max-height="280"
          @select="emit('choose', String($event.value))"
        >
          <template #item="{ item, indices }">
            <span class="dou-flow-quick-add__icon">
              <component :is="item.icon" v-if="item.icon" />
            </span>
            <span class="dou-command__label">
              <template v-for="(part, at) in parts(item.label, indices)" :key="at">
                <mark v-if="part.match" class="dou-command__match">{{ part.text }}</mark>
                <template v-else>{{ part.text }}</template>
              </template>
            </span>
            <span v-if="item.description" class="dou-command__description">
              {{ item.description }}
            </span>
          </template>
        </DouCommand>
      </div>
    </Transition>
  </Teleport>
</template>
