<script setup lang="ts">
import { computed, ref } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import type {
  BreadcrumbEmits,
  BreadcrumbItem,
  BreadcrumbProps,
  BreadcrumbSlots,
} from './breadcrumb'

defineOptions({ name: 'DouBreadcrumb' })

const props = withDefaults(defineProps<BreadcrumbProps>(), { separator: '/' })
const emit = defineEmits<BreadcrumbEmits>()
defineSlots<BreadcrumbSlots>()

const ns = useNamespace('breadcrumb')
const { t } = useLocale()

const expanded = ref(false)

type Entry = { item: BreadcrumbItem; index: number } | { ellipsis: true }

const entries = computed<Entry[]>(() => {
  const all = props.items.map((item, index) => ({ item, index }))
  const max = props.maxItems
  if (expanded.value || max === undefined || max < 2 || all.length <= max) return all
  return [all[0]!, { ellipsis: true }, ...all.slice(all.length - (max - 1))]
})

const lastIndex = computed(() => props.items.length - 1)

function onClick(item: BreadcrumbItem, index: number, event: MouseEvent) {
  if (item.disabled) {
    event.preventDefault()
    return
  }
  emit('navigate', item, index, event)
}
</script>

<template>
  <nav :class="ns.b()" :aria-label="t('breadcrumb.label')">
    <ol :class="ns.e('list')">
      <li
        v-for="(entry, position) in entries"
        :key="'ellipsis' in entry ? 'ellipsis' : entry.index"
        :class="ns.e('item')"
      >
        <span v-if="position > 0" :class="ns.e('separator')" aria-hidden="true">
          <slot name="separator">{{ separator }}</slot>
        </span>
        <button
          v-if="'ellipsis' in entry"
          type="button"
          :class="[ns.e('link'), ns.e('ellipsis')]"
          :aria-label="t('breadcrumb.expand')"
          @click="expanded = true"
        >
          …
        </button>
        <slot
          v-else
          name="item"
          :item="entry.item"
          :index="entry.index"
          :current="entry.index === lastIndex"
        >
          <span
            v-if="entry.index === lastIndex"
            :class="[ns.e('link'), ns.is('current')]"
            aria-current="page"
          >
            {{ entry.item.label }}
          </span>
          <a
            v-else-if="entry.item.href && !entry.item.disabled"
            :class="ns.e('link')"
            :href="entry.item.href"
            @click="onClick(entry.item, entry.index, $event)"
          >
            {{ entry.item.label }}
          </a>
          <button
            v-else
            type="button"
            :class="[ns.e('link'), ns.is('disabled', !!entry.item.disabled)]"
            :disabled="entry.item.disabled"
            @click="onClick(entry.item, entry.index, $event)"
          >
            {{ entry.item.label }}
          </button>
        </slot>
      </li>
    </ol>
  </nav>
</template>
