import { Fragment, cloneVNode, getCurrentInstance } from 'vue'
import type { ComponentInternalInstance, VNode } from 'vue'

// PatchFlags.DEV_ROOT_FRAGMENT (1 << 11): in development mode Vue wraps a
// single-root template that also has root comments in a Fragment with this flag.
const DEV_ROOT_FRAGMENT = 1 << 11

interface InternalVNode extends VNode {
  slotScopeIds?: string[] | null
  ssContent?: VNode
  ssFallback?: VNode
}

export interface UseScopeAttrsOptions {
  /**
   * Mark this component as having claimed its inherited scope onto an internal
   * element (for example, `DouCopyButton` placing `$attrs` on its `<button>`
   * inside `<DouTooltip>`). Its single-root child will stop walking here so
   * the parent's scope does not leak onto a teleported overlay panel.
   */
  claim?: boolean
}

const EMPTY_ATTRS: Record<string, ''> = Object.freeze({})

const claimedScopes = new WeakSet<ComponentInternalInstance>()

// Preserve each `OnlyChild` vnode's original scope IDs so re-renders without a
// fresh parent vnode never lose or accumulate mutated IDs.
const originalScopes = new WeakMap<
  VNode,
  { scopeId: string | null; slotScopeIds: string[] | null }
>()

function isSingleRootChild(parent: ComponentInternalInstance, childVNode: VNode): boolean {
  const subTree = parent.subTree as InternalVNode | undefined
  if (!subTree) return false
  if (subTree === childVNode) return true
  if (
    subTree.type === Fragment &&
    subTree.patchFlag > 0 &&
    (subTree.patchFlag & DEV_ROOT_FRAGMENT) !== 0 &&
    Array.isArray(subTree.children)
  ) {
    return subTree.children.includes(childVNode)
  }
  return subTree.ssContent === childVNode || subTree.ssFallback === childVNode
}

/**
 * Collects every `data-v-*` scope ID (both `scopeId` and `slotScopeIds`) that
 * Vue's `setScopeId` would have placed on a component's root element if it did
 * not return a multi-root `Fragment` or `<Teleport>`.
 */
export function collectScopeIds(start: ComponentInternalInstance | null | undefined): string[] {
  const ids: string[] = []
  const add = (id: string | null | undefined) => {
    if (id && !ids.includes(id)) ids.push(id)
  }
  const addFromVNode = (vnode: InternalVNode | null | undefined) => {
    if (!vnode) return
    add(vnode.scopeId)
    if (vnode.slotScopeIds) {
      for (const id of vnode.slotScopeIds) add(id)
    }
  }

  let cur = start
  while (cur) {
    addFromVNode(cur.vnode as InternalVNode)
    const parent = cur.parent
    if (!parent || claimedScopes.has(parent) || !isSingleRootChild(parent, cur.vnode)) break
    cur = parent
  }

  return ids
}

/**
 * Forwards the host component's inherited `scopeId` / `slotScopeIds` through
 * `OnlyChild` onto its rendered trigger element or single-root child component
 * (such as `DouInput` / `DouTextarea` in `DouAutocomplete`), matching Vue's
 * native single-root scoping in both CSR and SSR without polluting `$attrs` or
 * descendant elements.
 */
export function forwardScopeIds(instance: ComponentInternalInstance | null, vnode: VNode): VNode {
  if (!instance) return vnode
  const hostVNode = instance.vnode as InternalVNode
  let orig = originalScopes.get(hostVNode)
  if (!orig) {
    orig = {
      scopeId: hostVNode.scopeId,
      slotScopeIds: hostVNode.slotScopeIds ? [...hostVNode.slotScopeIds] : null,
    }
    originalScopes.set(hostVNode, orig)
  }

  const ids = collectScopeIds(instance.parent)
  if (orig.scopeId && !ids.includes(orig.scopeId)) ids.unshift(orig.scopeId)
  if (orig.slotScopeIds) {
    for (const id of orig.slotScopeIds) {
      if (!ids.includes(id)) ids.push(id)
    }
  }

  // Prefer IDs not already present on `vnode.scopeId` for `hostVNode.scopeId`
  // so SSR's single-root chain (`vnode.scopeId` + `hostVNode.scopeId`) carries
  // both inner and outer scope IDs without losing either.
  const ownScopeId = vnode.scopeId
  const missing = ownScopeId ? ids.filter((id) => id !== ownScopeId) : ids
  if (!missing.length) {
    hostVNode.scopeId = orig.scopeId
    hostVNode.slotScopeIds = orig.slotScopeIds
    return vnode
  }

  hostVNode.scopeId = missing[0]!
  hostVNode.slotScopeIds = missing.length > 1 ? missing.slice(1) : null

  if (missing.length > 1) {
    let nextIndex = 1
    let next = vnode
    if (!next.scopeId) {
      next = cloneVNode(next)
      next.scopeId = missing[nextIndex]!
      nextIndex++
    }
    if (nextIndex < missing.length && typeof next.type === 'string') {
      const extra: Record<string, ''> = {}
      for (let i = nextIndex; i < missing.length; i++) extra[missing[i]!] = ''
      next = cloneVNode(next, extra, true)
    }
    return next
  }

  return vnode
}

/**
 * Returns a render-time getter for the inherited `data-v-*` scope attributes so
 * multi-root or `<Teleport>`-rooted components can spread them onto the native
 * DOM element that receives `$attrs`.
 */
export function useScopeAttrs(options?: UseScopeAttrsOptions): () => Record<string, ''> {
  const instance = getCurrentInstance()
  if (instance && options?.claim) claimedScopes.add(instance)
  return () => {
    const ids = collectScopeIds(instance)
    if (!ids.length) return EMPTY_ATTRS
    const attrs: Record<string, ''> = {}
    for (const id of ids) attrs[id] = ''
    return attrs
  }
}
