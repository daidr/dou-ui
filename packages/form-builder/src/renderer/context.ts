import type { Component, InjectionKey, VNode } from 'vue'
import type { FormModel, FormRules, FormValidateResult } from 'dou-ui'
import type { FormRendererMessages, FormRendererMessagesOverride } from '../locale'
import type { FormFieldType } from '../fields/define'
import type { FormDocument, FormNode } from '../core/types'
import type { FormFunction } from '../core/expression'

export interface FormRendererProps {
  /** The form to render: its fields, groups and layout, as plain data. */
  form: FormDocument
  /**
   * The object the fields write to, changed in place. Pass a reactive
   * object to read the values as they change; fields missing from it are
   * filled with their defaults. Defaults to an object of the renderer's own.
   */
  model?: FormModel
  /** Field types besides the built-in ones; one of the same name replaces the built-in type. */
  fields?: FormFieldType<any>[]
  /** More rules by field name, e.g. checks that need code. Added to the document's own. */
  rules?: FormRules
  /** Disable every field. */
  disabled?: boolean
  /**
   * Functions the document's expressions can call besides the built-in
   * ones, e.g. `{ tax: (price) => price * 0.06 }`. They get plain values
   * and should not change them; one of the same name replaces a built-in function.
   */
  functions?: Record<string, FormFunction>
  /**
   * Where options come from, by the name a node's `source` gives. A source
   * gets the result of the node's `arg` expression and returns the
   * options, or a promise of them. Results are kept for each name and
   * `arg`, so fields asking the same thing share one call. `reloadSource`
   * forgets them, e.g. after the options changed on the server.
   */
  sources?: Record<string, FormOptionsLoader>
  /**
   * Submit the values of hidden fields too. By default `submit` hands over
   * a copy of the values without them (see `visibleValues`), so a field
   * that was filled in and then hidden is not sent.
   */
  keepHidden?: boolean
  /** Replaces texts of the locale, e.g. the step buttons. */
  messages?: FormRendererMessagesOverride
}

/** Loads the options of a field, given the result of its `source.arg`. */
export type FormOptionsLoader = (arg: any) => unknown[] | Promise<unknown[]>

export interface FormRendererEmits {
  /** A field changed its value: its `name`, and the value it now holds. */
  change: [name: string, value: unknown]
  /**
   * The form was submitted and every field passed: a copy of the values,
   * without the ones of hidden fields unless `keepHidden` is set.
   */
  submit: [values: FormModel]
  /** The form was submitted and some fields failed. */
  invalid: [errors: Record<string, string>]
  /** The form was reset to its starting values. */
  reset: []
}

export interface FormRendererSlots {
  /**
   * After the fields, e.g. the submit and reset buttons. In a form that is
   * a series of steps, on the last step beside the back button.
   */
  default?: () => unknown
}

export interface FormRendererExpose {
  /** The object the fields write to. */
  readonly model: FormModel
  /** Check the given fields, or every field. Never rejects. */
  validate: (names?: string | string[]) => Promise<FormValidateResult>
  /**
   * Restore the given fields, or every field, to their starting values and
   * clear their errors. Resetting every field also goes back to the first step.
   */
  resetFields: (names?: string | string[]) => void
  /** Clear the errors of the given fields, or every field. */
  clearValidate: (names?: string | string[]) => void
  /** Scroll a field into view and focus it. */
  scrollToField: (name: string) => void
  /** Forget the options loaded from a source, or from every source, and load them again. */
  reloadSource: (name?: string) => void
  /** A copy of the values as `submit` hands them over, without hidden fields unless `keepHidden` is set. */
  getValues: () => FormModel
}

/** What every node of a renderer reads. */
export interface RendererContext {
  model: () => FormModel
  fields: () => Map<string, FormFieldType>
  /** Pixel width of the label column in the horizontal layout, else `undefined`. */
  labelWidth: () => number | undefined
  /** Tell the renderer a field wrote a value. */
  changed: (name: string, value: unknown) => void
  /** The functions expressions can call besides the built-in ones. */
  functions: () => Record<string, FormFunction> | undefined
  /** The options from a source, shared by every field asking the same thing. */
  load: (name: string, arg: unknown) => Promise<unknown[]>
  /** Bumped by `reloadSource`, so fields reading it load again. */
  sourceVersion: (name: string) => number
  messages: () => FormRendererMessages
  validate: (names: string[]) => Promise<FormValidateResult>
  scrollToField: (name: string) => void
  /**
   * Add something that can bring a field into view, e.g. tabs selecting
   * the page it is on. It says whether it holds the field.
   */
  addRevealer: (reveal: (path: string) => boolean) => () => void
  /** Follow the error a form item shows, so tabs can mark the pages with errors. */
  trackError: (path: () => string | undefined, error: () => string | undefined) => () => void
  /** The paths of the fields that show an error now. */
  errorPaths: () => string[]
  /** The default slot, for the steps that show it on their last step. */
  footer: () => unknown
  /** The id of the steps that show the default slot, if the form is a series of steps. */
  footerOwner: () => string | undefined
  /** Counts the times the whole form was reset, so steps go back to the first one. */
  resets: () => number
}

/** Where a node sits: inside a list item, its fields' paths start with the item's. */
export interface NodeScope {
  /** Put before the names of fields, e.g. `guests.2.`. */
  prefix: () => string
  /** The item, read as `item` by expressions. */
  item: () => unknown
  /** Fields of the item whose formulas read each other in a circle; they are not worked out. */
  blocked: () => ReadonlySet<string>
}

export const scopeKey: InjectionKey<NodeScope> = Symbol('DouFormNodeScope')

export const rendererKey: InjectionKey<RendererContext> = Symbol('DouFormRenderer')

/** Whether the groups around a node are disabled. */
export const disabledKey: InjectionKey<() => boolean> = Symbol('DouFormNodeDisabled')

/** The scope of nodes outside lists. */
export const rootScope: NodeScope = {
  prefix: () => '',
  item: () => null,
  blocked: () => new Set(),
}

/** The full path of a name in a scope. */
export const pathIn = (scope: NodeScope, name: string) => scope.prefix() + name

/** The props of a node's view. */
export type NodeProps = { node: FormNode; columns: number; inset: number; asPage: boolean }

/** Runs an expression of a node (the viewed one by default); `fallback` when it is unset or does not parse. */
export type Condition = (source: string | undefined, fallback: boolean, node?: FormNode) => boolean

/** What container views draw their children with, handed in to keep the modules apart. */
export interface NodeKit {
  view: Component
  renderNodes: (nodes: readonly FormNode[], columns: number, inset?: number) => VNode[]
}
