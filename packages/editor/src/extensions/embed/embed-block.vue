<script setup lang="ts">
import { AppWindowIcon, LinkIcon } from '@dou-ui/icons'
import { DouButton, DouInput } from 'dou-ui'
import { computed, shallowRef } from 'vue'
import type { BlockProps } from '../../core/model'
import { useEditor } from '../../editor'
import { frameAllow, frameSandbox, ratioOf, type EmbedTarget } from './targets'

const props = defineProps<{
  block: { id: string; type: string; props: BlockProps }
  updateProps: (props: BlockProps) => void
  selected: boolean
  editable: boolean
  resolve: (url: string) => EmbedTarget | null
}>()

const { messages } = useEditor()
const text = computed(() => messages.value.embed)

const link = computed(() => String(props.block.props.src ?? ''))
const target = computed(() => (link.value ? props.resolve(link.value) : null))
const caption = computed(() => String(props.block.props.caption ?? ''))
const frameStyle = computed(() => {
  const value = target.value
  if (!value) return undefined
  return value.height ? { height: `${value.height}px` } : { aspectRatio: String(ratioOf(value)) }
})

const url = shallowRef('')
const invalid = shallowRef(false)

function apply() {
  const value = url.value.trim()
  if (!value) return
  if (!props.resolve(value)) {
    invalid.value = true
    return
  }
  props.updateProps({ src: value })
  url.value = ''
  invalid.value = false
}

function onCaption(value: string) {
  props.updateProps({ caption: value })
}
</script>

<template>
  <div class="dou-editor-embed" :class="{ 'is-selected': selected }">
    <figure v-if="target" class="dou-editor-embed__figure">
      <div class="dou-editor-embed__frame" :class="`is-${target.kind}`" :style="frameStyle">
        <iframe
          v-if="target.kind === 'frame'"
          :src="target.src"
          :title="caption || link"
          :sandbox="frameSandbox"
          :allow="frameAllow"
          loading="lazy"
          referrerpolicy="strict-origin-when-cross-origin"
        />
        <video v-else-if="target.kind === 'video'" :src="target.src" controls preload="metadata" />
        <audio v-else :src="target.src" controls preload="metadata" />
      </div>
      <figcaption v-if="editable" class="dou-editor-image__caption">
        <input
          class="dou-editor-image__caption-input"
          :value="caption"
          :placeholder="text.caption"
          @change="onCaption(($event.target as HTMLInputElement).value)"
          @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
        />
      </figcaption>
      <figcaption v-else-if="caption" class="dou-editor-image__caption">{{ caption }}</figcaption>
    </figure>

    <div v-else-if="link" class="dou-editor-image__empty">
      <LinkIcon class="dou-editor-image__empty-icon" />
      <span class="dou-editor-image__empty-text">{{ text.invalid }}</span>
      <a
        class="dou-editor-embed__link"
        :href="/^https?:/i.test(link) ? link : undefined"
        target="_blank"
        rel="noopener noreferrer"
        data-editor-control
      >
        {{ link }}
      </a>
    </div>

    <div v-else-if="editable" class="dou-editor-image__empty">
      <AppWindowIcon class="dou-editor-image__empty-icon" />
      <span class="dou-editor-image__empty-text">{{ text.empty }}</span>
      <form class="dou-editor-image__embed" @submit.prevent="apply">
        <DouInput
          v-model="url"
          size="sm"
          :placeholder="text.urlPlaceholder"
          :invalid="invalid"
          @update:model-value="invalid = false"
        />
        <DouButton size="sm" variant="solid" type="submit">{{ text.apply }}</DouButton>
      </form>
      <span v-if="invalid" class="dou-editor-embed__error" role="alert">{{ text.invalid }}</span>
    </div>
  </div>
</template>
