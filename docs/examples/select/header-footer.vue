<script setup>
import { ref } from 'vue'

const regions = [
  { value: 'sh', label: '上海' },
  { value: 'sg', label: '新加坡' },
  { value: 'fra', label: '法兰克福' },
  { value: 'iad', label: '弗吉尼亚', disabled: true },
  { value: 'sfo', label: '旧金山' },
]
const picked = ref(['sh'])
const allValues = regions.filter((option) => !option.disabled).map((option) => option.value)
const toggleAllRegions = (checked) => (picked.value = checked ? [...allValues] : [])
</script>

<template>
  <DouSelect v-model="picked" :options="regions" multiple :max-tag-count="2" style="width: 260px">
    <template #header>
      <DouCheckbox
        size="sm"
        :model-value="picked.length === allValues.length"
        :indeterminate="picked.length > 0 && picked.length < allValues.length"
        @update:model-value="toggleAllRegions"
      >
        全选
      </DouCheckbox>
    </template>
    <template #footer>
      <DouText variant="tertiary" size="sm">
        已选 {{ picked.length }} / {{ allValues.length }}
      </DouText>
    </template>
  </DouSelect>
</template>
