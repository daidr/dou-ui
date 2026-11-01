/*
 * Charts whose tooltips share a `group`: the x under the pointer in one is
 * shown in the others. An x travels as the data has it, so charts with x
 * read differently still meet: a category's name, a time in ms, a number.
 */

/** An x as charts of a group share it; `null` when the pointer left. */
export type SharedX = string | number | null

type Listener = (x: SharedX) => void

const groups = new Map<string, Set<Listener>>()

/** Listens to the x shown in `group`; gives back how to stop. */
export function joinGroup(group: string, listener: Listener): () => void {
  let members = groups.get(group)
  if (!members) groups.set(group, (members = new Set()))
  members.add(listener)
  return () => {
    members.delete(listener)
    if (!members.size) groups.delete(group)
  }
}

/** Shows `x` in every chart of `group` but the one telling (`from`). */
export function tellGroup(group: string, x: SharedX, from: Listener): void {
  const members = groups.get(group)
  if (!members) return
  for (const listener of members) if (listener !== from) listener(x)
}
