<script setup>
import { GlobeIcon, PaperclipIcon } from '@dou-ui/icons'
import { onBeforeUnmount, ref, useTemplateRef } from 'vue'

const text = ref('')
const files = ref([])
const search = ref(false)
const picker = useTemplateRef('picker')
let uid = 0

function attach(list) {
  for (const file of list) {
    files.value.push({
      uid: String(uid++),
      name: file.name,
      size: file.size,
      type: file.type,
      url: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    })
  }
}

function onPick(event) {
  attach(event.target.files)
  event.target.value = ''
}

function release(file) {
  if (file.url) URL.revokeObjectURL(file.url)
}

function send() {
  text.value = ''
  files.value.forEach(release)
  files.value = []
}

onBeforeUnmount(() => files.value.forEach(release))
</script>

<template>
  <DouChatInput
    v-model="text"
    placeholder="输入问题，可以粘贴或拖入文件"
    :can-submit="text.trim().length > 0 || files.length > 0"
    @submit="send"
    @attach="attach"
  >
    <template v-if="files.length" #header>
      <DouChatAttachments v-model="files" @remove="release" />
    </template>
    <template #actions>
      <input ref="picker" type="file" multiple hidden @change="onPick" />
      <DouButton variant="ghost" size="sm" aria-label="添加附件" @click="picker.click()">
        <PaperclipIcon />
      </DouButton>
      <DouCheckTag v-model:checked="search" size="sm" round>
        <template #leading><GlobeIcon /></template>
        联网搜索
      </DouCheckTag>
    </template>
  </DouChatInput>
</template>
