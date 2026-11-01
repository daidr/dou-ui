import { defineEditorExtension } from '../../core/extension'
import AlignMenu from './align-menu.vue'
import AlignSub from './align-sub.vue'
import { setAlign } from './commands'

export { currentAlign, setAlign } from './commands'

/**
 * Aligning paragraphs, headings and quotes left, centered or right: a menu
 * in the formatting toolbar and in the block menu, and `Mod+Shift+L/E/R`.
 * The blocks keep it as `props.align`.
 */
export const align = defineEditorExtension({
  name: 'align',
  keymap: () => ({
    'mod+shift+l': setAlign(null),
    'mod+shift+e': setAlign('center'),
    'mod+shift+r': setAlign('right'),
  }),
  toolbar: [AlignMenu],
  blockMenu: [AlignSub],
})
