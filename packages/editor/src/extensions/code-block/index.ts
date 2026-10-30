import { CodeIcon } from '@dou-ui/icons'
import { Fragment } from 'prosemirror-model'
import { defineComponent, h } from 'vue'
import { defineExtension, type EditorExtension } from '../../core/extension'
import { highlightPlugin, type CodeHighlighter } from '../../core/highlight'
import { blockInputRule } from '../../core/input-rules'
import { escapeHTML } from '../../core/output'
import CodeBlockView from './code-block-view.vue'
import { defaultLanguages, toLanguage, type CodeLanguage } from './languages'

export interface CodeBlockOptions {
  /**
   * Highlights the code, the same function `DouCodeBlock` takes. Defaults
   * to `DouCodeBlock.highlight` in the ConfigProvider's `defaults`; without
   * either the code stays plain.
   */
  highlight?: CodeHighlighter
  /** The languages offered in the picker. Strings serve as both value and name. */
  languages?: (CodeLanguage | string)[]
}

/**
 * Code in a monospace font, without formatting, with a language picker and
 * a copy button. ` ``` ` at the start of a block.
 */
export function codeBlock(options: CodeBlockOptions = {}): EditorExtension {
  const languages = (options.languages ?? defaultLanguages).map(toLanguage)
  const View = defineComponent({
    name: 'DouEditorCodeBlockView',
    inheritAttrs: false,
    setup(_props, { attrs }) {
      return () => h(CodeBlockView, { ...attrs, languages } as never)
    },
  })
  return defineExtension({
    name: 'codeBlock',
    blocks: {
      codeBlock: {
        content: 'text*',
        marks: '',
        code: true,
        defining: true,
        component: View,
        attrs: { language: { default: '' } },
        parseDOM: [
          {
            tag: 'pre',
            preserveWhitespace: 'full',
            getAttrs: (dom) => ({ language: languageOf(dom as HTMLElement) }),
            // Markdown renderers end the code with a newline
            getContent: (dom, schema) => {
              const text = (dom.textContent ?? '').replace(/\r\n?/g, '\n').replace(/\n$/, '')
              return text ? Fragment.from(schema.text(text)) : Fragment.empty
            },
          },
        ],
        toDOM: (node) => [
          'pre',
          {
            class: 'dou-editor__content dou-editor__content--codeBlock',
            'data-content-type': 'codeBlock',
            'data-language': node.attrs.language || null,
            spellcheck: 'false',
          },
          ['code', node.attrs.language ? { class: `language-${node.attrs.language}` } : {}, 0],
        ],
      },
    },
    output: {
      blocks: {
        codeBlock: {
          html: (block, { text, children }) => {
            const language = String(block.props.language ?? '')
            const attrs = language ? ` class="language-${escapeHTML(language)}"` : ''
            return `<pre><code${attrs}>${escapeHTML(text)}</code></pre>${children}`
          },
          markdown: (block, { text, children }) => {
            const longest = Math.max(0, ...(text.match(/^`{3,}/gm) ?? []).map((run) => run.length))
            const fence = '`'.repeat(Math.max(3, longest + 1))
            const language = String(block.props.language ?? '').replace(/\s/g, '')
            const code = `${fence}${language}\n${text}${text ? '\n' : ''}${fence}`
            return children ? `${code}\n\n${children}` : code
          },
        },
      },
    },
    inputRules: () => [blockInputRule(/^```$/, 'codeBlock')],
    plugins: () => [highlightPlugin(options.highlight)],
    blockOptions: [
      {
        key: 'codeBlock',
        type: 'codeBlock',
        label: (m) => m.types.codeBlock,
        hint: (m) => m.hints.codeBlock,
        icon: CodeIcon,
        keywords: ['code', 'pre', 'dm', 'daima'],
        shortcut: '```',
      },
    ],
  })
}

/** `data-language`, or the `language-*` class most pages put on `<code>`. */
function languageOf(pre: HTMLElement): string {
  if (pre.dataset.language) return pre.dataset.language
  const code = pre.querySelector('code')
  const match = /(?:^|\s)(?:language|lang)-([\w+#-]+)/.exec(
    `${code?.className ?? ''} ${pre.className}`,
  )
  return match?.[1] ?? ''
}

export { defaultLanguages, type CodeHighlighter, type CodeLanguage }
