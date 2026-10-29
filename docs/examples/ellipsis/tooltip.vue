<script setup>
const files = [
  'design/tokens/color-palette-final-v3.fig',
  'README.md',
  'packages/dou-ui/src/components/image-cropper/image-cropper.vue',
]
</script>

<template>
  <ul class="files">
    <li v-for="file in files" :key="file">
      <DouEllipsis tooltip>{{ file }}</DouEllipsis>
    </li>
  </ul>
</template>

<style scoped>
.files {
  width: 240px;
  margin: 0;
  padding: 4px 0;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-container);
  list-style: none;
  font-family: var(--dou-font-family-mono);
  font-size: 13px;
}

li {
  margin: 0;
  padding: 6px 12px;
}
</style>
