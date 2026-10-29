<script setup>
import { onBeforeUnmount, ref, useTemplateRef } from 'vue'

const photo = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="hsl(210 30% 72%)"/><stop offset="1" stop-color="hsl(250 28% 38%)"/></linearGradient></defs><rect width="1200" height="800" fill="url(#g)"/><circle cx="860" cy="250" r="110" fill="hsl(210 40% 88%)" opacity=".7"/><path d="M0 650 L320 410 L570 600 L790 450 L1200 700 V800 H0Z" fill="hsl(230 25% 28%)" opacity=".8"/></svg>`,
)}`

const cropper = useTemplateRef('cropper')
const result = ref()
const area = ref()

async function crop() {
  const blob = await cropper.value.getBlob({ maxWidth: 480 })
  if (result.value) URL.revokeObjectURL(result.value)
  result.value = blob ? URL.createObjectURL(blob) : undefined
}
onBeforeUnmount(() => result.value && URL.revokeObjectURL(result.value))
</script>

<template>
  <div class="layout">
    <DouImageCropper
      ref="cropper"
      :src="photo"
      :aspect-ratio="16 / 9"
      class="cropper"
      @change="area = $event"
    />
    <div class="side">
      <DouButton variant="solid" @click="crop">裁剪</DouButton>
      <img v-if="result" :src="result" alt="裁剪结果" class="result" />
      <DouText v-if="area" variant="secondary" mono>
        {{ Math.round(area.width) }} × {{ Math.round(area.height) }}
      </DouText>
    </div>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  width: 100%;
}

.cropper {
  flex: 1 1 320px;
}

.side {
  display: flex;
  flex: 0 0 160px;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.result {
  width: 160px;
  border-radius: var(--dou-radius-control);
  box-shadow: var(--dou-shadow-sm);
}
</style>
