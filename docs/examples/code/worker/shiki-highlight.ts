import { createShikiLanguageResolver } from '@dou-ui/code/shiki'
import { serveCodeHighlighting, typescript } from '@dou-ui/code/worker'
import { createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import langRust from 'shiki/langs/rust.mjs'

let highlighter: ReturnType<typeof createHighlighterCore> | undefined

serveCodeHighlighting({
  languages: [typescript],
  resolve: createShikiLanguageResolver({
    highlighter: () =>
      (highlighter ??= createHighlighterCore({
        langs: [langRust],
        themes: [],
        engine: createJavaScriptRegexEngine(),
      })),
    options: () => ({
      comment: { line: '//', block: ['/*', '*/'] },
      indentAfter: /[{(]\s*$/,
    }),
  }),
})
