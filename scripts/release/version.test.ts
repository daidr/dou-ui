// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  channelOf,
  checkNextVersion,
  compareVersions,
  distTagFor,
  formatVersion,
  parseVersion,
} from './version'
import { sorted } from './sorted'

const v = (text: string) => parseVersion(text)!

describe('parseVersion', () => {
  it('accepts releases, alphas and betas only', () => {
    expect(formatVersion(v('0.1.0'))).toBe('0.1.0')
    expect(formatVersion(v('1.2.3-alpha.0'))).toBe('1.2.3-alpha.0')
    expect(formatVersion(v('1.2.3-beta.12'))).toBe('1.2.3-beta.12')
    for (const bad of ['1.2', '01.2.3', '1.2.3-rc.1', '1.2.3-beta', '1.2.3-beta.01', 'v1.2.3']) {
      expect(parseVersion(bad)).toBeNull()
    }
  })

  it('derives the channel from the suffix', () => {
    expect(channelOf(v('0.3.0-alpha.1'))).toBe('alpha')
    expect(channelOf(v('0.3.0-beta.0'))).toBe('beta')
    expect(channelOf(v('0.3.0'))).toBe('latest')
  })
})

describe('compareVersions', () => {
  it('orders alpha before beta before the release', () => {
    const order = sorted(
      ['0.3.0', '0.2.9', '0.3.0-beta.0', '0.3.0-alpha.2', '0.3.0-alpha.10'].map(v),
      compareVersions,
    ).map(formatVersion)
    expect(order).toEqual(['0.2.9', '0.3.0-alpha.2', '0.3.0-alpha.10', '0.3.0-beta.0', '0.3.0'])
  })
})

describe('checkNextVersion', () => {
  it('lets a version only move forward', () => {
    expect(checkNextVersion('0.0.0', '0.1.0-alpha.0', 'main')).toBeNull()
    expect(checkNextVersion('0.1.0-alpha.0', '0.1.0-beta.0', 'main')).toBeNull()
    expect(checkNextVersion('0.1.0-beta.1', '0.1.0', 'main')).toBeNull()
    expect(checkNextVersion('0.1.0-beta.1', '0.1.0-alpha.2', 'main')).toMatch('必须比当前')
    expect(checkNextVersion('0.1.0', '0.1.0', 'main')).toMatch('必须比当前')
    expect(checkNextVersion('0.1.0', '0.1.0-rc.1', 'main')).toMatch('不合法')
  })

  it('keeps prereleases on main and releases on main or their maintenance line', () => {
    expect(checkNextVersion('0.2.0', '0.3.0-beta.0', 'release/0.2')).toMatch('只能从 main')
    expect(checkNextVersion('0.2.0', '0.2.1', 'release/0.2')).toBeNull()
    expect(checkNextVersion('0.2.0', '0.3.0', 'release/0.2')).toMatch('只能发布 0.2.x')
    expect(checkNextVersion('0.2.0', '0.2.1', 'feature/x')).toMatch('只能从 main 或 release/x.y')
  })
})

describe('distTagFor', () => {
  it('publishes prereleases under their channel', () => {
    expect(distTagFor(v('0.3.0-beta.0'), v('0.2.0'))).toBe('beta')
  })

  it('moves latest forward but not back', () => {
    expect(distTagFor(v('0.1.0'), null)).toBe('latest')
    expect(distTagFor(v('0.1.0'), v('0.1.0-alpha.3'))).toBe('latest')
    expect(distTagFor(v('0.3.0'), v('0.2.4'))).toBe('latest')
    expect(distTagFor(v('0.2.5'), v('0.3.0'))).toBe('latest-0.2')
  })
})
