<script setup>
import {
  DouSheet,
  DouSheetFormulaBar,
  DouSheetTabs,
  DouSheetToolbar,
  useSheetFormulas,
  valueOf,
} from '@dou-ui/sheet'
import { CheckCircleIcon, DownloadIcon } from '@dou-ui/icons'
import { downloadBlob, toast } from 'dou-ui'
import { computed, ref, shallowRef } from 'vue'

const head = (value) => ({ value, style: 'head' })
const total = (value, format) => ({ value, style: 'total', format })
const money = (value) => ({ value, format: '¥#,##0' })
const MONEY = '¥#,##0'
const RATE = '0.0%'

/* 明细：类别、项目、负责人、全年、已执行、执行率，后面是四个季度 */
const items = [
  ['人力', '内容编辑外包', '戴兜', [36000, 36000, 36000, 36000], 120000],
  ['人力', '活动执行外包', '阿青', [20000, 30000, 20000, 40000], 98000],
  ['市场活动', '春季新品发布会', '戴兜', [80000, 0, 0, 0], 92600],
  ['市场活动', '城市快闪店（上海）', '阿青', [0, 60000, 0, 0], 57800],
  ['市场活动', '双十一促销', '小林', [0, 0, 20000, 90000], 64000],
  ['市场活动', '年会', '小林', [0, 0, 0, 50000], null],
  ['线上投放', '搜索广告', '小林', [30000, 30000, 30000, 30000], 101500],
  ['线上投放', '社交媒体投放', '阿青', [25000, 25000, 30000, 40000], 108300],
  ['线上投放', '达人合作', '戴兜', [0, 40000, 40000, 60000], 151200],
  ['差旅', '市场调研出差', '阿青', [8000, 8000, 8000, 6000], 21400],
  ['设备', '摄影器材', '戴兜', [25000, 0, 0, 0], 23900],
  ['其他', '备用金', '小林', [5000, 5000, 5000, 5000], 6200],
]
const last = items.length + 1 // 最后一行明细的行号
const categories = ['人力', '市场活动', '线上投放', '差旅', '设备', '其他']

const book = ref({
  version: 1,
  styles: {
    head: { bold: true, fill: 'neutral' },
    total: { bold: true, fill: 'neutral' },
    over: { fill: 'danger', tone: 'danger' },
  },
  sheets: [
    {
      name: '明细',
      freeze: { rows: 1, cols: 2 },
      rowCount: 40,
      colCount: 12,
      colSizes: { 0: 80, 1: 140, 2: 64, 3: 100, 4: 100, 5: 64, 6: 84, 7: 84, 8: 84, 9: 84 },
      cells: [
        [
          '类别',
          '项目',
          '负责人',
          '全年',
          '已执行',
          '执行率',
          '一季度',
          '二季度',
          '三季度',
          '四季度',
        ].map(head),
        ...items.map(([category, name, owner, quarters, spent], i) => {
          const row = i + 2
          return [
            category,
            name,
            owner,
            { value: `=SUM(G${row}:J${row})`, format: MONEY },
            spent === null ? null : money(spent),
            { value: `=IF(E${row}="","",E${row}/D${row})`, format: RATE },
            ...quarters.map(money),
          ]
        }),
        [
          total('合计'),
          total(null),
          total(null),
          total(`=SUM(D2:D${last})`, MONEY),
          total(`=SUM(E2:E${last})`, MONEY),
          total(`=E${last + 1}/D${last + 1}`, RATE),
          ...['G', 'H', 'I', 'J'].map((col) => total(`=SUM(${col}2:${col}${last})`, MONEY)),
        ],
      ],
      conditionalFormats: [
        // 超出预算的项目标红，全年预算画成数据条
        { range: `F2:F${last}`, when: { op: 'gt', value: 1 }, style: 'over' },
        { range: `D2:D${last}`, bar: true },
      ],
      validations: [
        { range: `A2:A${last}`, list: '=按类别!$A$2:$A$7', prompt: '类别在“按类别”表里维护' },
        { range: `C2:C${last}`, list: ['戴兜', '阿青', '小林'] },
        // 已执行和四个季度不相邻，写在一条规则里
        {
          range: [`E2:E${last}`, `G2:J${last}`],
          when: { op: 'ge', value: 0 },
          message: '金额不能是负数',
        },
      ],
    },
    {
      name: '按类别',
      freeze: { rows: 1 },
      rowCount: 20,
      colCount: 8,
      colSizes: { 0: 88 },
      cells: [
        ['类别', '全年预算', '已执行', '执行率', '预算占比'].map(head),
        ...categories.map((category, i) => {
          const row = i + 2
          const sumOf = (col) =>
            `=SUMIF(明细!$A$2:$A$${last},A${row},明细!$${col}$2:$${col}$${last})`
          return [
            category,
            { value: sumOf('D'), format: MONEY },
            { value: sumOf('E'), format: MONEY },
            { value: `=IFERROR(C${row}/B${row},"")`, format: RATE },
            { value: `=B${row}/SUM($B$2:$B$7)`, format: RATE },
          ]
        }),
        [
          total('合计'),
          total('=SUM(B2:B7)', MONEY),
          total('=SUM(C2:C7)', MONEY),
          total('=C8/B8', RATE),
          total('=SUM(E2:E7)', RATE),
        ],
      ],
      conditionalFormats: [
        { range: 'D2:D7', when: { op: 'gt', value: 1 }, style: 'over' },
        { range: 'E2:E7', bar: true },
      ],
    },
  ],
})

/*
 * 上方的数字读取公式的结果：useSheetFormulas 在表格之外计算同一个工作簿，
 * 把表格的 transaction 事件交给它，每次修改只重新计算受影响的公式。
 */
const formulas = useSheetFormulas(book)
/** 第一个工作表里一格的结果，不是数字时当作 0 */
function at(row, col) {
  const value = formulas.result(0, row, col)
  return typeof value === 'number' ? value : 0
}

const summary = computed(() => {
  const cells = book.value.sheets[0].cells
  // 合计行可能因为插入、删除行而移动，按第一列的文字找到它
  const totalRow = cells.findIndex((row) => valueOf(row?.[0]) === '合计')
  let over = 0
  for (let row = 1; row < totalRow; row++) if (at(row, 5) > 1) over++
  const budget = at(totalRow, 3)
  const spent = at(totalRow, 4)
  return { budget, spent, rate: budget ? (spent / budget) * 100 : 0, over }
})

const cards = computed(() => [
  { title: '全年预算', value: summary.value.budget, prefix: '¥', precision: 0 },
  { title: '已执行', value: summary.value.spent, prefix: '¥', precision: 0 },
  { title: '执行率', value: summary.value.rate, suffix: '%', precision: 1 },
  { title: '超支项目', value: summary.value.over, suffix: '项', precision: 0 },
])

/* 检查与导出 */
const grid = shallowRef()
function check() {
  const found = grid.value.findInvalid()
  if (!found.length) toast.success('所有单元格都符合规则')
  else {
    toast.warning(
      `${found[0].sheet}!${found[0].cell}：${found[0].message}（共 ${found.length} 处）`,
    )
    grid.value.showSheet(found[0].sheet)
    grid.value.select(found[0].cell)
  }
}
function download() {
  downloadBlob(new Blob([grid.value.toCSV()], { type: 'text/csv' }), '市场部预算.csv')
}
</script>

<template>
  <div class="budget">
    <DouPageHeader title="部门预算" subtitle="市场部 · 2026 年" :show-back="false" :level="2">
      <template #extra>
        <DouButton variant="outline" @click="check">
          <template #leading><CheckCircleIcon /></template>
          检查
        </DouButton>
        <DouButton variant="outline" @click="download">
          <template #leading><DownloadIcon /></template>
          下载 CSV
        </DouButton>
      </template>
    </DouPageHeader>

    <div class="budget__cards">
      <DouCard v-for="card in cards" :key="card.title" padding="md">
        <DouStatistic
          :title="card.title"
          :value="card.value"
          :prefix="card.prefix"
          :suffix="card.suffix"
          :precision="card.precision"
        />
      </DouCard>
    </div>

    <DouSheet
      ref="grid"
      v-model="book"
      class="budget__sheet"
      aria-label="部门预算"
      @transaction="formulas.update"
    >
      <template #header>
        <DouSheetToolbar
          :tools="[
            'undo',
            'redo',
            '|',
            'format',
            'decimals',
            '|',
            'bold',
            'color',
            'fill',
            '|',
            'sort',
            'filter',
            'conditional',
            'validation',
          ]"
        />
        <DouSheetFormulaBar />
      </template>
      <template #footer>
        <DouSheetTabs />
      </template>
    </DouSheet>
  </div>
</template>

<style scoped>
.budget {
  display: grid;
  gap: 16px;
  width: 100%;
  min-width: 0;
  container-type: inline-size;
}
.budget__cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}
.budget__sheet {
  height: 480px;
}
/* 窄屏时两列，数字缩小，金额不被截断 */
@container (max-width: 560px) {
  .budget__cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .budget__cards :deep(.dou-statistic) {
    --dou-statistic-value-size: 18px;
  }
}
</style>
