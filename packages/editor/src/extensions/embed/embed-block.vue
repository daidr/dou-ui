<script setup lang="ts">
import { AppWindowIcon, LinkIcon, PencilIcon } from '@dou-ui/icons'
import { DouButton, DouInput, DouTooltip } from 'dou-ui'
import { computed, shallowRef } from 'vue'
import type { BlockProps } from '../../core/model'
import { useEditor } from '../../editor'
import { frameAllow, frameSandbox, httpsUrl, ratioOf, type EmbedTarget } from './targets'

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
/** Why a link can't be embedded: only https, or refused for another reason. */
const reason = (value: string) => (httpsUrl(value) ? text.value.invalid : text.value.insecure)
const error = shallowRef('')

/* changing the link */
const editing = shallowRef(false)
function edit() {
  url.value = link.value
  invalid.value = false
  editing.value = true
}
function cancel() {
  editing.value = false
  url.value = ''
  invalid.value = false
}

function apply() {
  const value = url.value.trim()
  if (!value) return
  if (!props.resolve(value)) {
    invalid.value = true
    error.value = reason(value)
    return
  }
  props.updateProps({ src: value })
  url.value = ''
  invalid.value = false
  editing.value = false
}

/** Enter ends the caption, unless it picks a word in an input method. */
function onCaptionEnter(event: KeyboardEvent) {
  if (event.isComposing || event.keyCode === 229) return
  event.preventDefault()
  ;(event.target as HTMLInputElement).blur()
}

function onCaption(value: string) {
  props.updateProps({ caption: value })
}
</script>

<template>
  <div class="dou-editor-embed" :class="{ 'is-selected': selected }">
    <div v-if="editable && (editing || !link)" class="dou-editor-image__empty">
      <AppWindowIcon class="dou-editor-image__empty-icon" />
      <span class="dou-editor-image__empty-text">{{ text.empty }}</span>
      <form class="dou-editor-image__embed" @submit.prevent="apply">
        <DouInput
          v-model="url"
          size="sm"
          :placeholder="text.urlPlaceholder"
          :invalid="invalid"
          :autofocus="editing"
          @update:model-value="invalid = false"
          @keydown.esc="editing && cancel()"
        />
        <DouButton v-if="editing" size="sm" variant="ghost" @click="cancel">
          {{ text.cancel }}
        </DouButton>
        <DouButton size="sm" variant="solid" type="submit">{{ text.apply }}</DouButton>
      </form>
      <span v-if="invalid" class="dou-editor-embed__error" role="alert">{{ error }}</span>
    </div>

    <figure v-else-if="target" class="dou-editor-embed__figure">
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
      <figcaption v-if="editable" class="dou-editor-image__caption dou-editor-embed__caption">
        <input
          class="dou-editor-image__caption-input"
          :value="caption"
          :placeholder="text.caption"
          @change="onCaption(($event.target as HTMLInputElement).value)"
          @keydown.enter="onCaptionEnter"
        />
        <DouTooltip :content="text.edit">
          <DouButton
            size="sm"
            variant="ghost"
            class="dou-editor-embed__edit"
            :aria-label="text.edit"
            data-editor-control
            @click="edit"
          >
            <PencilIcon />
          </DouButton>
        </DouTooltip>
      </figcaption>
      <figcaption v-else-if="caption" class="dou-editor-image__caption">{{ caption }}</figcaption>
    </figure>

    <div v-else-if="link" class="dou-editor-image__empty">
      <LinkIcon class="dou-editor-image__empty-icon" />
      <span class="dou-editor-image__empty-text">{{ reason(link) }}</span>
      <a
        class="dou-editor-embed__link"
        :href="/^https?:/i.test(link) ? link : undefined"
        target="_blank"
        rel="noopener noreferrer"
        data-editor-control
      >
        {{ link }}
      </a>
      <DouButton v-if="editable" size="sm" variant="outline" @click="edit">
        <template #leading><PencilIcon /></template>
        {{ text.edit }}
      </DouButton>
    </div>
  </div>
</template>
