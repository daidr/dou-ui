<script setup>
import { ref } from 'vue'

const tones = ['#e8eef7', '#efe9f6', '#e7f2ec', '#f6efe4', '#f3e8ea']
const heights = [120, 180, 96, 150, 210, 132, 168, 104]
const photos = ref([])
const finished = ref(false)

async function load() {
  await new Promise((resolve) => setTimeout(resolve, 600))
  const start = photos.value.length
  photos.value.push(
    ...Array.from({ length: 12 }, (_, i) => {
      const n = start + i
      return { id: n + 1, height: heights[n % heights.length], tone: tones[n % tones.length] }
    }),
  )
  if (photos.value.length >= 48) finished.value = true
}
</script>

<template>
  <div class="gallery">
    <DouInfiniteScroll :load="load" :finished="finished">
      <DouMasonry :items="photos" item-key="id" :columns="{ base: 2, md: 4 }" gap="sm">
        <template #default="{ item }">
          <div class="photo" :style="{ height: `${item.height}px`, background: item.tone }">
            {{ item.id }}
          </div>
        </template>
      </DouMasonry>
    </DouInfiniteScroll>
  </div>
</template>

<style scoped>
.gallery {
  width: 100%;
  height: 360px;
  padding: 8px;
  overflow: auto;
  box-sizing: border-box;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-container);
}

.photo {
  display: flex;
  align-items: flex-end;
  padding: 8px 10px;
  box-sizing: border-box;
  border-radius: var(--dou-radius-control);
  color: rgb(0 0 0 / 0.45);
  font-size: var(--dou-font-size-sm);
}
</style>
