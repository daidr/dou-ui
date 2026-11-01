<script setup lang="ts">
import { CheckIcon } from '@dou-ui/icons'
import { DouButton, DouDropdown, DouDropdownItem, DouDropdownSub, DouTooltip } from 'dou-ui'
import { computed } from 'vue'
import { useEditor, useToolbarMenu } from '../../editor'
import { setHighlight, setTextColor, textColors, type TextColor } from './palette'

const { view, state, messages } = useEditor()

/** The color the whole selection has, `null` for none, `'mixed'` for several. */
function current(name: string): string | null {
  const now = state.value
  const type = now?.schema.marks[name]
  if (!now || !type) return null
  const { from, to } = now.selection
  let value: string | null | undefined
  now.doc.nodesBetween(from, to, (node) => {
    if (!node.isText || value === 'mixed') return
    const found = (type.isInSet(node.marks)?.attrs.value as string | undefined) ?? null
    value = value === undefined || value === found ? found : 'mixed'
  })
  return value ?? null
}

/** The swatch shows one color; several show as the default. */
const shown = (value: string | null) => (value && value !== 'mixed' ? value : undefined)

const color = computed(() => current('textColor'))
const highlight = computed(() => current('highlight'))

function apply(kind: 'text' | 'background', value: TextColor | null) {
  const target = view.value
  if (!target) return
  ;(kind === 'text' ? setTextColor : setHighlight)(value)(target.state, target.dispatch)
  target.focus()
}

const open = useToolbarMenu()
</script>

<template>
  <DouTooltip :content="messages.colors.label" :disabled="open" placement="bottom">
    <span class="dou-editor-bubble__trigger">
      <DouDropdown v-model:open="open" placement="bottom-start" class="dou-editor-menu">
        <DouButton
          size="sm"
          variant="ghost"
          class="dou-editor-colors__button"
          :aria-label="messages.colors.label"
        >
          <template #leading>
            <span
              class="dou-editor-colors__swatch"
              :data-color="shown(color)"
              :data-highlight="shown(highlight)"
              aria-hidden="true"
              ><span class="dou-editor-colors__letter">A</span></span
            >
          </template>
        </DouButton>
        <template #menu>
          <DouDropdownSub
            v-for="kind in ['text', 'background'] as const"
            :key="kind"
            :title="kind === 'text' ? messages.colors.text : messages.colors.background"
          >
            <DouDropdownItem @click="apply(kind, null)">
              <template #prefix>
                <span class="dou-editor-colors__swatch" aria-hidden="true"
                  ><span class="dou-editor-colors__letter">A</span></span
                >
              </template>
              {{ messages.colors.none }}
              <template v-if="!(kind === 'text' ? color : highlight)" #suffix
                ><CheckIcon
              /></template>
            </DouDropdownItem>
            <DouDropdownItem v-for="name in textColors" :key="name" @click="apply(kind, name)">
              <template #prefix>
                <span
                  class="dou-editor-colors__swatch"
                  :data-color="kind === 'text' ? name : undefined"
                  :data-highlight="kind === 'background' ? name : undefined"
                  aria-hidden="true"
                  ><span class="dou-editor-colors__letter">A</span></span
                >
              </template>
              {{ messages.colors.names[name] }}
              <template v-if="(kind === 'text' ? color : highlight) === name" #suffix>
                <CheckIcon />
              </template>
            </DouDropdownItem>
          </DouDropdownSub>
        </template>
      </DouDropdown>
    </span>
  </DouTooltip>
</template>
