import type { Node as PMNode } from 'prosemirror-model'
import { TableView } from 'prosemirror-tables'
import type { NodeView, ViewMutationRecord } from 'prosemirror-view'

/** The narrowest a column gets, without a width of its own and when resized. */
export const CELL_MIN_WIDTH = 96

/** The least length of the horizontal scrollbar thumb, so wide tables stay easy to grab. */
const MIN_THUMB = 24

/** How long the scrollbar stays visible after scrolling stops, in ms. */
const SCROLL_IDLE_MS = 900

/**
 * A table in the editor: an outer frame (`this.dom`, the block's content
 * element), an inner scrolling viewport around the table, and a lightweight
 * custom horizontal scrollbar aligned to the text column's start edge.
 *
 * Keeping the viewport inside the frame lets top-level wide tables scroll into
 * the left reading-width margin while the scrollbar starts flush with the
 * text column, and prevents the edge-fade mask (`is-cut-start` / `is-cut-end`)
 * from fading the ends of the scrollbar itself.
 */
export class TableBlockView extends TableView implements NodeView {
  readonly viewport: HTMLDivElement
  readonly bar: HTMLDivElement
  readonly thumb: HTMLDivElement

  private readonly observer: ResizeObserver | null = null
  private thumbSize = 0
  private dragging = false
  private dragStartX = 0
  private dragStartScroll = 0
  private idleTimer: ReturnType<typeof setTimeout> | undefined
  private rafId = 0

  private readonly onScroll = () => {
    this.sync()
    this.dom.classList.add('is-scrolling')
    clearTimeout(this.idleTimer)
    this.idleTimer = setTimeout(() => {
      this.dom.classList.remove('is-scrolling')
    }, SCROLL_IDLE_MS)
  }

  private readonly onResize = () => this.scheduleSync()

  private readonly onBarMouseDown = (event: MouseEvent) => {
    // Keep ProseMirror from moving the text selection or blurring the editor.
    event.preventDefault()
  }

  private readonly onTrackDown = (event: PointerEvent) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    if (!this.thumbSize) this.updateScrollbar()
    const room = this.viewport.scrollWidth - this.viewport.clientWidth
    const box = this.bar.getBoundingClientRect()
    const free = box.width - this.thumbSize
    if (room <= 1 || free <= 0) return
    const rtl = this.isRtl()
    const at = (rtl ? box.right - event.clientX : event.clientX - box.left) - this.thumbSize / 2
    const ratio = Math.min(1, Math.max(0, at / free))
    this.viewport.scrollLeft = rtl ? -ratio * room : ratio * room
    this.sync()
  }

  private readonly onThumbDown = (event: PointerEvent) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    if (!this.thumbSize) this.updateScrollbar()
    this.thumb.setPointerCapture?.(event.pointerId)
    this.dragging = true
    this.dragStartX = event.clientX
    this.dragStartScroll = this.viewport.scrollLeft
    this.dom.classList.add('is-dragging')
    window.addEventListener('pointermove', this.onThumbMove)
    window.addEventListener('pointerup', this.onThumbUp)
    window.addEventListener('pointercancel', this.onThumbUp)
  }

  private readonly onThumbMove = (event: PointerEvent) => {
    if (!this.dragging) return
    const room = this.viewport.scrollWidth - this.viewport.clientWidth
    const track = this.bar.clientWidth || this.bar.getBoundingClientRect().width
    const free = track - this.thumbSize
    if (room <= 1 || free <= 0) return
    const moved = event.clientX - this.dragStartX
    const next = this.dragStartScroll + (moved / free) * room
    this.viewport.scrollLeft = this.isRtl()
      ? Math.min(0, Math.max(-room, next))
      : Math.max(0, Math.min(room, next))
    this.sync()
  }

  private readonly onThumbUp = () => {
    if (!this.dragging) return
    this.dragging = false
    this.dom.classList.remove('is-dragging')
    window.removeEventListener('pointermove', this.onThumbMove)
    window.removeEventListener('pointerup', this.onThumbUp)
    window.removeEventListener('pointercancel', this.onThumbUp)
  }

  constructor(node: PMNode) {
    super(node, CELL_MIN_WIDTH)
    this.dom.className = 'dou-editor__content dou-editor__content--table'
    this.dom.dataset.contentType = 'table'
    this.table.className = 'dou-editor-table'

    this.viewport = document.createElement('div')
    this.viewport.className = 'dou-editor-table__viewport'
    this.viewport.appendChild(this.table)
    this.dom.appendChild(this.viewport)

    this.bar = document.createElement('div')
    this.bar.className = 'dou-editor-table__scrollbar'
    this.bar.contentEditable = 'false'
    this.bar.setAttribute('aria-hidden', 'true')

    this.thumb = document.createElement('div')
    this.thumb.className = 'dou-editor-table__scrollbar-thumb'
    this.bar.appendChild(this.thumb)
    this.dom.appendChild(this.bar)

    this.viewport.addEventListener('scroll', this.onScroll, { passive: true })
    this.bar.addEventListener('mousedown', this.onBarMouseDown)
    this.bar.addEventListener('pointerdown', this.onTrackDown)
    this.thumb.addEventListener('pointerdown', this.onThumbDown)

    if (typeof ResizeObserver !== 'undefined') {
      // the frame, viewport, table (columns added/removed/resized), and track width (reading margin changes)
      this.observer = new ResizeObserver(this.onResize)
      this.observer.observe(this.dom)
      this.observer.observe(this.viewport)
      this.observer.observe(this.table)
      this.observer.observe(this.bar)
    }
  }

  private isRtl() {
    return getComputedStyle(this.viewport).direction === 'rtl'
  }

  private scheduleSync() {
    if (this.rafId || typeof requestAnimationFrame === 'undefined') {
      if (typeof requestAnimationFrame === 'undefined') this.sync()
      return
    }
    this.rafId = requestAnimationFrame(() => {
      this.rafId = 0
      this.sync()
    })
  }

  /** Sync edge-fade classes and the custom scrollbar thumb geometry. */
  private sync() {
    this.edges()
    this.updateScrollbar()
  }

  /** Which sides cut columns off: the table's edges against the viewport's, padding left out. */
  private edges() {
    const viewport = this.viewport
    const style = getComputedStyle(viewport)
    const start = Number.parseFloat(style.paddingInlineStart) || 0
    const end = Number.parseFloat(style.paddingInlineEnd) || 0
    const hidden = viewport.scrollWidth - viewport.clientWidth
    // `scrollLeft` is negative in right-to-left pages.
    const left = Math.abs(viewport.scrollLeft)
    viewport.classList.toggle('is-cut-start', left > start + 0.5)
    viewport.classList.toggle('is-cut-end', left < hidden - end - 0.5)
  }

  /** Size and position the custom scrollbar thumb along its track. */
  private updateScrollbar() {
    const viewport = this.viewport
    const client = viewport.clientWidth
    const total = viewport.scrollWidth
    const room = total - client
    const active = room > 1
    this.dom.classList.toggle('is-scrollable', active)
    this.bar.classList.toggle('is-active', active)
    if (!active) {
      this.thumbSize = 0
      return
    }
    const track = this.bar.clientWidth || this.bar.getBoundingClientRect().width
    if (track <= 0) return
    const size = Math.min(track, Math.max(MIN_THUMB, Math.round((client / total) * track)))
    const free = track - size
    const ratio = Math.min(1, Math.max(0, Math.abs(viewport.scrollLeft) / room))
    const offset = Math.round(ratio * free)
    const rtl = this.isRtl()
    this.thumbSize = size
    this.thumb.style.width = `${size}px`
    this.thumb.style.transform = `translateX(${rtl ? -offset : offset}px)`
  }

  override update(node: PMNode) {
    const ok = super.update(node)
    if (ok) this.scheduleSync()
    return ok
  }

  stopEvent(event: Event) {
    return event.target instanceof Node && this.bar.contains(event.target)
  }

  override ignoreMutation(record: ViewMutationRecord) {
    // the frame's, viewport's and custom scrollbar's attributes are ours
    const target = record.target
    if (
      target === this.dom ||
      target === this.viewport ||
      (target instanceof Node && this.bar.contains(target))
    )
      return true
    return super.ignoreMutation(record)
  }

  destroy() {
    this.viewport.removeEventListener('scroll', this.onScroll)
    this.bar.removeEventListener('mousedown', this.onBarMouseDown)
    this.bar.removeEventListener('pointerdown', this.onTrackDown)
    this.thumb.removeEventListener('pointerdown', this.onThumbDown)
    window.removeEventListener('pointermove', this.onThumbMove)
    window.removeEventListener('pointerup', this.onThumbUp)
    window.removeEventListener('pointercancel', this.onThumbUp)
    this.observer?.disconnect()
    clearTimeout(this.idleTimer)
    if (this.rafId && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(this.rafId)
  }
}
