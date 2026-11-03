/** A sorted copy. The repository's TypeScript lib predates `toSorted`. */
export function sorted<T>(list: readonly T[], compare?: (a: T, b: T) => number): T[] {
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a copy
  return [...list].sort(compare)
}
