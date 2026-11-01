import type { Component } from 'vue'
import type { SheetContext } from '../context'
import type { SheetMessages } from '../locale'

/** Text shown in a menu or tooltip: fixed, or read from the sheet's messages so it follows the language. */
export type SheetLabel = string | ((messages: SheetMessages) => string)

export const labelOf = (label: SheetLabel | undefined, messages: SheetMessages) =>
  typeof label === 'function' ? label(messages) : (label ?? '')

/**
 * Something the sheet can do, by name: toolbar items, menu items and keys
 * can all refer to it, and take its label, icon and state from it.
 */
export interface SheetCommand<Arg = any> {
  label: SheetLabel
  icon?: Component
  /**
   * The key shown beside it, written as in `useHotkey` (e.g. `mod+shift+e`).
   * Only a hint: bind the key with the extension's `keymap`.
   */
  shortcut?: string
  /**
   * Does it. `arg` is what the caller passes to `commands.run`, if anything.
   * Return `false` when there was nothing to do.
   */
  run: (context: SheetContext, arg?: Arg) => boolean | void | Promise<unknown>
  /** Whether it can be run now; greyed out in menus and the toolbar when not. Defaults to `true`. */
  enabled?: (context: SheetContext) => boolean
  /** For a command that turns something on and off: whether it is on, e.g. bold for a bold cell. */
  active?: (context: SheetContext) => boolean
  /**
   * Lets it replace the built-in command of the same name. Without it, a
   * name the sheet already has is an error, so a command isn't replaced by accident.
   */
  override?: boolean
}

/** Declares a command; only gives it a type. */
export function defineSheetCommand<Arg = any>(command: SheetCommand<Arg>): SheetCommand<Arg> {
  return command
}

/** A command as menus and the toolbar show it. */
export interface SheetCommandInfo {
  name: string
  label: string
  icon?: Component
  shortcut?: string
  /** Whether it turns something on and off (it has `active`). */
  toggle: boolean
  /** Whether it is the sheet's own, not added or replaced by an extension. */
  builtin: boolean
}

/** The commands of a sheet, by name, for `useSheet().commands`. */
export interface SheetCommands {
  /**
   * Runs a command. Returns `false` when it can't be run now (`enabled`
   * says no) or it had nothing to do; `true` otherwise, also while an
   * asynchronous one is still running. An unknown name is an error.
   */
  run: (name: string, arg?: unknown) => boolean
  /** Whether a command is there and can be run now. */
  can: (name: string) => boolean
  /** Whether a command that turns something on and off is on. */
  active: (name: string) => boolean
  /** A command's label, icon and shortcut, or `undefined` when there is none by that name. */
  get: (name: string) => SheetCommandInfo | undefined
  /** Whether there is a command by that name. */
  has: (name: string) => boolean
  /** The names of every command, built in and added. */
  names: () => string[]
}

/**
 * Puts the built-in commands and the extensions' together. An extension's
 * command with a name already taken is an error, unless it says `override`
 * and the name is a built-in one.
 */
export function mergeCommands(
  builtin: Readonly<Record<string, SheetCommand>>,
  added: readonly { extension: string; commands: Readonly<Record<string, SheetCommand>> }[],
) {
  const map = new Map<string, SheetCommand>(Object.entries(builtin))
  const owner = new Map<string, string>()
  for (const { extension, commands } of added)
    for (const name in commands) {
      const command = commands[name]!
      const taken = owner.get(name)
      if (taken)
        throw new Error(
          `[@dou-ui/sheet] the command "${name}" is added by both "${taken}" and "${extension}"`,
        )
      if (map.has(name) && !command.override)
        throw new Error(
          `[@dou-ui/sheet] "${extension}" adds the command "${name}", which the sheet already has; set \`override: true\` to replace it`,
        )
      owner.set(name, extension)
      map.set(name, command)
    }
  return map
}

/** The `commands` of a context, over the commands by name. */
export function createCommands(
  commands: () => ReadonlyMap<string, SheetCommand>,
  context: () => SheetContext,
  builtin: Readonly<Record<string, SheetCommand>> = {},
): SheetCommands {
  const find = (name: string) => {
    const command = commands().get(name)
    if (!command) throw new Error(`[@dou-ui/sheet] there is no command "${name}"`)
    return command
  }
  const can = (name: string) => {
    const command = commands().get(name)
    return !!command && (command.enabled?.(context()) ?? true)
  }
  return {
    run(name, arg) {
      const command = find(name)
      const ctx = context()
      if (command.enabled && !command.enabled(ctx)) return false
      // a promise counts as done: it is the command's to report how it went
      return command.run(ctx, arg) !== false
    },
    can,
    active: (name) => !!commands().get(name)?.active?.(context()),
    get(name) {
      const command = commands().get(name)
      if (!command) return undefined
      return {
        name,
        label: labelOf(command.label, context().messages.value),
        icon: command.icon,
        shortcut: command.shortcut,
        toggle: !!command.active,
        builtin: builtin[name] === command,
      }
    },
    has: (name) => commands().has(name),
    names: () => [...commands().keys()],
  }
}
