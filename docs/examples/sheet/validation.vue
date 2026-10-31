<script setup lang="ts">
import { DouSheet, DouSheetToolbar, type SheetExpose, type SheetWorkbook } from '@dou-ui/sheet'
import { DouButton } from 'dou-ui'
import { ref } from 'vue'

const head = (value: string) => ({ value, style: 'head' })

const book = ref<SheetWorkbook>({
  styles: { head: { bold: true, fill: 'neutral' } },
  sheets: [
    {
      name: '门店巡检',
      freeze: { rows: 1 },
      colSizes: { 0: 96, 1: 72, 2: 80, 3: 72, 4: 160, 6: 72 },
      cells: [
        [
          head('门店'),
          head('城市'),
          head('巡检人'),
          head('评分'),
          head('备注'),
          null,
          head('城市表'),
        ],
        ['静安店', '上海', '戴兜', 5, '陈列整齐', null, '上海'],
        ['西湖店', '杭州', '戴兜', 4, '', null, '杭州'],
        ['姑苏店', '苏州', '阿青', 6, '评分写错了', null, '苏州'],
        ['新街口店', '无锡', '阿青', 3, '城市不在表里', null, '南京'],
      ],
      validations: [
        // 城市从右边的城市表里选
        { range: 'B2:B20', list: '=$G$2:$G$5', prompt: '从城市表里选' },
        // 巡检人从固定的名单里选
        { range: 'C2:C20', list: ['戴兜', '阿青', '小林'] },
        // 评分是 1 到 5 的整数
        {
          range: 'D2:D20',
          when: { op: 'between', value: 1, to: 5 },
          integer: true,
          prompt: '1 到 5 分',
        },
        // 备注不超过 20 个字，超出时只标记
        {
          range: 'E2:E20',
          formula: '=LEN(E2)<=20',
          strict: false,
          message: '备注不超过 20 个字',
        },
      ],
    },
  ],
})

const grid = ref<SheetExpose>()
const found = ref<string[] | null>(null)
function check() {
  found.value = grid.value!.findInvalid().map((c) => `${c.cell}：${c.message}`)
}
</script>

<template>
  <div class="demo">
    <DouSheet ref="grid" v-model="book" style="height: 300px">
      <template #header>
        <DouSheetToolbar :tools="['undo', 'redo', '|', 'validation']" />
      </template>
    </DouSheet>
    <div class="actions">
      <DouButton variant="outline" @click="check">检查</DouButton>
      <span v-if="found" class="result">{{
        found.length ? found.join('；') : '全部符合规则'
      }}</span>
    </div>
  </div>
</template>

<style scoped>
.demo {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}
.actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.result {
  color: var(--dou-color-text-secondary);
  font-size: var(--dou-font-size-sm);
}
</style>
