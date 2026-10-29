<script setup lang="ts">
import { CheckIcon, CloseIcon } from '@dou-ui/icons'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import type { StepItem, StepStatus, StepsProps, StepsSlots } from './steps'

defineOptions({ name: 'DouSteps' })

const props = withDefaults(defineProps<StepsProps>(), {
  items: () => [],
  status: 'process',
  direction: 'horizontal',
  size: 'md',
  clickable: false,
})
const current = defineModel<number>('current', { default: 0 })
const emit = defineEmits<{ change: [current: number] }>()
defineSlots<StepsSlots>()

const ns = useNamespace('steps')
const { t } = useLocale()

function statusOf(item: StepItem, index: number): StepStatus {
  if (item.status) return item.status
  if (index < current.value) return 'finish'
  if (index === current.value) return props.status
  return 'wait'
}

function go(item: StepItem, index: number) {
  if (!props.clickable || item.disabled || index === current.value) return
  current.value = index
  emit('change', index)
}
</script>

<template>
  <ol :class="[ns.b(), ns.m(direction), ns.m(size), ns.is('clickable', clickable)]">
    <li
      v-for="(item, index) in items"
      :key="index"
      :class="[ns.e('item'), ns.is(statusOf(item, index)), ns.is('disabled', !!item.disabled)]"
      :aria-current="index === current ? 'step' : undefined"
    >
      <component
        :is="clickable ? 'button' : 'div'"
        :type="clickable ? 'button' : undefined"
        :disabled="clickable && item.disabled ? true : undefined"
        :class="ns.e('main')"
        @click="go(item, index)"
      >
        <span :class="ns.e('marker')" aria-hidden="true">
          <component :is="item.icon" v-if="item.icon" :class="ns.e('icon')" />
          <CheckIcon v-else-if="statusOf(item, index) === 'finish'" :stroke-width="1.75" />
          <CloseIcon v-else-if="statusOf(item, index) === 'error'" :stroke-width="1.75" />
          <span v-else :class="ns.e('number')">{{ index + 1 }}</span>
        </span>
        <span :class="ns.e('text')">
          <span :class="ns.e('title')">
            <slot name="title" :item="item" :index="index" :status="statusOf(item, index)">
              {{ item.title }}
            </slot>
            <span :class="ns.e('status')">{{ ' ' + t(`steps.${statusOf(item, index)}`) }}</span>
          </span>
          <span v-if="item.description || $slots.description" :class="ns.e('description')">
            <slot name="description" :item="item" :index="index" :status="statusOf(item, index)">
              {{ item.description }}
            </slot>
          </span>
        </span>
      </component>
      <span v-if="index < items.length - 1" :class="ns.e('line')" aria-hidden="true" />
    </li>
  </ol>
</template>
