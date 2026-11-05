import { type AppContext, h, nextTick, render } from 'vue'
import FlowEditor from '../flow-editor.vue'
import type { FlowEditorExpose, FlowEditorProps } from '../context'
import type { FlowDocument } from '../core/model'
import type { FlowExportOptions, FlowImageOptions } from './draw'

export interface RenderFlowOptions
  extends
    Pick<
      FlowEditorProps,
      'extensions' | 'nodeTypes' | 'edgeTypes' | 'edgeType' | 'portTypes' | 'direction' | 'messages'
    >,
    Omit<FlowExportOptions, 'range'> {
  /** The colors to draw with; the page's own theme by default. */
  theme?: 'light' | 'dark'
  /**
   * The app context node components render in, for what they take from the
   * app, e.g. `getCurrentInstance()!.appContext`; none by default.
   */
  appContext?: AppContext | null
}

export interface RenderFlowImageOptions extends RenderFlowOptions {
  /** Pixels per CSS pixel. Defaults to `2`. */
  pixelRatio?: number
}

const frame = () =>
  new Promise<void>((resolve) =>
    typeof requestAnimationFrame === 'undefined'
      ? setTimeout(resolve, 16)
      : requestAnimationFrame(() => resolve()),
  )

/**
 * Draws the document in an editor of its own, out of sight, and hands the
 * editor to `use` once every node has been laid out and measured; the
 * editor is removed after.
 */
async function withEditor<T>(
  document: FlowDocument,
  options: RenderFlowOptions,
  use: (editor: FlowEditorExpose) => T | Promise<T>,
): Promise<T> {
  if (typeof window === 'undefined')
    throw new Error(
      '[@dou-ui/flow] renderFlowSVG needs a browser: it lays out the nodes on the page',
    )
  const host = window.document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.inert = true
  // Laid out, so nodes measure, but not seen and never in the way.
  host.style.cssText =
    'position:fixed;top:0;left:0;width:800px;height:600px;overflow:hidden;visibility:hidden;pointer-events:none;contain:strict;z-index:-1'
  if (options.theme) host.setAttribute('data-dou-theme', options.theme)
  window.document.body.append(host)
  const vnode = h(FlowEditor, {
    modelValue: document,
    extensions: options.extensions,
    nodeTypes: options.nodeTypes,
    edgeTypes: options.edgeTypes,
    edgeType: options.edgeType,
    portTypes: options.portTypes,
    direction: options.direction,
    messages: options.messages,
    readonly: true,
    fitView: false,
    searchable: false,
  })
  vnode.appContext = options.appContext ?? null
  try {
    render(vnode, host)
    // Nodes measure after they mount, and edges follow their ports; text needs its font.
    await nextTick()
    await frame()
    if (window.document.fonts?.ready) await window.document.fonts.ready
    await frame()
    await nextTick()
    const editor = vnode.component?.exposed as FlowEditorExpose | undefined
    if (!editor) throw new Error('[@dou-ui/flow] the flow could not be drawn')
    return await use(editor)
  } finally {
    render(null, host)
    host.remove()
  }
}

/**
 * The document as an SVG document, drawn as `exportSVG` draws it, without an
 * editor on the page: for thumbnails and previews. Give it the same node,
 * edge and port types as the editor that shows the document.
 */
export function renderFlowSVG(document: FlowDocument, options: RenderFlowOptions = {}) {
  return withEditor(document, options, (editor) =>
    editor.exportSVG({ padding: options.padding, background: options.background }),
  )
}

/** The document as a PNG image, as `exportPNG` draws it, without an editor on the page. */
export function renderFlowPNG(document: FlowDocument, options: RenderFlowImageOptions = {}) {
  return withEditor(document, options, (editor) =>
    editor.exportPNG({
      padding: options.padding,
      background: options.background,
      pixelRatio: options.pixelRatio,
    } satisfies FlowImageOptions),
  )
}
