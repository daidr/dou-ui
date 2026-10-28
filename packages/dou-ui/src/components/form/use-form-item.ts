import { computed, inject } from 'vue'
import type { ComputedRef } from 'vue'
import type { Size } from '../../utils/types'
import { useGlobalConfig } from '../config-provider/use-config'
import { formItemKey, formKey } from './form'

/** The form and form item around the current component, if any. */
export function useFormItem() {
  return {
    form: inject(formKey, undefined),
    formItem: inject(formItemKey, undefined),
  }
}

/**
 * The size a control renders at: its own prop, else the form's, else the
 * nearest global config's, else `md`.
 */
export function useFormSize(own: () => Size | undefined): ComputedRef<Size> {
  const form = inject(formKey, undefined)
  const config = useGlobalConfig()
  return computed(() => own() ?? form?.size.value ?? config.value.size)
}

/** A control is disabled by its own prop or by the form around it. */
export function useFormDisabled(own: () => boolean | undefined): ComputedRef<boolean> {
  const form = inject(formKey, undefined)
  return computed(() => !!own() || !!form?.disabled.value)
}
