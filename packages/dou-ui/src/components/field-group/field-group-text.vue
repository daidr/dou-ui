<script setup lang="ts">
import { useNamespace } from '../../utils/namespace'
import { useFormSize } from '../form/use-form-item'
import type { FieldGroupTextSlots } from './field-group'

defineOptions({ name: 'DouFieldGroupText' })
defineSlots<FieldGroupTextSlots>()

const ns = useNamespace('field-group-text')
const size = useFormSize(() => undefined)
</script>

<template>
  <span :class="[ns.b(), ns.m(size)]"><slot /></span>
</template>
