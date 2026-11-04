<script setup lang="ts">
import { DouFlowEditor, flowKit, type FlowDocument } from '@dou-ui/flow'
import { whiteboardKit } from '@dou-ui/flow/whiteboard'
import { DouSwitch, toast } from 'dou-ui'
import { ref } from 'vue'

// 打开后，示例里的上传都会失败；关掉时图片以 data URL 存在文档里
const failing = ref(true)
// 打开后用 onUploadError 自己提示，带上失败原因
const custom = ref(false)

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result)))
    reader.addEventListener('error', () => reject(reader.error))
    reader.readAsDataURL(file)
  })

const extensions = [
  flowKit(),
  whiteboardKit({
    async upload(file) {
      await new Promise((resolve) => setTimeout(resolve, 600))
      if (failing.value) throw new Error('服务器暂时不可用')
      return readAsDataUrl(file)
    },
  }),
]
const customExtensions = [
  flowKit(),
  whiteboardKit({
    async upload(file) {
      await new Promise((resolve) => setTimeout(resolve, 600))
      if (failing.value) throw new Error('服务器暂时不可用')
      return readAsDataUrl(file)
    },
    onUploadError(file, error) {
      toast.danger(`${file.name} 上传失败：${(error as Error).message}`, { placement: 'bottom' })
    },
  }),
]

const doc = ref<FlowDocument>({
  version: 1,
  nodes: [
    {
      id: 'tip',
      type: 'sticky',
      x: 0,
      y: 0,
      width: 200,
      height: 160,
      data: { text: '把图片拖进来，或点工具栏的图片按钮（I）' },
    },
  ],
  edges: [],
})
</script>

<template>
  <div class="board-upload">
    <div class="board-upload__switches">
      <label class="board-upload__toggle">
        <DouSwitch v-model="failing" />
        模拟上传失败
      </label>
      <label class="board-upload__toggle">
        <DouSwitch v-model="custom" />
        用 onUploadError 自己提示
      </label>
    </div>
    <DouFlowEditor
      :key="custom ? 'custom' : 'default'"
      v-model="doc"
      :extensions="custom ? customExtensions : extensions"
      fit-view
      aria-label="图片上传失败示例"
      style="height: 360px"
    />
  </div>
</template>

<style scoped>
.board-upload {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 16px;
}

.board-upload__switches {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
}

.board-upload__toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--dou-color-text-secondary);
  font-size: var(--dou-font-size-md);
}
</style>
