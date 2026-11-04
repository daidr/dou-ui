import { describe, expect, it } from 'vitest'
import { flatten } from '../menu'
import type { FlatEntry, MenuOption } from '../menu'

/** Each entry as text: a group as `label[rows]`, a separator as `|`. */
const outline = (entries: FlatEntry[]) =>
  entries.map((entry) =>
    entry.kind === 'group'
      ? `${entry.label}[${entry.rows.map((row) => (row.kind === 'item' ? row.item.label : '|')).join(',')}]`
      : entry.kind === 'item'
        ? entry.item.label
        : '|',
  )

describe('flatten', () => {
  it('keeps every item under its own heading, deeper groups after the parent items', () => {
    const options: MenuOption[] = [
      { key: 'list', label: '项目列表' },
      {
        key: 'settings',
        label: '设置',
        children: [
          { key: 'members', label: '成员' },
          { key: 'deeper', label: '更深', children: [{ key: 'deep', label: '深处' }] },
          { key: 'after', label: '设置之后' },
        ],
      },
    ]
    expect(outline(flatten(options))).toEqual(['项目列表', '设置[成员,设置之后]', '更深[深处]'])
  })

  it('drops separators left at the ends of a group or doubled', () => {
    const options: MenuOption[] = [
      {
        type: 'group',
        label: '设置',
        children: [
          { key: 'a', label: '甲' },
          { type: 'divider' },
          { key: 'sub', label: '子', children: [{ key: 'c', label: '丙' }] },
          { type: 'divider' },
          { key: 'b', label: '乙' },
          { type: 'divider' },
        ],
      },
    ]
    expect(outline(flatten(options))).toEqual(['设置[甲,|,乙]', '子[丙]'])
  })
})
