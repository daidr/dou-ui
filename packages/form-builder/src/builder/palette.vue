<script setup lang="ts">
import { computed, ref } from 'vue'
import { DouInput } from 'dou-ui'
import { SearchIcon } from '@dou-ui/icons'
import type { FormFieldType } from '../fields/define'
import { formatMessage } from '../locale'
import { useBuilderState } from './context'
import { containerTypes, groupOf, iconOf, labelOf, paletteGroups } from './settings'

defineOptions({ name: 'DouFormBuilderPalette' })

const state = useBuilderState()
const query = ref('')

interface Entry {
  type: string
  label: string
  icon: FormFieldType['icon']
}

const groups = computed(() => {
  const messages = state.messages
  const types = state.fields as Map<string, FormFieldType>
  const byGroup = new Map<string, Entry[]>()
  const add = (type: string, spec?: FormFieldType) => {
    const group = groupOf(type, spec)
    const list = byGroup.get(group) ?? []
    list.push({ type, label: labelOf(type, spec, messages), icon: iconOf(type, spec) })
    byGroup.set(group, list)
  }
  for (const [type, spec] of types) add(type, spec)
  for (const type of containerTypes) add(type)

  const search = query.value.trim().toLowerCase()
  const order = [
    ...paletteGroups,
    ...[...byGroup.keys()].filter((key) => !paletteGroups.includes(key)),
  ]
  return order
    .map((key) => ({
      key,
      label: messages.groups[key] ?? key,
      entries: (byGroup.get(key) ?? []).filter(
        (entry) =>
          !search ||
          entry.label.toLowerCase().includes(search) ||
          entry.type.toLowerCase().includes(search),
      ),
    }))
    .filter((group) => group.entries.length)
})
</script>

<template>
  <div class="dou-form-builder__palette">
    <div class="dou-form-builder__palette-search">
      <DouInput
        v-model="query"
        size="sm"
        clearable
        :placeholder="state.messages.palette.search"
        :aria-label="state.messages.palette.search"
      >
        <template #prefix><SearchIcon /></template>
      </DouInput>
    </div>
    <div class="dou-form-builder__palette-body">
      <section
        v-for="group in groups"
        :key="group.key"
        class="dou-form-builder__palette-group"
        :aria-label="group.label"
      >
        <div class="dou-form-builder__palette-heading" aria-hidden="true">{{ group.label }}</div>
        <div class="dou-form-builder__palette-items">
          <button
            v-for="entry in group.entries"
            :key="entry.type"
            type="button"
            class="dou-form-builder__palette-item"
            :data-type="entry.type"
            :aria-label="formatMessage(state.messages.palette.add, { label: entry.label })"
            @click="!state.dragger.value?.swallowClick() && state.add(entry.type)"
            @pointerdown="state.dragger.value?.pressType($event, entry.type, entry.label)"
          >
            <component :is="entry.icon" class="dou-form-builder__palette-icon" />
            <span class="dou-form-builder__palette-label">{{ entry.label }}</span>
          </button>
        </div>
      </section>
      <div v-if="!groups.length" class="dou-form-builder__palette-empty">
        {{ state.messages.palette.empty }}
      </div>
    </div>
  </div>
</template>
