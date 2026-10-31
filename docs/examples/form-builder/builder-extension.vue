<script setup lang="ts">
import { ref } from 'vue'
import {
  defineFormBuilderExtension,
  DouFormBuilder,
  findNode,
  isField,
  isList,
  type FormBuilderContext,
  type FormDocument,
} from '@dou-ui/form-builder'
import { BadgeCheckIcon } from '@dou-ui/icons'

// 把选中的字段一起设为必填或选填：节点菜单里一项，Alt + R 一个快捷键，工具栏上一个按钮
function toggleRequired(builder: FormBuilderContext, ids: readonly string[]) {
  const nodes = ids
    .map((id) => findNode(builder.document, id))
    .filter((node) => node && (isField(node) || isList(node)))
  if (!nodes.length) return
  const required = !nodes.every((node) => 'required' in node! && node.required)
  const tr = builder.transaction()
  for (const node of nodes) tr.update(node!.id, { required: required || undefined })
  tr.setMeta('origin', 'required-tools')
  builder.dispatch(tr)
}

const requiredTools = defineFormBuilderExtension({
  name: 'required-tools',
  menu: (builder, nodes) => [
    {
      key: 'required',
      label: '切换必填',
      icon: BadgeCheckIcon,
      shortcut: 'alt+r',
      run: () =>
        toggleRequired(
          builder,
          nodes.map((node) => node.id),
        ),
    },
  ],
  keymap: (builder) => ({
    'alt+r': () => toggleRequired(builder, builder.selection),
  }),
  toolbar: (builder) => [
    {
      key: 'required',
      label: '切换必填',
      icon: BadgeCheckIcon,
      shortcut: 'alt+r',
      disabled: !builder.selection.length,
      run: () => toggleRequired(builder, builder.selection),
    },
  ],
})

const form = ref<FormDocument>({
  version: 1,
  nodes: [
    { id: 'name', type: 'input', name: 'name', label: '姓名', span: 6 },
    { id: 'city', type: 'input', name: 'city', label: '所在城市', default: '上海', span: 6 },
    { id: 'note', type: 'textarea', name: 'note', label: '备注' },
  ],
})
const selection = ref<string[]>(['name', 'city'])
</script>

<template>
  <DouFormBuilder v-model="form" v-model:selection="selection" :extensions="[requiredTools]" />
</template>
