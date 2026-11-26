import type MarkdownIt from 'markdown-it'
import {
  isCjkAmbiguousQuote,
  isCjkCodePoint,
  isIdeographicVS,
  isNonEmojiGeneralUseVS,
  nextCodePoint,
  previousCodePoint,
} from '../core/cjk'

const UNICODE_PUNCT = /^[\p{P}\p{S}]$/u

function isPunct(md: MarkdownIt, cp: number): boolean {
  return md.utils.isMdAsciiPunct(cp) || UNICODE_PUNCT.test(String.fromCodePoint(cp))
}

function isPreviousCjk(cp: number): boolean {
  return isCjkCodePoint(cp) || isIdeographicVS(cp)
}

function isTwoPreviousCjk(twoPrev: number, prev: number): boolean {
  return isCjkCodePoint(twoPrev) || (prev === 0xfe01 && isCjkAmbiguousQuote(twoPrev))
}

/**
 * markdown-it plugin implementing the CommonMark CJK-friendly emphasis and
 * GFM strikethrough delimiter flanking rules (`tats-u/markdown-cjk-friendly`).
 */
export function cjkFriendly(md: MarkdownIt): void {
  const PreviousState = md.inline.State

  class CjkFriendlyState extends PreviousState {
    override scanDelims(start: number, canSplitWord: boolean) {
      const max = this.posMax
      const marker = this.src.charCodeAt(start)

      const [lastChar, lastCharPos] = previousCodePoint(this.src, start)
      let lastMainChar = lastChar
      let twoPrevChar: number | null = null

      if (isNonEmojiGeneralUseVS(lastChar)) {
        const [prevBase] = previousCodePoint(this.src, lastCharPos)
        twoPrevChar = prevBase
        if (!md.utils.isWhiteSpace(prevBase)) {
          lastMainChar = prevBase
        }
      }

      let pos = start
      while (pos < max && this.src.charCodeAt(pos) === marker) pos++
      const count = pos - start

      const nextChar = pos < max ? nextCodePoint(this.src, pos) : 0x20

      const isLastWhiteSpace = md.utils.isWhiteSpace(lastMainChar)
      const isNextWhiteSpace = md.utils.isWhiteSpace(nextChar)

      if (isLastWhiteSpace || isNextWhiteSpace) {
        return {
          can_open: !isNextWhiteSpace,
          can_close: !isLastWhiteSpace,
          length: count,
        }
      }

      const isLastPunct = isPunct(md, lastMainChar)
      const isNextPunct = isPunct(md, nextChar)

      // When neither side is whitespace, `_` (`canSplitWord = false`) reduces to
      // `can_open = isLastPunct` and `can_close = isNextPunct` under both
      // CommonMark and the CJK-friendly amendment.
      let leftFlanking = isLastPunct
      let rightFlanking = isNextPunct

      if (canSplitWord) {
        const isEitherCjk =
          isCjkCodePoint(nextChar) ||
          (twoPrevChar !== null ? isTwoPreviousCjk(twoPrevChar, lastChar) : isPreviousCjk(lastChar))

        leftFlanking ||= isEitherCjk || !isNextPunct
        rightFlanking ||= isEitherCjk || !isLastPunct
      }

      return {
        can_open: leftFlanking,
        can_close: rightFlanking,
        length: count,
      }
    }
  }

  md.inline.State = CjkFriendlyState
}
