import { expect, it } from 'vitest'
import { changedOrderKeys } from '../order'

it('repairs equal room ranks when inserting between them without reversing the survivors', () => {
  const current = new Map<string, string | null>([
    ['a', 'V'],
    ['b', 'V'],
    ['x', null],
  ])
  const changes = changedOrderKeys(['a', 'b'], ['a', 'x', 'b'], current)
  for (const [id, key] of changes) current.set(id, key)
  const ids = [...current.keys()]
  ids.sort((a, b) =>
    current.get(a)! < current.get(b)! ? -1 : current.get(a)! > current.get(b)! ? 1 : a < b ? -1 : 1,
  )
  expect(ids).toEqual(['a', 'x', 'b'])
})
