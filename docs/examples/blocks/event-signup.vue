<script setup lang="ts">
import {
  DouFormBuilder,
  DouFormRenderer,
  type FormDocument,
  type FormRendererExpose,
} from '@dou-ui/form-builder'
import { DouButton, DouEmpty, DouSegmentedControl, DouTag, DouText, toast } from 'dou-ui'
import { computed, ref, useTemplateRef } from 'vue'
import { summarize } from './form-summary'

// 报名表的描述：设计器改的就是这一份，切到“填写”时渲染器马上用上
const form = ref<FormDocument>({
  version: 1,
  columns: 12,
  nodes: [
    {
      id: 'who',
      type: 'section',
      title: '报名人',
      children: [
        { id: 'name', type: 'input', name: 'name', label: '姓名', required: true, span: { sm: 6 } },
        {
          id: 'phone',
          type: 'input',
          name: 'phone',
          label: '手机号',
          required: true,
          span: { sm: 6 },
          rules: [{ pattern: '^1\\d{10}$', message: '请输入 11 位手机号' }],
          props: { type: 'tel', placeholder: '用于接收入场短信' },
        },
        { id: 'company', type: 'input', name: 'company', label: '公司', span: { sm: 6 } },
        {
          id: 'role',
          type: 'select',
          name: 'role',
          label: '职位',
          span: { sm: 6 },
          props: { options: ['设计师', '前端工程师', '产品经理', '其他'] },
        },
        {
          id: 'roleOther',
          type: 'input',
          name: 'roleOther',
          label: '具体职位',
          visibleWhen: "values.role == '其他'",
          required: true,
        },
      ],
    },
    {
      id: 'join',
      type: 'section',
      title: '活动安排',
      children: [
        {
          id: 'mode',
          type: 'segmented-control',
          name: 'mode',
          label: '参加方式',
          default: 'onsite',
          props: {
            options: [
              { value: 'onsite', label: '现场' },
              { value: 'online', label: '线上直播' },
            ],
          },
        },
        {
          id: 'talks',
          type: 'checkbox-group',
          name: 'talks',
          label: '想听的分享',
          rules: [{ required: true, message: '至少选一场' }],
          props: { options: ['设计令牌怎么分层', '组件的无障碍', '大表单的性能'] },
        },
        {
          id: 'lunch',
          type: 'switch',
          name: 'lunch',
          label: '需要午餐',
          visibleWhen: "values.mode == 'onsite'",
        },
        {
          id: 'diet',
          type: 'radio-group',
          name: 'diet',
          label: '饮食',
          visibleWhen: "values.mode == 'onsite' && values.lunch",
          default: '普通',
          props: { options: ['普通', '素食', '清真'] },
        },
        {
          id: 'guests',
          type: 'list',
          name: 'guests',
          label: '同行人',
          visibleWhen: "values.mode == 'onsite'",
          max: 2,
          addText: '添加同行人',
          children: [
            {
              id: 'guest-name',
              type: 'input',
              name: 'name',
              label: '姓名',
              required: true,
              span: { sm: 6 },
            },
            {
              id: 'guest-phone',
              type: 'input',
              name: 'phone',
              label: '手机号',
              span: { sm: 6 },
              rules: [{ pattern: '^1\\d{10}$', message: '请输入 11 位手机号' }],
            },
          ],
        },
        {
          id: 'fee',
          type: 'input-number',
          name: 'fee',
          label: '费用（元）',
          help: '现场每人 99 元，含茶歇；线上免费',
          formula: "values.mode == 'onsite' ? 99 * (1 + len(values.guests)) : 0",
        },
      ],
    },
    {
      id: 'agree',
      type: 'checkbox',
      name: 'agree',
      required: true,
      props: { text: '我已阅读活动须知，同意主办方用手机号联系我' },
    },
  ],
})
const selection = ref<string[]>([])
const mode = ref<'design' | 'fill'>('fill')

interface Entry {
  id: number
  name: string
  online: boolean
  fee: number
  lines: ReturnType<typeof summarize>
}
let nextId = 1
const entry = (values: Record<string, any>): Entry => ({
  id: nextId++,
  name: values.name,
  online: values.mode === 'online',
  fee: values.fee ?? 0,
  // 姓名已经在标题里
  lines: summarize(form.value, values).filter((line) => line.label !== '姓名'),
})
const entries = ref<Entry[]>([
  entry({ name: '阿青', phone: '13800001234', mode: 'online', talks: ['组件的无障碍'], fee: 0 }),
])
const income = computed(() => entries.value.reduce((total, item) => total + item.fee, 0))

const renderer = useTemplateRef<FormRendererExpose>('renderer')
function submit(values: Record<string, any>) {
  entries.value.unshift(entry(values))
  renderer.value?.resetFields()
  toast.success(`${values.name} 报名成功`)
}
</script>

<template>
  <div class="signup">
    <div class="signup__head">
      <div>
        <DouText as="h3" size="lg" weight="medium" class="signup__title">设计系统沙龙报名</DouText>
        <DouText variant="secondary" size="sm"
          >11 月 22 日 · 上海徐汇 · 在“设计表单”里改的字段，切回“填写报名”马上生效</DouText
        >
      </div>
      <DouSegmentedControl
        v-model="mode"
        :options="[
          { value: 'design', label: '设计表单' },
          { value: 'fill', label: '填写报名' },
        ]"
      />
    </div>

    <DouFormBuilder
      v-if="mode === 'design'"
      v-model="form"
      v-model:selection="selection"
      class="signup__builder"
    />
    <!-- 填写区只是隐藏，不卸载：切到设计再回来，已填的值和所在步骤都还在 -->
    <div v-show="mode === 'fill'" class="signup__fill">
      <div class="signup__paper">
        <DouFormRenderer ref="renderer" :form="form" @submit="submit">
          <div>
            <DouButton native-type="submit" tone="primary">提交报名</DouButton>
          </div>
        </DouFormRenderer>
      </div>

      <section class="signup__list" aria-labelledby="signup-list-title">
        <div class="signup__list-head">
          <DouText id="signup-list-title" weight="medium">已报名 {{ entries.length }} 人</DouText>
          <DouText variant="secondary" size="sm">费用合计 {{ income }} 元</DouText>
        </div>
        <DouEmpty v-if="!entries.length" description="还没有人报名" />
        <ul class="signup__entries">
          <li v-for="item in entries" :key="item.id" class="signup__entry">
            <div class="signup__entry-head">
              <DouText weight="medium">{{ item.name }}</DouText>
              <DouTag size="sm" :tone="item.online ? 'neutral' : 'primary'">{{
                item.online ? '线上' : '现场'
              }}</DouTag>
            </div>
            <dl class="signup__lines">
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
.signup {
  container-type: inline-size;
  display: grid;
  gap: 16px;
  width: 100%;
  min-width: 0;
}
.signup__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px 16px;
}
.signup__title {
  margin: 0 0 4px;
}
.signup__builder {
  --dou-form-builder-height: 620px;
}
.signup__fill {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  align-items: start;
  gap: 16px;
}
.signup__paper {
  padding: 24px;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-container);
  background: var(--dou-color-bg-surface);
}
.signup__list {
  display: grid;
  gap: 12px;
}
.signup__list-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.signup__entries {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.signup__entry {
  display: grid;
  gap: 8px;
  padding: 12px 14px;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-container);
  background: var(--dou-color-bg-surface);
}
.signup__entry-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.signup__lines {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 4px 12px;
  margin: 0;
  font-size: var(--dou-font-size-sm);
}
.signup__lines dt {
  color: var(--dou-color-text-secondary);
}
.signup__lines dd {
  margin: 0;
  overflow-wrap: anywhere;
}
@container (width < 720px) {
  .signup__fill {
    grid-template-columns: minmax(0, 1fr);
  }
  .signup__paper {
    padding: 16px;
  }
}
@media (max-width: 640px) {
  .signup__builder {
    --dou-form-builder-height: 520px;
  }
}
</style>
