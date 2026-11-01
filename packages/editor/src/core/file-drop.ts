import { Plugin, PluginKey } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'

/** A block type that takes pasted and dropped files, e.g. images or attachments. */
export interface FileDropTarget {
  /** Whether the target takes this file. */
  accepts: (file: File) => boolean
  /** Takes files no other target accepts (attachments): asked last. */
  fallback?: boolean
  /** Insert blocks for the files after the block at `pos`; returns a position in the last one. */
  insert: (view: EditorView, files: File[], pos: number) => number
  /** Leave a paste to the browser, e.g. an image copied from a page comes with its address. */
  skipPaste?: (event: ClipboardEvent, files: File[]) => boolean
}

const fileDropKey = 'douFileDrop'

/**
 * A plugin that hands pasted and dropped files to the targets. However many
 * extensions take files, the first such plugin sorts all of them out, so
 * an image and a PDF pasted together both arrive.
 */
export function fileDropPlugin(target: FileDropTarget): Plugin {
  const handle = (
    view: EditorView,
    list: FileList | undefined | null,
    pos: number,
    event?: ClipboardEvent,
  ) => {
    const files = Array.from(list ?? [])
    if (!files.length) return false
    const targets = view.state.plugins
      .map(
        (plugin) =>
          (plugin.spec as Record<string, unknown>)[fileDropKey] as FileDropTarget | undefined,
      )
      .filter((item): item is FileDropTarget => !!item)
    // only the first file plugin does the work
    if (targets[0] !== target) return false
    const ordered = [
      ...targets.filter((item) => !item.fallback),
      ...targets.filter((item) => item.fallback),
    ]
    const runs: { target: FileDropTarget; files: File[] }[] = []
    for (const file of files) {
      const owner = ordered.find((item) => item.accepts(file))
      if (!owner) continue
      const last = runs.at(-1)
      if (last?.target === owner) last.files.push(file)
      else runs.push({ target: owner, files: [file] })
    }
    if (!runs.length) return false
    if (event && runs.length === 1 && runs[0]!.target.skipPaste?.(event, runs[0]!.files))
      return false
    // in the order the files came
    let at = pos
    for (const run of runs) at = run.target.insert(view, run.files, at)
    return true
  }
  return new Plugin({
    key: new PluginKey(),
    [fileDropKey]: target,
    props: {
      handlePaste(view: EditorView, event: ClipboardEvent) {
        return handle(view, event.clipboardData?.files, view.state.selection.from, event)
      },
      handleDrop(view: EditorView, event: DragEvent) {
        const dragEvent = event
        if (!dragEvent.dataTransfer?.files.length) return false
        const at = view.posAtCoords({ left: dragEvent.clientX, top: dragEvent.clientY })
        const handled = handle(
          view,
          dragEvent.dataTransfer.files,
          at?.pos ?? view.state.selection.from,
        )
        if (handled) event.preventDefault()
        return handled
      },
    },
  } as never)
}
