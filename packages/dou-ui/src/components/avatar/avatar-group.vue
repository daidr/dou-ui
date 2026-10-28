<script setup lang="ts">
import { Comment, Fragment, h, provide, toRef } from 'vue'
import type { VNode } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { avatarGroupKey } from './avatar'
import type { AvatarGroupProps, AvatarGroupSlots } from './avatar'

defineOptions({ name: 'DouAvatarGroup' })

const props = defineProps<AvatarGroupProps>()
const slots = defineSlots<AvatarGroupSlots>()

const ns = useNamespace('avatar-group')
const avatarNs = useNamespace('avatar')

provide(avatarGroupKey, {
  size: toRef(() => props.size),
  shape: toRef(() => props.shape),
})

function flatten(nodes: VNode[]): VNode[] {
  return nodes.flatMap((node) => {
    if (node.type === Comment) return []
    if (node.type === Fragment) return flatten((node.children as VNode[] | null) ?? [])
    return [node]
  })
}

/** The avatars up to `max`, then a `+N` avatar for the rest. */
function Items() {
  const children = flatten((slots.default?.() as VNode[] | undefined) ?? [])
  const max = props.max !== undefined && props.max >= 0 ? props.max : children.length
  const rest = children.length - max
  if (rest <= 0) return children

  const size = props.size ?? 'md'
  const style =
    typeof size === 'number'
      ? {
          '--dou-avatar-size': `${size}px`,
          '--dou-avatar-font-size': `${Math.round(size * 0.36)}px`,
        }
      : undefined
  const restNode = h(
    'span',
    {
      class: [
        avatarNs.b(),
        typeof size === 'string' && avatarNs.m(size),
        avatarNs.m(props.shape ?? 'circle'),
        ns.e('rest'),
      ],
      style,
    },
    h('span', { class: avatarNs.e('initials') }, `+${rest}`),
  )
  return [...children.slice(0, max), restNode]
}
</script>

<template>
  <span :class="ns.b()" role="group">
    <Items />
  </span>
</template>
