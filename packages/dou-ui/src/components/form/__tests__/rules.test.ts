import { describe, expect, it } from 'vitest'
import { translate } from '../../config-provider/use-config'
import { zhCN } from '../../../locale'
import type { FormRule } from '../form'
import { getPath, isEmpty, rulesFor, setPath, validateValue } from '../rules'

const t = (path: Parameters<typeof translate>[1], params?: Record<string, string | number>) =>
  translate(zhCN, path, params)
const check = (value: unknown, ...rules: FormRule[]) => validateValue(value, rules, {}, t)

describe('form rules', () => {
  it('treats blank values as empty', () => {
    for (const value of [undefined, null, '', '  ', [], false]) expect(isEmpty(value)).toBe(true)
    for (const value of [0, 'a', [1], true, {}]) expect(isEmpty(value)).toBe(false)
  })

  it('checks required values', async () => {
    expect(await check('', { required: true })).toBe('此项为必填项')
    expect(await check(false, { required: true, message: '请同意' })).toBe('请同意')
    expect(await check('a', { required: true })).toBeNull()
  })

  it('skips built-in checks on optional empty values', async () => {
    expect(await check('', { type: 'email' }, { min: 3 })).toBeNull()
  })

  it('checks types', async () => {
    expect(await check('a@b', { type: 'email' })).toBe('请输入有效的邮箱地址')
    expect(await check('a@b.co', { type: 'email' })).toBeNull()
    expect(await check('example.com', { type: 'url' })).toBe('请输入有效的网址')
    expect(await check('https://example.com', { type: 'url' })).toBeNull()
    expect(await check(1.5, { type: 'integer' })).toBe('此项不符合要求')
  })

  it('checks ranges by text length, item count or number', async () => {
    expect(await check('ab', { min: 3 })).toBe('至少需要 3 个字符')
    expect(await check('豆豆豆豆', { max: 3 })).toBe('不能超过 3 个字符')
    expect(await check(['a'], { min: 2 })).toBe('至少选择 2 项')
    expect(await check(['a', 'b', 'c'], { max: 2 })).toBe('最多选择 2 项')
    expect(await check(5, { min: 10 })).toBe('不能小于 10')
    expect(await check(15, { max: 10 })).toBe('不能大于 10')
  })

  it('checks patterns, including global ones', async () => {
    const rule = { pattern: /^\d+$/g }
    expect(await check('12', rule)).toBeNull()
    expect(await check('12', rule)).toBeNull()
    expect(await check('1a', rule)).toBe('格式不正确')
  })

  it('runs custom validators, sync or async', async () => {
    expect(await check('a', { validator: () => '自定义' })).toBe('自定义')
    expect(await check('a', { validator: () => false, message: '不行' })).toBe('不行')
    expect(await check('a', { validator: async () => true })).toBeNull()
    expect(
      await check('a', {
        validator: async () => {
          throw new Error('已被占用')
        },
      }),
    ).toBe('已被占用')
  })

  it('stops at the first failing rule', async () => {
    expect(await check('', { required: true }, { validator: () => '不会运行' })).toBe(
      '此项为必填项',
    )
  })

  it('picks rules for an event', () => {
    const plain: FormRule = { required: true }
    const onChange: FormRule = { min: 1, trigger: 'change' }
    const onBlur: FormRule = { max: 9, trigger: ['blur'] }
    const rules = [plain, onChange, onBlur]
    expect(rulesFor(rules, 'blur', false, false)).toEqual([plain, onBlur])
    expect(rulesFor(rules, 'change', false, false)).toEqual([plain, onChange])
    // Typing into a field that shows no error only runs explicit change rules.
    expect(rulesFor(rules, 'change', true, false)).toEqual([onChange])
    expect(rulesFor(rules, 'change', true, true)).toEqual([plain, onChange])
  })

  it('reads and writes nested paths', () => {
    const model = { a: { b: [1, 2] } }
    expect(getPath(model, 'a.b.1')).toBe(2)
    expect(getPath(model, 'a.x.y')).toBeUndefined()
    setPath(model, 'a.b.0', 9)
    expect(model.a.b[0]).toBe(9)
  })
})
