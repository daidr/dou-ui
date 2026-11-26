/**
 * Unicode CJK character classification following the CommonMark CJK-friendly
 * specification (`tats-u/markdown-cjk-friendly`, Unicode 18 ranges: East Asian
 * Width W/F/H excluding default-emoji-presentation characters, plus Hangul
 * script, without U+3000 ideographic space which is handled as whitespace).
 */
export function isCjkCodePoint(cp: number): boolean {
  if (cp < 0x1100) return false
  return (
    cp <= 0x11ff ||
    cp === 0x20a9 ||
    (0x2329 <= cp && cp <= 0x232a) ||
    (0x2630 <= cp && cp <= 0x2637) ||
    (0x268a <= cp && cp <= 0x268f) ||
    (0x2e80 <= cp && cp <= 0x2e99) ||
    (0x2e9b <= cp && cp <= 0x2ef3) ||
    (0x2f00 <= cp && cp <= 0x2fd5) ||
    (0x2ff0 <= cp && cp <= 0x2fff) ||
    (0x3001 <= cp && cp <= 0x303e) ||
    (0x3041 <= cp && cp <= 0x3096) ||
    (0x3099 <= cp && cp <= 0x30ff) ||
    (0x3105 <= cp && cp <= 0x312f) ||
    (0x3131 <= cp && cp <= 0x318e) ||
    (0x3190 <= cp && cp <= 0x31e5) ||
    (0x31ef <= cp && cp <= 0x321e) ||
    (0x3220 <= cp && cp <= 0x3247) ||
    (0x3250 <= cp && cp <= 0xa48c) ||
    (0xa490 <= cp && cp <= 0xa4c6) ||
    (0xa960 <= cp && cp <= 0xa97c) ||
    (0xac00 <= cp && cp <= 0xd7a3) ||
    (0xd7b0 <= cp && cp <= 0xd7c6) ||
    (0xd7cb <= cp && cp <= 0xd7fb) ||
    (0xf900 <= cp && cp <= 0xfaff) ||
    (0xfe10 <= cp && cp <= 0xfe19) ||
    (0xfe30 <= cp && cp <= 0xfe52) ||
    (0xfe54 <= cp && cp <= 0xfe66) ||
    (0xfe68 <= cp && cp <= 0xfe6b) ||
    (0xff01 <= cp && cp <= 0xffbe) ||
    (0xffc2 <= cp && cp <= 0xffc7) ||
    (0xffca <= cp && cp <= 0xffcf) ||
    (0xffd2 <= cp && cp <= 0xffd7) ||
    (0xffda <= cp && cp <= 0xffdc) ||
    (0xffe0 <= cp && cp <= 0xffe6) ||
    (0xffe8 <= cp && cp <= 0xffee) ||
    (0x16fe0 <= cp && cp <= 0x16fe4) ||
    (0x16ff0 <= cp && cp <= 0x16ff6) ||
    (0x17000 <= cp && cp <= 0x18cda) ||
    (0x18cff <= cp && cp <= 0x18d20) ||
    (0x18d80 <= cp && cp <= 0x18df2) ||
    (0x18e00 <= cp && cp <= 0x19191) ||
    (0x191a0 <= cp && cp <= 0x191d2) ||
    (0x1aff0 <= cp && cp <= 0x1aff3) ||
    (0x1aff5 <= cp && cp <= 0x1affb) ||
    (0x1affd <= cp && cp <= 0x1affe) ||
    (0x1b000 <= cp && cp <= 0x1b128) ||
    cp === 0x1b132 ||
    (0x1b150 <= cp && cp <= 0x1b152) ||
    cp === 0x1b155 ||
    (0x1b164 <= cp && cp <= 0x1b168) ||
    (0x1b170 <= cp && cp <= 0x1b2fb) ||
    (0x1d300 <= cp && cp <= 0x1d356) ||
    (0x1d360 <= cp && cp <= 0x1d376) ||
    cp === 0x1f1ae ||
    cp === 0x1f200 ||
    cp === 0x1f202 ||
    (0x1f210 <= cp && cp <= 0x1f219) ||
    (0x1f21b <= cp && cp <= 0x1f22e) ||
    (0x1f230 <= cp && cp <= 0x1f231) ||
    cp === 0x1f237 ||
    cp === 0x1f23b ||
    (0x1f240 <= cp && cp <= 0x1f248) ||
    (0x1f260 <= cp && cp <= 0x1f265) ||
    cp === 0x1f7da ||
    (0x20000 <= cp && cp <= 0x3fffd)
  )
}

/** Ideographic Variation Selector (U+E0100–U+E01EF). */
export function isIdeographicVS(cp: number): boolean {
  return 0xe0100 <= cp && cp <= 0xe01ef
}

/** Non-emoji general-use Variation Selector (U+FE00–U+FE0E, excluding U+FE0F). */
export function isNonEmojiGeneralUseVS(cp: number): boolean {
  return 0xfe00 <= cp && cp <= 0xfe0e
}

/** East Asian ambiguous quotation marks with fullwidth SVS (`U+FE01`) forms. */
export function isCjkAmbiguousQuote(cp: number): boolean {
  return cp === 0x2018 || cp === 0x2019 || cp === 0x201c || cp === 0x201d
}

/**
 * Code point right before `pos` (replacing broken surrogates with U+FFFD),
 * plus its starting index in `str`. Returns `[0x20, -1]` at the start of text.
 */
export function previousCodePoint(str: string, pos: number): [codePoint: number, index: number] {
  if (pos <= 0) return [0x20, -1]
  const code = str.charCodeAt(pos - 1)
  if ((code & 0xfc00) !== 0xdc00) {
    return [(code & 0xfc00) === 0xd800 ? 0xfffd : code, pos - 1]
  }
  if (pos >= 2) {
    const high = str.charCodeAt(pos - 2)
    if ((high & 0xfc00) === 0xd800) {
      return [0x10000 + ((high - 0xd800) << 10) + (code - 0xdc00), pos - 2]
    }
  }
  return [0xfffd, pos - 1]
}

/**
 * Code point starting at `pos` (replacing broken surrogates with U+FFFD).
 * Returns `0x20` at or past the end of text.
 */
export function nextCodePoint(str: string, pos: number): number {
  if (pos >= str.length) return 0x20
  const code = str.charCodeAt(pos)
  if ((code & 0xfc00) === 0xd800) {
    const low = str.charCodeAt(pos + 1)
    if ((low & 0xfc00) === 0xdc00) {
      return 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00)
    }
    return 0xfffd
  }
  return (code & 0xfc00) === 0xdc00 ? 0xfffd : code
}
