<script setup lang="ts">
import { RefreshIcon } from '@dou-ui/icons'
import { computed } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import { DouSpinner } from '../spinner'
import { encodeQr } from './encode'
import type { QrcodeProps, QrcodeSlots } from './qrcode'

defineOptions({ name: 'DouQrcode' })

const props = withDefaults(defineProps<QrcodeProps>(), {
  size: 160,
  level: 'M',
  margin: 2,
  status: 'active',
  bordered: true,
})
const emit = defineEmits<{ refresh: [] }>()
const slots = defineSlots<QrcodeSlots>()

const ns = useNamespace('qrcode')
const { t } = useLocale()

// A centered icon hides modules, so it needs the most error correction.
const code = computed(() => encodeQr(props.value, props.icon ? 'H' : props.level))

/** One path for all dark modules, a horizontal run of them at a time. */
const path = computed(() => {
  const { modules, size } = code.value
  const m = props.margin
  let d = ''
  for (let y = 0; y < size; y++) {
    let x = 0
    while (x < size) {
      if (!modules[y]![x]) {
        x++
        continue
      }
      const start = x
      while (x < size && modules[y]![x]) x++
      d += `M${start + m} ${y + m}h${x - start}v1h${start - x}z`
    }
  }
  return d
})

const box = computed(() => code.value.size + props.margin * 2)
const iconSize = computed(() => props.iconSize ?? Math.round(props.size / 5))
const label = computed(() => t('qrcode.label', { value: props.value }))
</script>

<template>
  <div
    :class="[ns.b(), ns.is(status, status !== 'active'), ns.is('bordered', bordered)]"
    :style="{
      '--dou-qrcode-size': `${size}px`,
      '--dou-qrcode-color': color,
      '--dou-qrcode-bg': bgColor,
    }"
  >
    <svg
      :class="ns.e('svg')"
      :viewBox="`0 0 ${box} ${box}`"
      :width="size"
      :height="size"
      shape-rendering="crispEdges"
      role="img"
      :aria-label="label"
    >
      <rect :width="box" :height="box" :class="ns.e('bg')" />
      <path :d="path" :class="ns.e('modules')" />
    </svg>
    <img
      v-if="icon"
      :src="icon"
      alt=""
      :class="ns.e('icon')"
      :style="{ width: `${iconSize}px`, height: `${iconSize}px` }"
    />
    <div v-if="status !== 'active'" :class="ns.e('cover')">
      <slot name="status" :status="status">
        <DouSpinner v-if="status === 'loading'" :label="t('qrcode.loading')" />
        <template v-else>
          <span :class="ns.e('expired')">{{ expiredText ?? t('qrcode.expired') }}</span>
          <button type="button" :class="ns.e('refresh')" @click="emit('refresh')">
            <RefreshIcon />
            {{ t('qrcode.refresh') }}
          </button>
        </template>
      </slot>
    </div>
  </div>
</template>
