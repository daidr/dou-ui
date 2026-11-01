import { inject, markRaw } from 'vue'
import type { Component, InjectionKey } from 'vue'
import type { FormFieldNode, FormNode } from '../core/types'
import type { FormFormatContext } from './format'

export type FormFieldProps = Record<string, unknown>

/**
 * What a field type is: how it renders, what it starts with, and which
 * settings it takes. The renderer and the builder share the same list.
 */
export interface FormFieldType<P extends FormFieldProps = FormFieldProps> {
  /** The name nodes refer to it by in `type`. A type of the same name as a built-in one replaces it. */
  type: string
  /** Shown to people building the form. */
  label?: string
  /**
   * - `value`: holds a value at the node's `name`, wrapped in a form item
   *   with its label, help and checks.
   * - `display`: only shows something, such as text or a divider.
   */
  kind?: 'value' | 'display'
  /** Settings a node starts with, below its own `props`. */
  defaultProps?: Partial<P>
  /**
   * The type's empty value, which a field starts with when its node sets
   * no `default`, e.g. `[]` for a list of choices. Defaults to `null`.
   */
  empty?: (props: P) => unknown
  /**
   * Renders the field. A `value` field gets `modelValue`, listens to
   * `update:modelValue`, and receives the settings as props (after
   * `toProps`). Call `useFormField()` inside it for the node itself.
   */
  component: Component
  /**
   * The prop that takes the list of options, for a type whose options can
   * come from a source (a node's `source`), e.g. `options` or `data`.
   */
  optionsProp?: string
  /**
   * Narrows a value to what new options offer, e.g. drops a city once the
   * province changes. Called when a source loads different options; the
   * value stays as it is when the type has none.
   */
  fitValue?: (value: unknown, options: readonly unknown[]) => unknown
  /**
   * The value as text, for a renderer that is `readonly`. Gets the
   * settings (with options loaded from a source). Not called for an empty
   * value, which shows as the renderer's `noValue` text. Defaults to the
   * labels of the chosen options for a type with `optionsProp`, else to
   * the value as plain text: lists joined, booleans as yes and no.
   */
  format?: (value: unknown, props: P, context: FormFormatContext) => string
  /**
   * Shows the value in a `readonly` renderer instead of `format`'s text,
   * e.g. a swatch for a color. Gets `modelValue` and the same props as
   * `component`, and `readonly` when it takes one.
   */
  readonlyComponent?: Component
  /** Turns the settings into the component's props, when they differ. */
  toProps?: (props: P, node: FormFieldNode) => Record<string, unknown>
  /** The builder's palette: the type's icon, e.g. one of `@dou-ui/icons`. */
  icon?: Component
  /**
   * The palette group the type is listed in: `input`, `choice`, `more`
   * (the default), `display`, or a name of your own, shown as it is.
   */
  group?: string
  /**
   * The settings the builder's inspector shows for the type, as nodes of
   * a form whose values are the node's `props`: a field named
   * `placeholder` edits `props.placeholder`, and expressions read the
   * other settings as `values`. A setting left at its `default` is not
   * written to the node.
   */
  settings?: FormNode[]
}

/** Declare a field type. Gives the spec its types and leaves it as is otherwise. */
export function defineFormField<P extends FormFieldProps = FormFieldProps>(
  spec: FormFieldType<P>,
): FormFieldType<P> {
  const result = { ...spec, component: markRaw(spec.component) }
  if (spec.icon) result.icon = markRaw(spec.icon)
  if (spec.readonlyComponent) result.readonlyComponent = markRaw(spec.readonlyComponent)
  return result
}

/** Settings of a node: its type's `defaultProps` with its own `props` on top. */
export function fieldProps(type: FormFieldType | undefined, node: FormFieldNode): FormFieldProps {
  const base = type?.defaultProps as FormFieldProps | undefined
  if (!base) return node.props ?? {}
  return node.props ? { ...base, ...node.props } : base
}

export interface FormFieldContext {
  /** The node being rendered. */
  node: FormFieldNode
  /** Its type. */
  type: FormFieldType
  /** Its settings, with the type's `defaultProps` filled in. */
  props: FormFieldProps
}

export const formFieldKey: InjectionKey<() => FormFieldContext> = Symbol('DouFormField')

/**
 * Inside a field type's component: the node it renders, its type and
 * settings. The properties stay current when the node changes.
 */
export function useFormField(): Readonly<FormFieldContext> {
  const get = inject(formFieldKey, undefined)
  if (!get)
    throw new Error('[@dou-ui/form-builder] useFormField() must be called inside a form field')
  return {
    get node() {
      return get().node
    },
    get type() {
      return get().type
    },
    get props() {
      return get().props
    },
  }
}
