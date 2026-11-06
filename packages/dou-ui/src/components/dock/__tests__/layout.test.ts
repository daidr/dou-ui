import { describe, expect, it } from 'vitest'
import {
  dockGroups,
  findDockGroup,
  moveDockTab,
  nextDockGroupId,
  removeDockTab,
  selectDockTab,
  splitDockTab,
} from '../layout'
import type { DockNode } from '../layout'

const layout: DockNode = {
  type: 'split',
  direction: 'horizontal',
  size: 60,
  start: { type: 'group', id: 'a', tabs: ['x', 'y'], active: 'x' },
  end: { type: 'group', id: 'b', tabs: ['z'] },
}

describe('dock layout', () => {
  it('finds groups and makes new ids', () => {
    expect(findDockGroup(layout, 'z')?.id).toBe('b')
    expect(dockGroups(layout).map((group) => group.id)).toEqual(['a', 'b'])
    expect(nextDockGroupId(layout)).toBe('group-1')
    expect(nextDockGroupId({ type: 'group', id: 'group-1', tabs: [] })).toBe('group-2')
  })

  it('moves a tab within its group and selects it', () => {
    const next = moveDockTab(layout, 'x', 'a', 1)
    expect(findDockGroup(next, 'x')).toMatchObject({ tabs: ['y', 'x'], active: 'x' })
    // the original is left as it was
    expect(findDockGroup(layout, 'x')!.tabs).toEqual(['x', 'y'])
  })

  it('moves a tab to another group, and its old group selects a neighbour', () => {
    const next = moveDockTab(layout, 'x', 'b', 0)
    expect(findDockGroup(next, 'x')).toMatchObject({ id: 'b', tabs: ['x', 'z'], active: 'x' })
    expect(findDockGroup(next, 'y')).toMatchObject({ id: 'a', tabs: ['y'], active: 'y' })
  })

  it('drops a group once its last tab leaves, and the split with it', () => {
    const next = moveDockTab(layout, 'z', 'a')
    expect(next).toEqual({ type: 'group', id: 'a', tabs: ['x', 'y', 'z'], active: 'z' })
  })

  it('splits a tab off to a side of a group', () => {
    const next = splitDockTab(layout, 'y', 'b', 'bottom', 'c')
    expect(next).toEqual({
      type: 'split',
      direction: 'horizontal',
      size: 60,
      start: { type: 'group', id: 'a', tabs: ['x'], active: 'x' },
      end: {
        type: 'split',
        direction: 'vertical',
        size: 50,
        start: { type: 'group', id: 'b', tabs: ['z'] },
        end: { type: 'group', id: 'c', tabs: ['y'], active: 'y' },
      },
    })
    const left = splitDockTab(layout, 'x', 'a', 'left', 'c')
    expect(left.type === 'split' && left.start).toMatchObject({
      direction: 'horizontal',
      start: { id: 'c', tabs: ['x'] },
      end: { id: 'a', tabs: ['y'] },
    })
  })

  it('does not split the only tab of a group off itself', () => {
    expect(splitDockTab(layout, 'z', 'b', 'right')).toBe(layout)
  })

  it('splits the last tab of a group off another group, dropping its own', () => {
    const next = splitDockTab(layout, 'z', 'a', 'top', 'c')
    expect(next).toEqual({
      type: 'split',
      direction: 'vertical',
      size: 50,
      start: { type: 'group', id: 'c', tabs: ['z'], active: 'z' },
      end: { type: 'group', id: 'a', tabs: ['x', 'y'], active: 'x' },
    })
  })

  it('removes tabs and keeps one empty group at last', () => {
    let next = removeDockTab(layout, 'z')
    expect(next).toEqual({ type: 'group', id: 'a', tabs: ['x', 'y'], active: 'x' })
    next = removeDockTab(removeDockTab(next, 'x'), 'y')
    expect(next).toEqual({ type: 'group', id: 'a', tabs: [], active: undefined })
  })

  it('selects a tab and leaves the layout alone when it already is', () => {
    expect(findDockGroup(selectDockTab(layout, 'y'), 'y')!.active).toBe('y')
    expect(selectDockTab(layout, 'x')).toBe(layout)
  })
})
