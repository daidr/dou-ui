<script setup lang="ts">
import { DouSheet, type SheetWorkbook } from '@dou-ui/sheet'
import { DouButton, DouSegmentedControl } from 'dou-ui'
import { computed, ref, useTemplateRef } from 'vue'

interface Version {
  id: string
  name: string
  book: SheetWorkbook
}

const head = (value: string) => ({ value, style: 'head' })
const money = (value: number) => ({ value, format: '¥#,##0' })
const budget = (rows: (string | number)[][]): SheetWorkbook => ({
  version: 1,
  styles: { head: { bold: true, fill: 'neutral' } },
  sheets: [
    {
      id: 'budget',
      name: '活动预算',
      freeze: { rows: 1 },
      colSizes: { 0: 120, 3: 160 },
      rowCount: 10,
      colCount: 5,
      cells: [
        [head('项目'), head('预算'), head('负责人'), head('备注')],
        ...rows.map(([name, amount, owner, note]) => [
          name!,
          money(amount as number),
          owner!,
          note ?? '',
        ]),
      ],
    },
  ],
})

// 应用自己保存的版本，这里写死两份
const versions: Version[] = [
  {
    id: 'v1',
    name: '初稿',
    book: budget([
      ['场地', 45000, '戴兜', '待签合同'],
      ['物料', 12600, '阿青'],
      ['餐饮', 9800, '阿青', '按 120 人计'],
    ]),
  },
  {
    id: 'v2',
    name: '评审后',
    book: budget([
      ['场地', 48000, '戴兜', '已签合同'],
      ['物料', 12600, '阿青'],
      ['餐饮', 12000, '阿青', '按 150 人计'],
    ]),
  },
]

const book = ref<SheetWorkbook>(
  budget([
    ['场地', 48000, '戴兜', '已签合同'],
    ['物料', 13800, '阿青', '加印海报'],
    ['餐饮', 12000, '阿青', '按 150 人计'],
    ['交通', 3200, '戴兜'],
  ]),
)

const shown = ref('now')
const sheet = useTemplateRef<InstanceType<typeof DouSheet>>('sheet')
const compare = computed(() => versions.find((v) => v.id === shown.value)?.book ?? null)

const options = [
  { label: '当前', value: 'now' },
  ...versions.map((v) => ({ label: `对比“${v.name}”`, value: v.id })),
]

function restore() {
  if (!compare.value) return
  const version = compare.value
  // 先回到编辑，再恢复；恢复前可以先把当前内容存成一个版本
  shown.value = 'now'
  sheet.value?.restore(version)
}
</script>

<template>
  <div class="sheet-versions-demo">
    <div class="sheet-versions-demo__bar">
      <DouSegmentedControl v-model="shown" :options="options" size="sm" />
      <template v-if="compare">
        <DouButton size="sm" variant="outline" @click="sheet?.previousChange()">上一处</DouButton>
        <DouButton size="sm" variant="outline" @click="sheet?.nextChange()">下一处</DouButton>
        <DouButton size="sm" variant="solid" tone="primary" @click="restore">恢复此版本</DouButton>
      </template>
    </div>
    <DouSheet
      ref="sheet"
      v-model="book"
      :compare="compare"
      aria-label="活动预算"
      style="height: 260px"
    />
  </div>
</template>

<style scoped>
.sheet-versions-demo {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sheet-versions-demo__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
</style>
