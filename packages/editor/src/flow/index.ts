import { flowKit, type FlowDocument, type FlowEditorProps, type FlowExtension } from '@dou-ui/flow'
import { whiteboardKit, type WhiteboardKitOptions } from '@dou-ui/flow/whiteboard'
import { ShapesIcon, WorkflowIcon } from '@dou-ui/icons'
import { NodeSelection, type Command } from 'prosemirror-state'
import { defineComponent, h } from 'vue'
import { labelOf, type BlockOption, type EditorExtension, type Label } from '../core/extension'
import { escapeHTML } from '../core/output'
import { defineBlock } from '../define-block'
import { editorLocales } from '../locale'
import BoardBlock from './board-block.vue'
import {
  boardOf,
  BOARD_OPEN_EVENT,
  checkBoardProps,
  clampHeight,
  heightOf,
  type BoardBlockSettings,
} from './board'

export { boardOf } from './board'

/** The props of the fullscreen editor that a flow block may set. */
export type FlowBlockEditorProps = Omit<
  FlowEditorProps,
  'extensions' | 'readonly' | 'fitView' | 'comments' | 'author' | 'activeComment' | 'commentable'
>

export interface FlowBlockOptions {
  /** The block type, e.g. `approvalFlow`; unique among the editor's blocks. */
  type: string
  /** What the flow is made of, as the editor's `extensions`. `[flowKit()]` by default. */
  extensions?: (FlowExtension | FlowExtension[])[]
  /** More props for the flow editors, e.g. `nodeTypes`, `portTypes` or `direction`. */
  editorProps?: FlowBlockEditorProps
  /** The block's name: the title of the fullscreen editor, and of its slash menu entry. */
  label: Label
  /** The slash menu entry, or `false` to leave it out (blocks then come from code or pasting). */
  menu?: (Omit<BlockOption, 'key' | 'type' | 'label'> & { key?: string; label?: Label }) | false
  /** The height of a new block in the document, in px. Defaults to `360`. */
  height?: number
  /**
   * How a block is written in `blocksToHTML`, e.g. an `<img>` of a picture
   * of it the app keeps. By default a `<figure>` with its name, which
   * pasting reads back as the block.
   */
  html?: (board: FlowDocument, block: { id: string; props: Record<string, unknown> }) => string
}

const fence = (type: string) => `dou-${type}`

function attrsOf(dom: HTMLElement, height: number) {
  let board: unknown = null
  try {
    board = JSON.parse(dom.getAttribute('data-prop-board') ?? 'null')
  } catch {
    // a board that can't be read is an empty one
  }
  // `320`, or written by hand `320px`
  const stored = Number.parseFloat(dom.getAttribute('data-prop-height') ?? '')
  return { board: board ? boardOf(board) : null, height: stored > 0 ? clampHeight(stored) : height }
}

/** Turns ```dou-<type> fences from Markdown back into blocks. */
function readFences(root: HTMLElement, type: string) {
  for (const code of root.querySelectorAll<HTMLElement>(`pre > code.language-${fence(type)}`)) {
    let written: unknown
    try {
      written = JSON.parse(code.textContent ?? '')
    } catch {
      continue
    }
    // `{ height, board }`, or the board alone
    const wrapped = !!written && typeof written === 'object' && 'board' in written
    const { board, height } = (wrapped ? written : { board: written }) as {
      board: unknown
      height?: unknown
    }
    const element = root.ownerDocument.createElement('div')
    element.dataset.contentType = type
    element.setAttribute('data-prop-board', JSON.stringify(boardOf(board)))
    if (typeof height === 'number') element.setAttribute('data-prop-height', String(height))
    code.parentElement!.replaceWith(element)
  }
}

/**
 * A block that holds a flow, drawn with `@dou-ui/flow`: the document shows
 * it whole, and it is edited in a fullscreen editor (double-click, the
 * “Edit” button, or `Enter` while the block is selected). The flow is the
 * block's `board` prop; collaboration merges it node by node.
 *
 * ```ts
 * extensions: [editorKit(), flowBlock({ type: 'approvalFlow', label: '审批流程', extensions: [flowKit(), approval()] })]
 * ```
 *
 * Needs `@dou-ui/flow` and its styles. For a whiteboard, `whiteboardBlock()`.
 */
export function flowBlock(options: FlowBlockOptions): EditorExtension {
  const { type } = options
  const settings: BoardBlockSettings = {
    label: options.label,
    extensions: options.extensions ?? [flowKit()],
    editorProps: options.editorProps ?? {},
    height: options.height ?? 360,
    builtIn: !options.extensions,
  }
  const View = defineComponent({
    name: 'DouEditorFlowBlockView',
    inheritAttrs: false,
    setup(_props, { attrs }) {
      return () => h(BoardBlock, { ...attrs, settings } as never)
    },
  })
  const menu = options.menu === false ? undefined : options.menu
  const block = defineBlock({
    type,
    props: { board: null, height: settings.height },
    content: 'none',
    component: View,
    menu:
      options.menu === false
        ? undefined
        : { icon: WorkflowIcon, ...menu, label: menu?.label ?? options.label },
    spec: {
      mergeProps: { board: { lists: ['nodes', 'edges'], objects: ['data'] } },
      // for `checkDocument`: what the block would read differently
      checkProps: checkBoardProps,
      // what is copied, and what `blocksToHTML` writes
      parseDOM: [`div[data-content-type="${type}"]`, `figure[data-content-type="${type}"]`].map(
        (tag) => ({
          tag,
          // before the figures of images, whatever the app's HTML puts inside
          priority: 70,
          getAttrs: (dom: HTMLElement) => attrsOf(dom, settings.height),
        }),
      ),
    },
  })
  /** `Enter` on the selected block opens it. */
  const open: Command = (state, dispatch, view) => {
    const { selection } = state
    if (!(selection instanceof NodeSelection) || selection.node.type.name !== type) return false
    if (dispatch && view) {
      const dom = view.nodeDOM(selection.from) as HTMLElement | null
      dom?.querySelector('.dou-editor-board')?.dispatchEvent(new CustomEvent(BOARD_OPEN_EVENT))
    }
    return true
  }
  return {
    ...block,
    name: `flow:${type}`,
    keymap: () => ({ enter: open }),
    prepareHTML: (root) => readFences(root, type),
    output: {
      blocks: {
        [type]: {
          html: (node, { children }) => {
            const board = boardOf(node.props.board)
            // written outside an editor: in Chinese, as the other output
            const inside = options.html
              ? options.html(board, node)
              : `<figcaption>${escapeHTML(labelOf(options.label, editorLocales['zh-CN']!))}</figcaption>`
            // the board stays on the figure, so pasting it reads back the block
            return `<figure data-content-type="${escapeHTML(type)}" data-prop-board="${escapeHTML(JSON.stringify(board))}" data-prop-height="${heightOf(node.props.height, settings.height)}">${inside}</figure>${children}`
          },
          markdown: (node, { children }) => {
            const value = {
              height: heightOf(node.props.height, settings.height),
              board: boardOf(node.props.board),
            }
            const written = `\`\`\`${fence(type)}\n${JSON.stringify(value)}\n\`\`\``
            return children ? `${written}\n\n${children}` : written
          },
        },
      },
    },
  }
}

export interface WhiteboardBlockOptions
  extends
    Pick<WhiteboardKitOptions, 'upload' | 'onUploadError'>,
    Pick<FlowBlockOptions, 'height' | 'html' | 'editorProps'> {
  /** The slash menu entry, or `false` to leave it out. */
  menu?: FlowBlockOptions['menu']
}

/**
 * A whiteboard block: shapes, sticky notes, text, pen strokes, images and
 * connectors, drawn in a fullscreen editor. Pass the `upload` of `image()`
 * so pictures on the board are uploaded too, not kept in the document.
 *
 * ```ts
 * extensions: [editorKit(), whiteboardBlock({ upload })]
 * ```
 */
export function whiteboardBlock(options: WhiteboardBlockOptions = {}): EditorExtension {
  return flowBlock({
    type: 'whiteboard',
    label: (m) => m.types.whiteboard,
    extensions: [
      flowKit(),
      whiteboardKit({ upload: options.upload, onUploadError: options.onUploadError }),
    ],
    editorProps: options.editorProps,
    height: options.height,
    html: options.html,
    menu:
      options.menu === false
        ? false
        : {
            icon: ShapesIcon,
            hint: (m) => m.hints.whiteboard,
            keywords: ['whiteboard', 'board', 'draw', 'flowchart', 'baiban', 'huatu', 'liuchengtu'],
            ...options.menu,
          },
  })
}
