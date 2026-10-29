<script setup lang="ts">
import { computed } from 'vue'
import { useNamespace } from '../../utils/namespace'
import DouAvatar from '../avatar/avatar.vue'
import type { UserProps, UserSlots } from './user'

defineOptions({ name: 'DouUser' })

const props = withDefaults(defineProps<UserProps>(), { size: 'md' })
const slots = defineSlots<UserSlots>()

const ns = useNamespace('user')

const avatarProps = computed(() =>
  typeof props.avatar === 'string' ? { src: props.avatar } : (props.avatar ?? {}),
)
</script>

<template>
  <div :class="[ns.b(), ns.m(size)]">
    <slot name="avatar">
      <DouAvatar :name="name" v-bind="avatarProps" :size="size" :class="ns.e('avatar')" />
    </slot>
    <div :class="ns.e('text')">
      <span v-if="slots.name || name" :class="ns.e('name')"
        ><slot name="name">{{ name }}</slot></span
      >
      <span v-if="slots.description || description" :class="ns.e('description')">
        <slot name="description">{{ description }}</slot>
      </span>
    </div>
    <div v-if="slots.default" :class="ns.e('extra')"><slot /></div>
  </div>
</template>
