import { withInstall } from 'dou-ui'
import FormBuilder from './form-builder.vue'
import Inspector from './inspector.vue'
import Outline from './outline.vue'
import Palette from './palette.vue'
import { FormBuilderCanvas } from './canvas'

export const DouFormBuilder = withInstall(FormBuilder)
export const DouFormBuilderPalette = withInstall(Palette)
export const DouFormBuilderInspector = withInstall(Inspector)
export const DouFormBuilderOutline = withInstall(Outline)
export const DouFormBuilderCanvas = withInstall(FormBuilderCanvas)

export type {
  FormBuilderEmits,
  FormBuilderExpose,
  FormBuilderProps,
  FormBuilderSlots,
} from './types'
export { useFormBuilder } from './context'
export type { FormBuilderContext, FormDispatchOptions, FormSelectMode } from './context'
export {
  applyFormSteps,
  canHold,
  compactFormSteps,
  FormBuilderTransaction,
  placesOf,
} from './core/transaction'
export type {
  FormBuilderStep,
  FormBuilderTransactionMeta,
  FormDocumentPatch,
  FormNodePatch,
  FormNodePlace,
} from './core/transaction'
export { FormBuilderHistory } from './core/history'
export type { FormInsertPlace } from './core/commands'
export { formDesignerLocales, useFormDesignerMessages } from './locale'
export type { FormDesignerMessages, FormDesignerMessagesOverride } from './locale'

export type FormBuilderInstance = InstanceType<typeof FormBuilder>

declare module 'vue' {
  export interface GlobalComponents {
    DouFormBuilder: typeof DouFormBuilder
    DouFormBuilderPalette: typeof DouFormBuilderPalette
    DouFormBuilderInspector: typeof DouFormBuilderInspector
    DouFormBuilderOutline: typeof DouFormBuilderOutline
    DouFormBuilderCanvas: typeof DouFormBuilderCanvas
  }
}
