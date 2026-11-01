import { Selection, type Command } from 'prosemirror-state'
import type { EditorExtension } from '../core/extension'
import { codeBlock } from '../extensions/code-block'
import { codeEditorLanguages, toEntry } from './languages'
import type { CodeEditorBlockOptions } from './types'
import { codeEditorView } from './view'

export { codeEditorLanguages, findCodeLanguage } from './languages'
export type { CodeEditorBlockOptions, CodeEditorLanguage } from './types'

/**
 * The code block, edited in `@dou-ui/code`'s editor: highlighted as you
 * type, with bracket matching, multiple cursors, search and the language's
 * indentation. The document is the same as with the built-in code block
 * (a `codeBlock` with a `language` prop), and so are HTML and Markdown;
 * undo, collaboration and moving blocks work as for the other blocks.
 *
 * ```ts
 * extensions: [editorKit({ codeBlock: codeEditorBlock() })]
 * ```
 *
 * Needs `@dou-ui/code` and its styles.
 */
export function codeEditorBlock(options: CodeEditorBlockOptions = {}): EditorExtension {
  const languages = (options.languages ?? codeEditorLanguages).map(toEntry)
  const base = codeBlock({
    languages: languages.map((entry) => ({
      value: entry.language.name,
      label: entry.label,
    })),
  })
  const spec = base.blocks!.codeBlock!
  return {
    ...base,
    // the spec stays the same, so documents, HTML and Markdown don't change
    blocks: { codeBlock: { ...spec, component: undefined } },
    // the code editor colors the code itself
    plugins: undefined,
    componentViews: {
      codeBlock: (mount) => codeEditorView(mount, { ...options, languages }),
    },
    keymap: () => ({
      arrowup: enterCode('up'),
      arrowleft: enterCode('left'),
      arrowdown: enterCode('down'),
      arrowright: enterCode('right'),
    }),
  }
}

/**
 * The arrows at the edge of a block move into a code block next to it:
 * the browser would step over it, as it does over anything not editable.
 * The cursor goes to the code's last line going up, its first going down.
 */
function enterCode(dir: 'up' | 'down' | 'left' | 'right'): Command {
  return (state, dispatch, view) => {
    if (!view || !state.selection.empty || !view.endOfTextblock(dir)) return false
    const forward = dir === 'down' || dir === 'right'
    const $head = state.selection.$head
    const edge = forward ? $head.after() : $head.before()
    const next = Selection.near(state.doc.resolve(edge), forward ? 1 : -1)
    const code = next.$head.parent
    if (!code.type.spec.code || next.$head.sameParent($head)) return false
    if (dispatch) {
      const start = next.$head.start()
      const pos = forward ? start : start + code.content.size
      dispatch(state.tr.setSelection(Selection.near(state.doc.resolve(pos))).scrollIntoView())
    }
    return true
  }
}
