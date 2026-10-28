<script setup lang="ts">
import type { AnchorItem } from './anchor'

defineOptions({ name: 'DouAnchorList' })

defineProps<{ items: AnchorItem[]; level: number; active: string }>()
defineEmits<{ pick: [event: MouseEvent, item: AnchorItem] }>()
defineSlots<{
  item?: (props: { item: AnchorItem; level: number; active: boolean }) => unknown
}>()
</script>

<template>
  <ul :class="['dou-anchor__list', { 'is-nested': level > 0 }]">
    <li v-for="item in items" :key="item.href" class="dou-anchor__item">
      <a
        :href="item.href"
        :class="['dou-anchor__link', { 'is-active': item.href === active }]"
        :style="{ '--dou-anchor-level': level }"
        :aria-current="item.href === active ? 'location' : undefined"
        @click="$emit('pick', $event, item)"
      >
        <slot name="item" :item="item" :level="level" :active="item.href === active">
          {{ item.title }}
        </slot>
      </a>
      <DouAnchorList
        v-if="item.children?.length"
        :items="item.children"
        :level="level + 1"
        :active="active"
        @pick="(event, child) => $emit('pick', event, child)"
      >
        <template v-if="$slots.item" #item="slotProps">
          <slot name="item" v-bind="slotProps" />
        </template>
      </DouAnchorList>
    </li>
  </ul>
</template>
