<script setup>
import { ref, useTemplateRef } from 'vue'

const avatar = ref('https://avatars.githubusercontent.com/u/18638914?s=160')
const file = ref(null)
const open = ref(false)
const cropper = useTemplateRef('cropper')
let finish

// Crop before uploading: resolve with the cropped file, or false to skip it.
function beforeUpload(raw) {
  file.value = raw
  open.value = true
  return new Promise((resolve) => (finish = resolve))
}

async function confirm() {
  const blob = await cropper.value.getBlob({ width: 256, type: 'image/png' })
  if (blob) {
    avatar.value = URL.createObjectURL(blob)
    finish(new File([blob], 'avatar.png', { type: 'image/png' }))
  } else finish(false)
  open.value = false
}
function cancel() {
  // after confirm this does nothing: the promise has settled already
  finish?.(false)
  open.value = false
}

// Stands in for a real upload.
const request = () => new Promise((resolve) => setTimeout(resolve, 400))
</script>

<template>
  <div class="profile">
    <DouAvatar :src="avatar" name="戴兜" size="lg" />
    <DouUpload accept="image/*" :show-list="false" :before-upload="beforeUpload" :request="request">
      <DouButton>更换头像</DouButton>
    </DouUpload>
  </div>
  <DouDialog v-model:open="open" title="裁剪头像" @close="cancel">
    <DouImageCropper ref="cropper" :src="file" shape="round" :height="280" />
    <template #footer>
      <DouButton @click="cancel">取消</DouButton>
      <DouButton variant="solid" @click="confirm">使用这张</DouButton>
    </template>
  </DouDialog>
</template>

<style scoped>
.profile {
  display: flex;
  align-items: center;
  gap: 16px;
}
</style>
