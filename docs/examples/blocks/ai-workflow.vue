<script setup lang="ts">
import {
  defineFlowExtension,
  defineNodeType,
  DouFlowControls,
  DouFlowEditor,
  flowKit,
  flowOrder,
  type FlowDocument,
  type FlowSelection,
} from '@dou-ui/flow'
import { PlayIcon, PlusIcon } from '@dou-ui/icons'
import { useElementSize } from 'dou-ui'
import { computed, ref, useTemplateRef } from 'vue'
import StepFields from './ai-workflow/step-fields.vue'
import StepNode from './ai-workflow/step-node.vue'
import { kinds } from './ai-workflow/steps'

// Every step kind is a node type; together they make one extension.
const steps = defineFlowExtension({
  name: 'ai-steps',
  nodeTypes: Object.entries(kinds).map(([type, kind]) =>
    defineNodeType({
      type,
      component: StepNode,
      ports: () => [
        ...(kind.input ? [{ id: 'in', kind: 'input' as const, side: 'top' as const }] : []),
        ...kind.exits.map((exit) => ({
          ...exit,
          kind: 'output' as const,
          side: 'bottom' as const,
        })),
      ],
      defaults: kind.defaults,
      label: (node) => (node.data?.title as string) ?? kind.label,
    }),
  ),
  // A pasted copy hasn't run yet.
  transformPaste: (data) => ({
    ...data,
    nodes: data.nodes.map((node) => ({ ...node, data: { ...node.data, status: undefined } })),
  }),
})
const extensions = [flowKit(), steps]

const step = (id: string, type: string, x: number, y: number, data = {}) => ({
  id,
  type,
  x,
  y,
  data: { ...kinds[type]!.defaults(), ...data },
})
const link = (from: string, to: string, port = 'out') => ({
  id: `${from}-${to}`,
  source: { node: from, port },
  target: { node: to, port: 'in' },
})

const doc = ref<FlowDocument>({
  version: 1,
  nodes: [
    step('start', 'start', 0, 0),
    step('retrieve', 'retrieve', 0, 128),
    step('llm', 'llm', 0, 256, {
      prompt:
        '根据下面的笔记回答问题，答不上来就直说。\n笔记：{{retrieve.passages}}\n问题：{{start.question}}',
    }),
    step('branch', 'branch', 0, 384),
    step('human', 'human', -112, 544),
    step('reply', 'reply', 112, 544),
  ],
  edges: [
    link('start', 'retrieve'),
    link('retrieve', 'llm'),
    link('llm', 'branch'),
    link('branch', 'human', 'yes'),
    link('branch', 'reply', 'no'),
  ],
})
const selection = ref<FlowSelection>({ nodes: ['llm'], edges: [] })
const editor = useTemplateRef<InstanceType<typeof DouFlowEditor>>('editor')

const selected = computed(() =>
  selection.value.nodes.length === 1
    ? doc.value.nodes.find((n) => n.id === selection.value.nodes[0])
    : undefined,
)
const kind = computed(() => (selected.value ? kinds[selected.value.type!] : undefined))

function update(patch: Record<string, unknown>) {
  const id = selected.value!.id
  editor.value!.transact((tr) => tr.updateData(id, patch), { group: `form:${id}` })
}

/** Outputs of the steps that run before the selected one: what its fields can refer to. */
const upstream = computed(() => {
  const node = selected.value
  if (!node) return []
  const before = new Set<string>()
  const queue = [node.id]
  while (queue.length) {
    const id = queue.pop()!
    for (const edge of doc.value.edges)
      if (edge.target.node === id && !before.has(edge.source.node)) {
        before.add(edge.source.node)
        queue.push(edge.source.node)
      }
  }
  return flowOrder(doc.value)
    .filter((n) => before.has(n.id))
    .flatMap((n) =>
      kinds[n.type!]!.outputs.map((output) => ({
        token: `{{${n.id}.${output.key}}}`,
        label: `${(n.data?.title as string) ?? kinds[n.type!]!.label} · ${output.label}`,
      })),
    )
})

function insert(field: string, token: string) {
  const value = String(selected.value!.data?.[field] ?? '')
  update({ [field]: value + token })
}

// Adding a step: placed below the selected one, or in the middle of the view.
function add(type: string) {
  const flow = editor.value!
  const anchor = selected.value && flow.getNodeRect(selected.value.id)
  const id = `${type}-${Date.now().toString(36)}`
  const at = anchor
    ? { x: anchor.x, y: anchor.y + anchor.height + 56 }
    : flow.toCanvas({ x: 240, y: 120 })
  flow.transact((tr) => {
    tr.addNode(step(id, type, Math.round(at.x / 8) * 8, Math.round(at.y / 8) * 8))
    if (anchor && kinds[selected.value!.type!]!.exits.length === 1)
      tr.addEdge(link(selected.value!.id, id, kinds[selected.value!.type!]!.exits[0]!.id))
  })
  selection.value = { nodes: [id], edges: [] }
  flow.centerNode(id)
}
const addOptions = Object.entries(kinds)
  .filter(([type]) => type !== 'start')
  .map(([type, k]) => ({ key: type, label: k.label, icon: k.icon }))

// A pretend run: each step lights up in turn along the edges; 判断 takes the 否 exit.
const running = ref(false)
async function run() {
  const flow = editor.value!
  running.value = true
  const setStatus = (id: string, status?: string) =>
    flow.transact((tr) => tr.updateData(id, { status }), { history: false })
  for (const node of doc.value.nodes) setStatus(node.id, undefined)
  let current: string | undefined = 'start'
  while (current) {
    setStatus(current, 'process')
    await new Promise((resolve) => setTimeout(resolve, 600))
    setStatus(current, 'finish')
    const from: string = current
    const exit = doc.value.edges.find(
      (e) => e.source.node === from && (e.source.port === 'out' || e.source.port === 'no'),
    )
    current = exit?.target.node
  }
  running.value = false
}

const root = useTemplateRef<HTMLElement>('root')
const { width } = useElementSize(root)
const narrow = computed(() => width.value > 0 && width.value < 720)
// On a phone the settings live in a drawer, opened by tapping a step, so
// dragging a step around doesn't keep popping it up.
const inspecting = ref(false)
const inspectorOpen = computed({
  get: () => narrow.value && inspecting.value && !!selected.value,
  set: (open) => {
    inspecting.value = open
  },
})
</script>

<template>
  <div ref="root" class="ai-workflow">
    <header class="ai-workflow__bar">
      <span class="ai-workflow__name">客服问答流程</span>
      <DouDropdown @select="add($event as string)">
        <DouButton size="sm" variant="outline">
          <template #leading><PlusIcon /></template>
          添加步骤
        </DouButton>
        <template #menu>
          <DouDropdownItem v-for="option in addOptions" :key="option.key" :value="option.key">
            <template #prefix>
              <DouIcon><component :is="option.icon" /></DouIcon>
            </template>
            {{ option.label }}
          </DouDropdownItem>
        </template>
      </DouDropdown>
      <DouButton size="sm" :loading="running" @click="run">
        <template #leading><PlayIcon /></template>
        试运行
      </DouButton>
    </header>
    <div class="ai-workflow__body">
      <DouFlowEditor
        ref="editor"
        v-model="doc"
        v-model:selection="selection"
        :extensions="extensions"
        direction="vertical"
        acyclic
        fit-view
        aria-label="客服问答流程"
        class="ai-workflow__canvas"
        style="height: 100%"
        @node-click="inspecting = true"
      >
        <DouFlowControls />
      </DouFlowEditor>
      <aside v-if="!narrow" class="ai-workflow__inspector">
        <template v-if="selected && kind">
          <div class="ai-workflow__inspector-title">
            <component :is="kind.icon" />
            {{ kind.label }}
          </div>
          <div class="ai-workflow__fields">
            <StepFields
              :node="selected"
              :kind="kind"
              :upstream="upstream"
              @update="update"
              @insert="insert"
            />
          </div>
        </template>
        <DouEmpty v-else size="sm" description="选中一个步骤查看它的设置" />
      </aside>
    </div>
    <DouDrawer
      v-if="narrow"
      v-model:open="inspectorOpen"
      placement="bottom"
      :title="kind?.label"
      size="60%"
      swipeable
    >
      <div v-if="selected && kind">
        <StepFields
          :node="selected"
          :kind="kind"
          :upstream="upstream"
          @update="update"
          @insert="insert"
        />
      </div>
    </DouDrawer>
  </div>
</template>

<style scoped>
.ai-workflow {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-container);
  background-color: var(--dou-color-bg-surface);
}

.ai-workflow__bar {
  display: flex;
  gap: 8px;
  align-items: center;
  height: 48px;
  padding: 0 12px 0 16px;
  border-bottom: 1px solid var(--dou-color-border);
}

.ai-workflow__name {
  flex: 1;
  min-width: 0;
  overflow-x: clip;
  font-weight: var(--dou-font-weight-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-workflow__body {
  display: flex;
  height: 600px;
}

.ai-workflow__canvas {
  flex: 1;
  min-width: 0;
  border: 0;
  border-radius: 0;
}

.ai-workflow__inspector {
  display: flex;
  flex-direction: column;
  width: 288px;
  overflow-y: auto;
  border-left: 1px solid var(--dou-color-border);
}

.ai-workflow__inspector > :deep(.dou-empty) {
  margin: auto;
}

.ai-workflow__inspector-title {
  display: flex;
  gap: 8px;
  align-items: center;
  height: 48px;
  padding: 0 16px;
  border-bottom: 1px solid var(--dou-color-border-subtle);
  font-weight: var(--dou-font-weight-medium);
}

.ai-workflow__inspector-title svg {
  width: 16px;
  height: 16px;
  color: var(--dou-color-text-secondary);
}

.ai-workflow__fields {
  padding: 16px;
}

@media (width < 720px) {
  .ai-workflow__body {
    height: 440px;
  }
}
</style>
