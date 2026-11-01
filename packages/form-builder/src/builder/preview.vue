<script setup lang="ts">
import { computed, reactive, shallowRef, watch } from 'vue'
import { DouButton, DouSegmentedControl } from 'dou-ui'
import type { FormModel } from 'dou-ui'
import { CheckCircleIcon, MonitorIcon, SmartphoneIcon, TabletIcon } from '@dou-ui/icons'
import FormRenderer from '../renderer/form-renderer.vue'
import { useBuilderState } from './context'

/**
 * The form as people will fill it in, at the width of a desktop, a tablet
 * or a phone. The values are kept while the form is edited, so switching
 * back and forth does not lose them; submitting shows what would be sent.
 */
defineOptions({ name: 'DouFormBuilderPreview' })

type Device = 'desktop' | 'tablet' | 'phone'

const state = useBuilderState()
const messages = computed(() => state.messages.preview)
const fields = computed(() => [...state.fields.values()])

const device = shallowRef<Device>('desktop')
const widths: Record<Device, number | undefined> = { desktop: undefined, tablet: 768, phone: 375 }
const icons = { desktop: MonitorIcon, tablet: TabletIcon, phone: SmartphoneIcon }
const devices = computed(() =>
  (['desktop', 'tablet', 'phone'] as const).map((value) => ({
    value,
    label: messages.value.devices[value],
  })),
)

const model = reactive<FormModel>({})
const result = shallowRef<FormModel | null>(null)
watch(
  () => state.document,
  () => (result.value = null),
)
const shown = computed(() => (result.value ? JSON.stringify(result.value, null, 2) : ''))
</script>

<template>
  <div class="dou-form-builder__preview" role="region" :aria-label="messages.label">
    <div class="dou-form-builder__preview-bar">
      <DouSegmentedControl
        v-model="device"
        :options="devices"
        :aria-label="messages.device"
        size="sm"
        class="dou-form-builder__preview-devices"
      >
        <template #option="{ option }">
          <span class="dou-form-builder__preview-device">
            <component :is="icons[option.value as Device]" />
            <span>{{ option.label }}</span>
          </span>
        </template>
      </DouSegmentedControl>
    </div>
    <div class="dou-form-builder__preview-scroll">
      <div
        class="dou-form-builder__preview-frame"
        :data-device="device"
        :style="widths[device] ? { width: `${widths[device]}px` } : undefined"
      >
        <FormRenderer
          :form="state.document"
          :model="model"
          :fields="fields"
          :functions="state.functions()"
          :sources="state.sources()"
          :validators="state.validators()"
          @submit="result = $event"
          @invalid="result = null"
          @reset="result = null"
        >
          <div class="dou-form-builder__preview-footer">
            <DouButton native-type="submit" tone="primary">{{ messages.submit }}</DouButton>
            <DouButton native-type="reset" variant="outline">{{ messages.reset }}</DouButton>
          </div>
        </FormRenderer>
        <div v-if="result" class="dou-form-builder__preview-result" role="status">
          <div class="dou-form-builder__preview-result-title">
            <CheckCircleIcon />
            <span>{{ messages.passed }}</span>
          </div>
          <pre class="dou-form-builder__preview-result-code">{{ shown }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>
