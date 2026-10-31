import { withInstall } from 'dou-ui'
import FormBuilder from './form-builder.vue'
import Inspector from './inspector.vue'
import Outline from './outline.vue'
import Palette from './palette.vue'
import Preview from './preview.vue'
import { FormBuilderCanvas } from './canvas'

export const DouFormBuilder = withInstall(FormBuilder)
export const DouFormBuilderPalette = withInstall(Palette)
export const DouFormBuilderInspector = withInstall(Inspector)
export const DouFormBuilderOutline = withInstall(Outline)
export const DouFormBuilderCanvas = withInstall(FormBuilderCanvas)
export const DouFormBuilderPreview = withInstall(Preview)

export type {
  FormBuilderEmits,
  FormBuilderExpose,
  FormBuilderProps,
  FormBuilderSlots,
} from './types'
export { useFormBuilder } from './context'
export type {
  FormBuilderContext,
  FormBuilderDispatchOptions,
  FormBuilderMode,
  FormBuilderSelectMode,
} from './context'
export {
  defineFormBuilderExtension,
  resolveFormBuilderExtensions,
  resolveFormBuilderFields,
} from './extension'
export type {
  FormBuilderExtension,
  FormBuilderExtensionContext,
  FormBuilderInspectorSection,
  FormBuilderKeyHandler,
  FormBuilderMenuItem,
  FormBuilderToolbarItem,
  ResolvedFormBuilderExtensions,
} from './extension'
export {
  applyFormSteps,
  canContainFormNode,
  compactFormSteps,
  FormBuilderTransaction,
  formNodePlaces,
} from './core/transaction'
export type {
  FormBuilderStep,
  FormBuilderTransactionMeta,
  FormDocumentPatch,
  FormNodePatch,
  FormNodePlace,
} from './core/transaction'
export { FormBuilderHistory } from './core/history'
export type { FormBuilderInsertPlace } from './core/commands'
export { formBuilderLocales, useFormBuilderMessages } from './locale'
export type { FormBuilderMessages, FormBuilderMessagesOverride } from './locale'

export type FormBuilderInstance = InstanceType<typeof FormBuilder>

declare module 'vue' {
  export interface GlobalComponents {
    DouFormBuilder: typeof DouFormBuilder
    DouFormBuilderPalette: typeof DouFormBuilderPalette
    DouFormBuilderInspector: typeof DouFormBuilderInspector
    DouFormBuilderOutline: typeof DouFormBuilderOutline
    DouFormBuilderCanvas: typeof DouFormBuilderCanvas
    DouFormBuilderPreview: typeof DouFormBuilderPreview
  }
}
