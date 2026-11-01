import type { FormHTMLAttributes } from 'vue'
import { withInstall } from '../../utils/install'
import Form from './form.vue'
import FormItem from './form-item.vue'

export const DouForm = withInstall<typeof Form, FormHTMLAttributes>(Form)
export const DouFormItem = withInstall(FormItem)
export default DouForm

export { formItemKey, formKey, showFormErrors } from './form'
export { useFormDisabled, useFormItem, useFormReadonly, useFormSize } from './use-form-item'
export type * from './form'
export { isStandardSchema } from './standard-schema'
export type { StandardSchemaV1 } from './standard-schema'
export type FormInstance = InstanceType<typeof Form>
export type FormItemInstance = InstanceType<typeof FormItem>

declare module 'vue' {
  export interface GlobalComponents {
    DouForm: typeof DouForm
    DouFormItem: typeof DouFormItem
  }
}
