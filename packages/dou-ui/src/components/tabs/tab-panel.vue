<script setup lang="ts">
import {
  computed,
  getCurrentInstance,
  inject,
  onBeforeUnmount,
  onMounted,
  ref,
  useTemplateRef,
  watch,
} from 'vue'
import { useNamespace } from '../../utils/namespace'
import { tabsKey } from './tabs'
import type { TabPanelProps, TabPanelSlots } from './tabs'

defineOptions({ name: 'DouTabPanel' })

const props = withDefaults(defineProps<TabPanelProps>(), {
  disabled: false,
  closable: undefined,
  draggable: undefined,
  eager: false,
})
const slots = defineSlots<TabPanelSlots>()

const ns = useNamespace('tabs')
const tabs = inject(tabsKey, undefined)
const uid = getCurrentInstance()!.uid
const el = useTemplateRef<HTMLElement>('el')

tabs?.register({ uid, props, slots, el })
onMounted(() => tabs?.reorder())
onBeforeUnmount(() => tabs?.unregister(uid))

const selected = computed(() => tabs?.selected.value === props.value)

// Render the content the first time the panel is shown, then keep it, so
// switching back is instant and keeps its state.
const visited = ref(selected.value || props.eager)
watch(selected, (value) => {
  if (value) visited.value = true
})
</script>

<template>
  <div
    :id="tabs?.panelId(value)"
    ref="el"
    :class="ns.e('panel')"
    role="tabpanel"
    :aria-labelledby="tabs?.tabId(value)"
    :hidden="!selected"
    tabindex="0"
  >
    <slot v-if="visited" />
  </div>
</template>
