import { inject, onScopeDispose, provide, toValue, watch } from 'vue'
import type { InjectionKey, MaybeRefOrGetter } from 'vue'
import { isComposing } from '../utils/keyboard'

/**
 * A floating layer: anything drawn above the page that can be dismissed.
 *
 * Open layers form a stack. `Escape` goes to the topmost one only, and a
 * press counts as "outside" a layer only when it misses the layer, its
 * reference and every layer opened from inside it, so a menu opened in a
 * dialog does not close the dialog.
 */
export interface Layer {
  parent: Layer | null
  children: Set<Layer>
  /** Whether `target` is inside this layer or one of its descendants. */
  contains: (target: Node) => boolean
}

interface LayerEntry extends Layer {
  owns: (target: Node) => boolean
  onEscape?: (event: KeyboardEvent) => void
  onOutside?: (event: PointerEvent) => void
}

const stack: LayerEntry[] = []
const layerKey: InjectionKey<Layer> = Symbol('DouLayer')

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || isComposing(event) || event.defaultPrevented) return
  const top = stack.at(-1)
  if (!top) return
  // The topmost layer owns Escape even when it chooses to stay open, so a
  // dialog that ignores Escape does not let it reach the page below.
  event.stopPropagation()
  top.onEscape?.(event)
}

function onPointerdown(event: PointerEvent) {
  const target = event.composedPath()[0]
  if (!(target instanceof Node)) return
  for (let index = stack.length - 1; index >= 0; index--) {
    const layer = stack[index]
    if (layer && !layer.contains(target)) layer.onOutside?.(event)
  }
}

function listen(on: boolean) {
  const method = on ? 'addEventListener' : 'removeEventListener'
  document[method]('keydown', onKeydown as EventListener)
  document[method]('pointerdown', onPointerdown as EventListener, true)
}

export interface UseLayerOptions {
  open: MaybeRefOrGetter<boolean>
  /** The elements that belong to the layer, e.g. its panel and the trigger that opened it. */
  elements: () => (Node | null | undefined)[]
  onEscape?: (event: KeyboardEvent) => void
  onOutside?: (event: PointerEvent) => void
}

/** Register a layer while `open`, and become the parent of layers opened inside it. */
export function useLayer(options: UseLayerOptions): Layer {
  const parent = inject(layerKey, null)
  const layer: LayerEntry = {
    parent,
    children: new Set(),
    owns: (target) => options.elements().some((element) => element?.contains(target)),
    contains: (target) =>
      layer.owns(target) || [...layer.children].some((child) => child.contains(target)),
    onEscape: (event) => options.onEscape?.(event),
    onOutside: (event) => options.onOutside?.(event),
  }
  provide(layerKey, layer)

  function add() {
    if (stack.includes(layer)) return
    if (!stack.length) listen(true)
    stack.push(layer)
    parent?.children.add(layer)
  }
  function remove() {
    const index = stack.indexOf(layer)
    if (index < 0) return
    stack.splice(index, 1)
    parent?.children.delete(layer)
    if (!stack.length) listen(false)
  }

  watch(
    () => toValue(options.open),
    (open) => {
      if (typeof document === 'undefined') return
      if (open) add()
      else remove()
    },
    { immediate: true },
  )
  onScopeDispose(remove)

  return layer
}

/** Whether `layer` is the topmost open layer. */
export function isTopLayer(layer: Layer) {
  return stack.at(-1) === layer
}
