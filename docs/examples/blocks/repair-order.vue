<script setup lang="ts">
import {
  DouFormBuilder,
  DouFormRenderer,
  type FormDocument,
  type FormOptionsLoader,
  type FormRendererExpose,
} from '@dou-ui/form-builder'
import { DouButton, DouEmpty, DouSegmentedControl, DouTag, DouText, toast } from 'dou-ui'
import { ref, useTemplateRef } from 'vue'
import { summarize } from './form-summary'

// 报修单分三步填写；“故障现象”的选项随设备类型从接口加载
const form = ref<FormDocument>({
  version: 1,
  columns: 12,
  nodes: [
    {
      id: 'steps',
      type: 'steps',
      children: [
        {
          id: 'device',
          type: 'page',
          title: '设备',
          children: [
            {
              id: 'kind',
              type: 'segmented-control',
              name: 'kind',
              label: '设备类型',
              default: 'laptop',
              props: {
                options: [
                  { value: 'laptop', label: '笔记本' },
                  { value: 'monitor', label: '显示器' },
                  { value: 'printer', label: '打印机' },
                  { value: 'network', label: '网络' },
                ],
              },
            },
            {
              id: 'asset',
              type: 'input',
              name: 'asset',
              label: '资产编号',
              required: true,
              help: '贴在设备背面，例如 ZC-260318',
              visibleWhen: "values.kind != 'network'",
              span: { sm: 6 },
              rules: [{ pattern: '^ZC-\\d{6}$', message: '格式为 ZC- 加 6 位数字' }],
            },
            {
              id: 'os',
              type: 'radio-group',
              name: 'os',
              label: '系统',
              visibleWhen: "values.kind == 'laptop'",
              span: { sm: 6 },
              props: { options: ['Windows', 'macOS', 'Linux'] },
            },
            {
              id: 'place',
              type: 'select',
              name: 'place',
              label: '所在位置',
              required: true,
              span: { sm: 6 },
              props: {
                options: ['上海漕河泾 3 楼', '上海漕河泾 5 楼', '上海张江 2 楼', '上海张江 7 楼'],
              },
            },
            { id: 'seat', type: 'input', name: 'seat', label: '工位号', span: { sm: 6 } },
          ],
        },
        {
          id: 'fault',
          type: 'page',
          title: '故障',
          children: [
            {
              id: 'symptoms',
              type: 'checkbox-group',
              name: 'symptoms',
              label: '故障现象',
              rules: [{ required: true, message: '至少选一项' }],
              source: { name: 'symptoms', arg: 'values.kind' },
            },
            {
              id: 'urgency',
              type: 'radio-group',
              name: 'urgency',
              label: '紧急程度',
              required: true,
              props: {
                options: [
                  { value: 'low', label: '不急，可以排期' },
                  { value: 'mid', label: '影响工作' },
                  { value: 'high', label: '完全无法工作' },
                ],
              },
            },
            {
              id: 'since',
              type: 'date-picker',
              name: 'since',
              label: '开始出现的日期',
              span: { sm: 6 },
            },
            {
              id: 'often',
              type: 'select',
              name: 'often',
              label: '出现频率',
              span: { sm: 6 },
              props: { options: ['一直这样', '每天几次', '偶尔'] },
            },
            {
              id: 'detail',
              type: 'textarea',
              name: 'detail',
              label: '详细描述',
              requiredWhen: "contains(values.symptoms, '其他')",
              rules: [{ max: 300, message: '不超过 300 字' }],
              props: {
                autosize: { minRows: 3, maxRows: 8 },
                placeholder: '什么操作后出现、试过哪些办法',
              },
            },
            {
              id: 'photos',
              type: 'upload',
              name: 'photos',
              label: '照片',
              help: '最多 3 张，提交时一起上传',
              props: { accept: 'image/*', multiple: true, maxCount: 3, autoUpload: false },
            },
          ],
        },
        {
          id: 'contact',
          type: 'page',
          title: '联系方式',
          children: [
            {
              id: 'reporter',
              type: 'input',
              name: 'reporter',
              label: '报修人',
              required: true,
              default: '戴兜',
              span: { sm: 6 },
            },
            {
              id: 'phone',
              type: 'input',
              name: 'phone',
              label: '手机号',
              required: true,
              span: { sm: 6 },
              rules: [{ pattern: '^1\\d{10}$', message: '请输入 11 位手机号' }],
            },
            {
              id: 'visit',
              type: 'switch',
              name: 'visit',
              label: '需要上门处理',
              default: true,
            },
            {
              id: 'slot',
              type: 'segmented-control',
              name: 'slot',
              label: '方便的时间',
              visibleWhen: 'values.visit',
              props: { options: ['随时', '仅上午', '仅下午'] },
            },
            {
              id: 'promise',
              type: 'input',
              name: 'promise',
              label: '预计响应',
              formula:
                "values.urgency == 'high' ? '2 小时内' : values.urgency == 'mid' ? '当天' : '3 个工作日内'",
            },
          ],
        },
      ],
    },
  ],
})
const selection = ref<string[]>([])
const mode = ref<'design' | 'fill'>('fill')

const symptoms: Record<string, string[]> = {
  laptop: ['无法开机', '很卡', '电池不充电', '键盘失灵', '其他'],
  monitor: ['不亮', '闪屏', '有坏点', '接口松动', '其他'],
  printer: ['卡纸', '打印模糊', '连不上', '缺墨粉', '其他'],
  network: ['连不上 Wi-Fi', '网速慢', '经常断线', '其他'],
}
// 模拟接口的延迟
const sources: Record<string, FormOptionsLoader> = {
  symptoms: (kind: string) =>
    new Promise((resolve) => setTimeout(() => resolve(symptoms[kind] ?? []), 300)),
}

const urgencyTone = { low: 'neutral', mid: 'warning', high: 'danger' } as const
const urgencyText = { low: '不急', mid: '影响工作', high: '无法工作' }
type Urgency = keyof typeof urgencyTone

interface Ticket {
  no: string
  urgency: Urgency
  promise: string
  lines: ReturnType<typeof summarize>
}
let serial = 1
const ticket = (values: Record<string, any>): Ticket => ({
  no: `BX-1031-${String(serial++).padStart(3, '0')}`,
  urgency: values.urgency,
  promise: values.promise,
  // 预计响应和紧急程度放在标题行
  lines: summarize(form.value, values).filter(
    (line) => !['预计响应', '紧急程度'].includes(line.label),
  ),
})
const tickets = ref<Ticket[]>([])

const renderer = useTemplateRef<FormRendererExpose>('renderer')
function submit(values: Record<string, any>) {
  const next = ticket(values)
  tickets.value.unshift(next)
  renderer.value?.resetFields()
  toast.success(`已提交，工单号 ${next.no}`)
}
</script>

<template>
  <div class="repair">
    <div class="repair__head">
      <div>
        <DouText as="h3" size="lg" weight="medium" class="repair__title">设备报修单</DouText>
        <DouText variant="secondary" size="sm"
          >上海办公室 IT 支持 · 分三步填写，提交后生成工单</DouText
        >
      </div>
      <DouSegmentedControl
        v-model="mode"
        :options="[
          { value: 'design', label: '设计表单' },
          { value: 'fill', label: '填写报修' },
        ]"
      />
    </div>

    <DouFormBuilder
      v-if="mode === 'design'"
      v-model="form"
      v-model:selection="selection"
      :sources="sources"
      class="repair__builder"
    />
    <div v-else class="repair__fill">
      <div class="repair__paper">
        <DouFormRenderer ref="renderer" :form="form" :sources="sources" @submit="submit">
          <DouButton native-type="submit" tone="primary">提交报修</DouButton>
        </DouFormRenderer>
      </div>

      <section class="repair__list" aria-labelledby="repair-list-title">
        <DouText id="repair-list-title" weight="medium">我的工单</DouText>
        <DouEmpty v-if="!tickets.length" description="提交报修后，工单会出现在这里" />
        <ul class="repair__tickets">
          <li v-for="item in tickets" :key="item.no" class="repair__ticket">
            <div class="repair__ticket-head">
              <DouText weight="medium" class="repair__no">{{ item.no }}</DouText>
              <DouTag size="sm" :tone="urgencyTone[item.urgency]">{{
                urgencyText[item.urgency]
              }}</DouTag>
            </div>
            <DouText variant="secondary" size="sm">待受理 · 响应时限：{{ item.promise }}</DouText>
            <dl class="repair__lines">
              <template v-for="line in item.lines" :key="line.label">
                <dt>{{ line.label }}</dt>
                <dd>{{ line.text }}</dd>
              </template>
            </dl>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.repair {
  container-type: inline-size;
  display: grid;
  gap: 16px;
  width: 100%;
  min-width: 0;
}
.repair__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px 16px;
}
.repair__title {
  margin: 0 0 4px;
}
.repair__builder {
  --dou-form-builder-height: 620px;
}
.repair__fill {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  align-items: start;
  gap: 16px;
}
.repair__paper {
  padding: 24px;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-container);
  background: var(--dou-color-bg-surface);
}
.repair__list {
  display: grid;
  gap: 12px;
}
.repair__tickets {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.repair__ticket {
  display: grid;
  gap: 6px;
  padding: 12px 14px;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-container);
  background: var(--dou-color-bg-surface);
}
.repair__ticket-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.repair__no {
  font-variant-numeric: tabular-nums;
}
.repair__lines {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 4px 12px;
  margin: 2px 0 0;
  font-size: var(--dou-font-size-sm);
}
.repair__lines dt {
  color: var(--dou-color-text-secondary);
}
.repair__lines dd {
  margin: 0;
  overflow-wrap: anywhere;
}
@container (width < 720px) {
  .repair__fill {
    grid-template-columns: minmax(0, 1fr);
  }
  .repair__paper {
    padding: 16px;
  }
}
@media (max-width: 640px) {
  .repair__builder {
    --dou-form-builder-height: 520px;
  }
}
</style>
