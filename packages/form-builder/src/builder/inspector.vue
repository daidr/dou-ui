<script setup lang="ts">
import { computed, onBeforeUnmount, useTemplateRef, watchEffect } from 'vue'
import { DouButton } from 'dou-ui'
import type { FormRules } from 'dou-ui'
import { CopyIcon, PlusIcon, SquareDashedIcon, TrashIcon } from '@dou-ui/icons'
import { isContainer, isField, isList } from '../core/document'
import type { FormFieldNode, FormNode, FormRuleSpec } from '../core/types'
import { builtinFields } from '../fields/builtin'
import { normalizeOptions } from '../fields/components'
import type { FormFieldType } from '../fields/define'
import { formatMessage } from '../locale'
import FormRenderer from '../renderer/form-renderer.vue'
import { useBuilderState } from './context'
import { scopeOf } from './core/commands'
import { formNodePlaces } from './core/transaction'
import {
  itemToRule,
  logicScope,
  sameLogicScope,
  logicSettings,
  ruleSettings,
  ruleToItem,
} from './logic'
import type { LogicScope } from './logic'
import { conditionField, expressionField } from './logic-fields'
import {
  builtinSettings,
  documentSettings,
  iconOf,
  labelOf,
  nodeSettings,
  nodeTitle,
  settingsDocument,
} from './settings'
import { useSettingsBinding } from './settings-binding'
import { spanField } from './span-field'

defineOptions({ name: 'DouFormBuilderInspector' })

const state = useBuilderState()
const root = useTemplateRef<HTMLElement>('root')
watchEffect(() => (state.inspector.value = root.value))
onBeforeUnmount(() => {
  if (state.inspector.value === root.value) state.inspector.value = null
})

const messages = computed(() => state.messages)
const types = computed(() => state.fields as Map<string, FormFieldType>)
const builderFields = [spanField, expressionField, conditionField]
const extra = builderFields
const rendererFields = computed(() => [...types.value.values(), ...builderFields])
const inspectorFields = computed(
  () => new Map([...types.value, ...builderFields.map((type) => [type.type, type] as const)]),
)

const count = computed(() => state.selection.length)
const node = computed(() => (count.value === 1 ? state.focused.value : undefined))
const place = computed(() =>
  node.value ? formNodePlaces(state.document).get(node.value.id) : undefined,
)
const spec = computed(() =>
  node.value && isField(node.value) ? types.value.get(node.value.type) : undefined,
)

/** Columns of the grid a node sits on. */
function gridColumns(id: string | undefined) {
  const document = state.document
  const own = Math.max(1, Math.round(document.columns ?? 12))
  if (!id) return own
  const map = formNodePlaces(document)
  let parent = map.get(id)?.parent
  while (parent) {
    if ('columns' in parent && parent.columns) return parent.columns
    if (parent.type === 'tabs' || parent.type === 'steps') {
      parent = map.get(parent.id)?.parent
      continue
    }
    parent = map.get(parent.id)?.parent
  }
  return own
}

// The settings forms change only with what they depend on, so typing in one keeps the others.
function memo<T>(deps: () => unknown[], make: () => T) {
  let last: unknown[] | undefined
  let value: T
  return computed(() => {
    const next = deps()
    if (!last || next.length !== last.length || next.some((dep, index) => dep !== last![index])) {
      last = next
      value = make()
    }
    return value
  })
}

const columns = computed(() => gridColumns(node.value?.id))
const inItem = computed(() => !!scopeOf(state.document, place.value?.parent?.id ?? null))

const nodeForm = memo(
  () => {
    const current = node.value
    const kind = current && (isField(current) ? 'field' : current.type)
    return [
      kind,
      current?.type,
      (current as FormFieldNode | undefined)?.props,
      columns.value,
      inItem.value,
      messages.value,
      spec.value,
    ]
  },
  () =>
    settingsDocument(
      node.value
        ? nodeSettings(node.value, {
            messages: messages.value,
            columns: columns.value,
            inItem: inItem.value,
            type: spec.value,
          })
        : [],
    ),
)

const isBuiltin = (type: FormFieldType | undefined) => !!type && builtinFields.includes(type)
const typeForm = memo(
  () => [node.value?.type, spec.value, messages.value],
  () => {
    const type = spec.value
    const nodes =
      type?.settings ?? (isBuiltin(type) ? builtinSettings(type!.type, messages.value) : [])
    return settingsDocument(nodes)
  },
)
const formForm = memo(
  () => [messages.value],
  () => settingsDocument(documentSettings(messages.value)),
)
const spanForm = memo(
  () => [messages.value, state.document.columns],
  () =>
    settingsDocument(
      nodeSettings(
        { id: '', type: 'tabs', children: [] },
        {
          messages: messages.value,
          columns: Math.max(1, Math.round(state.document.columns ?? 12)),
          inItem: false,
        },
      ),
    ),
)

// What the node's logic can read; kept as one object while the fields it lists stay the same.
let lastScope: LogicScope | undefined
const logic = computed(() => {
  const next = logicScope(state.document, node.value?.id, types.value, messages.value)
  if (!lastScope || !sameLogicScope(lastScope, next)) lastScope = next
  return lastScope
})
const holdsValue = computed(() => {
  const current = node.value
  if (!current) return false
  return isList(current) || (isField(current) && spec.value?.kind !== 'display')
})

const logicForm = memo(
  () => [
    node.value?.type,
    (node.value as FormFieldNode | undefined)?.name,
    logic.value,
    spec.value,
    messages.value,
  ],
  () =>
    settingsDocument(
      node.value
        ? logicSettings(node.value, {
            messages: messages.value,
            scope: logic.value,
            type: spec.value,
          })
        : [],
    ),
)
const ruleForm = memo(
  () => [holdsValue.value, logic.value, messages.value],
  () =>
    settingsDocument(
      holdsValue.value ? ruleSettings({ messages: messages.value, scope: logic.value }) : [],
    ),
)

function update(id: string, patch: Record<string, unknown>) {
  const tr = state.transaction().update(id, patch)
  tr.setMeta('group', `inspector:${id}:${Object.keys(patch).join(',')}`)
  tr.setMeta('origin', 'inspector')
  state.dispatch(tr)
  return formNodePlaces(state.document).get(id)?.node
}

const nodeModel = useSettingsBinding({
  source: () => node.value as Record<string, unknown> | undefined,
  form: () => nodeForm.value,
  fields: () => inspectorFields.value,
  apply: (patch) =>
    node.value ? (update(node.value.id, patch) as unknown as Record<string, unknown>) : undefined,
})

const logicModel = useSettingsBinding({
  source: () => node.value as Record<string, unknown> | undefined,
  form: () => logicForm.value,
  fields: () => inspectorFields.value,
  apply: (patch) =>
    node.value ? (update(node.value.id, patch) as unknown as Record<string, unknown>) : undefined,
})

const ruleModel = useSettingsBinding({
  source: () => node.value as Record<string, unknown> | undefined,
  form: () => ruleForm.value,
  fields: () => inspectorFields.value,
  prepare: (data) => {
    const rules = (data.rules as FormRuleSpec[] | undefined) ?? []
    return { ...data, rules: rules.map(ruleToItem) }
  },
  apply: (patch) => {
    const current = node.value
    if (!current || !('rules' in patch)) return undefined
    const items = (patch.rules as Record<string, unknown>[] | undefined) ?? []
    const rules = items.map(itemToRule)
    return update(current.id, { rules: rules.length ? rules : undefined }) as unknown as
      Record<string, unknown> | undefined
  },
})

/** Parts of the inspector from extensions, for the node or the form. */
const sections = computed(() =>
  count.value > 1
    ? []
    : state.extensions().inspectors.flatMap((inspector) => inspector(state, node.value)),
)

const typeModel = useSettingsBinding({
  source: () => (node.value as FormFieldNode | undefined)?.props,
  key: () => node.value?.id,
  form: () => typeForm.value,
  fields: () => inspectorFields.value,
  prepare: (props) => {
    // Options written as plain values show as rows of text and value.
    const prop = spec.value?.optionsProp
    const options = prop ? props[prop] : undefined
    if (prop && Array.isArray(options) && options.some((option) => typeof option !== 'object'))
      props[prop] = normalizeOptions(options).map(({ label, value }) => ({ label, value }))
    return props
  },
  apply: (patch) => {
    const current = node.value as FormFieldNode | undefined
    if (!current) return undefined
    const props: Record<string, unknown> = { ...current.props }
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) delete props[key]
      else props[key] = value
    }
    const next = update(current.id, { props: Object.keys(props).length ? props : undefined })
    return (next as FormFieldNode | undefined)?.props
  },
})

// The document's own settings, as an object that changes only when one of them does.
const settingKeys = [
  'layout',
  'labelAlign',
  'labelWidth',
  'size',
  'requiredMark',
  'columns',
] as const
let lastSettings: Record<string, unknown> = {}
const documentSettingsOf = computed(() => {
  const document = state.document as unknown as Record<string, unknown>
  if (settingKeys.every((key) => lastSettings[key] === document[key])) return lastSettings
  const next: Record<string, unknown> = {}
  for (const key of settingKeys) if (document[key] !== undefined) next[key] = document[key]
  return (lastSettings = next)
})

const formModel = useSettingsBinding({
  source: () => documentSettingsOf.value,
  form: () => formForm.value,
  fields: () => inspectorFields.value,
  apply: (patch) => {
    const tr = state.transaction().updateDocument(patch)
    tr.setMeta('group', `inspector:document:${Object.keys(patch).join(',')}`)
    tr.setMeta('origin', 'inspector')
    state.dispatch(tr)
    return documentSettingsOf.value
  },
})

const spanModel = useSettingsBinding({
  source: () =>
    count.value > 1 ? (state.focused.value as Record<string, unknown> | undefined) : undefined,
  key: () => state.selection.join(),
  form: () => spanForm.value,
  fields: () => inspectorFields.value,
  apply: (patch) => {
    const tr = state.transaction()
    for (const id of state.selection) tr.update(id, patch)
    tr.setMeta('group', `inspector:${state.selection.join()}:span`)
    state.dispatch(tr)
    return state.focused.value as Record<string, unknown> | undefined
  },
})

/** The other names of the scope the node's name is a key of. */
function otherNames(current: FormNode) {
  const document = state.document
  const scope = scopeOf(document, formNodePlaces(document).get(current.id)?.parent?.id ?? null)
  const names = new Set<string>()
  const visit = (nodes: readonly FormNode[]) => {
    for (const each of nodes) {
      if (each.id !== current.id && 'name' in each && each.name) names.add(each.name)
      if (isContainer(each) && !isList(each)) visit(each.children)
    }
  }
  visit(scope ? scope.children : document.nodes)
  return names
}

const nameRules = computed<FormRules>(() => ({
  name: [
    {
      validator: (value: unknown) => {
        const current = node.value
        if (!current) return true
        const name = typeof value === 'string' ? value.trim() : ''
        if (!name) return holdsValue.value ? messages.value.errors.name : true
        if (otherNames(current).has(name))
          return formatMessage(messages.value.errors.taken, { text: name })
        return true
      },
      trigger: 'change',
    },
  ],
}))

const heading = computed(() => {
  if (count.value > 1)
    return {
      icon: SquareDashedIcon,
      title: formatMessage(messages.value.inspector.multiple, { count: count.value }),
      type: '',
    }
  const current = node.value
  if (!current) return { icon: undefined, title: messages.value.inspector.form, type: '' }
  const type = labelOf(current.type, types.value.get(current.type), messages.value)
  const title = nodeTitle(current, types.value, messages.value)
  return {
    icon: iconOf(current.type, types.value.get(current.type)),
    title,
    type: title === type ? '' : type,
  }
})

const holdsPages = computed(() => node.value?.type === 'tabs' || node.value?.type === 'steps')
const canWrap = computed(() => {
  const map = formNodePlaces(state.document)
  const parents = new Set(state.selection.map((id) => map.get(id)?.parent?.id ?? null))
  return parents.size === 1 && !state.selection.some((id) => map.get(id)?.node.type === 'page')
})
</script>

<template>
  <div ref="root" class="dou-form-builder__inspector">
    <div class="dou-form-builder__inspector-header">
      <component :is="heading.icon" v-if="heading.icon" class="dou-form-builder__inspector-icon" />
      <span class="dou-form-builder__inspector-title">{{ heading.title }}</span>
      <span v-if="heading.type" class="dou-form-builder__inspector-type">{{ heading.type }}</span>
    </div>
    <div class="dou-form-builder__inspector-body">
      <template v-if="count > 1">
        <FormRenderer :form="spanForm" :model="spanModel" :fields="extra" />
        <div class="dou-form-builder__inspector-actions">
          <DouButton size="sm" variant="outline" @click="state.duplicate()">
            <template #leading><CopyIcon /></template>
            {{ messages.actions.duplicate }}
          </DouButton>
          <DouButton size="sm" variant="outline" :disabled="!canWrap" @click="state.wrap()">
            <template #leading><SquareDashedIcon /></template>
            {{ messages.actions.wrap }}
          </DouButton>
          <DouButton size="sm" variant="outline" tone="danger" @click="state.remove()">
            <template #leading><TrashIcon /></template>
            {{ messages.actions.remove }}
          </DouButton>
        </div>
      </template>
      <template v-else-if="node">
        <FormRenderer
          :key="node.id"
          :form="nodeForm"
          :model="nodeModel"
          :fields="rendererFields"
          :rules="nameRules"
        />
        <DouButton
          v-if="holdsPages"
          class="dou-form-builder__inspector-add"
          size="sm"
          variant="outline"
          @click="state.addPage(node.id)"
        >
          <template #leading><PlusIcon /></template>
          {{ messages.actions.addPage }}
        </DouButton>
        <template v-if="typeForm.nodes.length">
          <div class="dou-form-builder__inspector-section">{{ messages.inspector.type }}</div>
          <FormRenderer
            :key="`${node.id}/props`"
            :form="typeForm"
            :model="typeModel"
            :fields="rendererFields"
          />
        </template>
        <template v-if="ruleForm.nodes.length">
          <div class="dou-form-builder__inspector-section">{{ messages.inspector.rules }}</div>
          <FormRenderer
            :key="`${node.id}/rules`"
            :form="ruleForm"
            :model="ruleModel"
            :fields="rendererFields"
          />
        </template>
        <div class="dou-form-builder__inspector-section">{{ messages.inspector.logic }}</div>
        <FormRenderer
          :key="`${node.id}/logic`"
          :form="logicForm"
          :model="logicModel"
          :fields="rendererFields"
        />
      </template>
      <FormRenderer v-else :form="formForm" :model="formModel" :fields="extra" />
      <template v-for="section in sections" :key="section.key">
        <div class="dou-form-builder__inspector-section">{{ section.title }}</div>
        <component :is="section.component" v-bind="section.props" />
      </template>
    </div>
  </div>
</template>
