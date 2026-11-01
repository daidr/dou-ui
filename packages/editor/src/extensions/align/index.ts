import type { Command } from 'prosemirror-state'
import { defineEditorExtension } from '../../core/extension'
import AlignMenu from './align-menu.vue'
import AlignSub from './align-sub.vue'
import { setAlign } from './commands'

export { currentAlign, setAlign } from './commands'

const always =
  (command: Command): Command =>
  (state, dispatch, view) => {
    command(state, dispatch, view)
    return true
  }

/**
 * Aligning paragraphs, headings and quotes left, centered or right: a menu
 * in the formatting toolbar and in the block menu, and `Mod+Shift+L/E/R`.
 * The blocks keep it as `props.align`.
 */
export const align = defineEditorExtension({
  name: 'align',
  // taken in the editor even where nothing can be aligned: Mod+Shift+R would reload the page
  keymap: () => ({
    'mod+shift+l': always(setAlign(null)),
    'mod+shift+e': always(setAlign('center')),
    'mod+shift+r': always(setAlign('right')),
  }),
  toolbar: [AlignMenu],
  blockMenu: [AlignSub],
})
