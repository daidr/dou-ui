<script setup lang="ts">
import { UserIcon } from '@dou-ui/icons'
import { computed, inject, ref, watch } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { avatarGroupKey } from './avatar'
import type { AvatarProps, AvatarSlots } from './avatar'

defineOptions({ name: 'DouAvatar' })

const props = defineProps<AvatarProps>()
const slots = defineSlots<AvatarSlots>()

const ns = useNamespace('avatar')
const group = inject(avatarGroupKey, undefined)

const size = computed(() => props.size ?? group?.size.value ?? 'md')
const shape = computed(() => props.shape ?? group?.shape.value ?? 'circle')

const failed = ref(false)
watch(
  () => props.src,
  () => (failed.value = false),
)
const showImage = computed(() => !!props.src && !failed.value)

/**
 * One character for a CJK name (its family name reads as the person),
 * otherwise the first letters of the first and last words.
 */
function initialsOf(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return ''
  const words = trimmed.split(/\s+/)
  const first = Array.from(words[0]!)[0]!
  // Beyond Latin, e.g. CJK, one character is the whole initial.
  if (first.codePointAt(0)! > 0x24f) return first
  const last = words.length > 1 ? Array.from(words[words.length - 1]!)[0]! : ''
  return (first + last).toUpperCase()
}
const initials = computed(() => (props.name ? initialsOf(props.name) : ''))

const style = computed(() =>
  typeof size.value === 'number'
    ? {
        '--dou-avatar-size': `${size.value}px`,
        '--dou-avatar-font-size': `${Math.round(size.value * 0.4)}px`,
      }
    : undefined,
)

const classes = computed(() => [
  ns.b(),
  typeof size.value === 'string' && ns.m(size.value),
  ns.m(shape.value),
  ns.is('image', showImage.value),
])
</script>

<template>
  <span
    :class="classes"
    :style="style"
    :role="showImage ? undefined : 'img'"
    :aria-label="showImage ? undefined : name"
    :aria-hidden="!showImage && !name ? 'true' : undefined"
  >
    <img
      v-if="showImage"
      :class="ns.e('image')"
      :src="src"
      :alt="alt ?? name ?? ''"
      draggable="false"
      @error="failed = true"
    />
    <slot v-else-if="slots.default" />
    <span v-else-if="initials" :class="ns.e('initials')" aria-hidden="true">{{ initials }}</span>
    <UserIcon v-else :class="ns.e('fallback')" />
  </span>
</template>
