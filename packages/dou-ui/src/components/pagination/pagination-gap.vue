<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useId, useTemplateRef } from 'vue'
import { useCoarsePointer } from '../../utils/media'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import { DouVirtualList } from '../virtual-list'
import type { VirtualListExpose } from '../virtual-list/virtual-list'

// The pages an ellipsis stands for, as a list to jump to. Long gaps (page
// 3 to page 9998) render only the rows in view.

defineOptions({ name: 'DouPaginationGap' })

const props = defineProps<{
  from: number
  to: number
  /** Start the cursor next to the current page: at the end for a gap before it. */
  before: boolean
}>()
const emit = defineEmits<{ pick: [page: number] }>()

// rows are taller for fingers, like menu items
const coarse = useCoarsePointer()
const row = computed(() => (coarse.value ? 40 : 32))
const VISIBLE = 8

const ns = useNamespace('pagination')
const { t } = useLocale()
const id = `dou-pagination-gap-${useId()}`

const length = computed(() => Math.max(0, props.to - props.from + 1))
// One number per row; the items only feed the virtual list its count.
const items = computed(() => Array.from({ length: length.value }, (_, index) => props.from + index))
const active = ref(props.before ? length.value - 1 : 0)

const listRef = useTemplateRef<VirtualListExpose>('list')
const boxRef = useTemplateRef<HTMLElement>('box')

function moveTo(index: number) {
  active.value = Math.min(Math.max(0, index), length.value - 1)
  listRef.value?.scrollToIndex(active.value, 'nearest')
}

function onKeydown(event: KeyboardEvent) {
  const page = Math.max(1, VISIBLE - 1)
  const moves: Record<string, number> = {
    ArrowDown: active.value + 1,
    ArrowUp: active.value - 1,
    PageDown: active.value + page,
    PageUp: active.value - page,
    Home: 0,
    End: length.value - 1,
  }
  if (event.key in moves) {
    event.preventDefault()
    moveTo(moves[event.key]!)
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    emit('pick', props.from + active.value)
  }
}

onMounted(async () => {
  await nextTick()
  listRef.value?.scrollToIndex(active.value, 'center')
  boxRef.value?.focus({ preventScroll: true })
})

defineExpose({ focus: () => boxRef.value?.focus({ preventScroll: true }) })
</script>

<template>
  <div
    :id="id"
    ref="box"
    role="listbox"
    tabindex="0"
    :class="ns.e('gap-list')"
    :style="{ '--dou-pagination-gap-row': `${row}px` }"
    :aria-label="t('pagination.gap', { from, to })"
    :aria-activedescendant="`${id}-${from + active}`"
    @keydown="onKeydown"
  >
    <DouVirtualList
      ref="list"
      :items="items"
      :item-size="row"
      :height="Math.min(length, VISIBLE) * row"
    >
      <template #default="{ item, index }">
        <div
          :id="`${id}-${item}`"
          role="option"
          :aria-selected="index === active"
          :class="[ns.e('gap-option'), ns.is('active', index === active)]"
          @mousemove="active = index"
          @click="emit('pick', item)"
        >
          {{ t('pagination.page', { page: item }) }}
        </div>
      </template>
    </DouVirtualList>
  </div>
</template>
