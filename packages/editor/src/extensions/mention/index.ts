import { defineComponent, h } from 'vue'
import { defineExtension, type EditorExtension } from '../../core/extension'
import MentionMenu from './mention-menu.vue'
import { mentionPlugin, type MentionItem } from './state'

export interface MentionOptions {
  /**
   * Finds who matches what was typed after the `@` (empty right after it).
   * Can return a Promise; only the answer to the latest query is shown.
   */
  search: (query: string) => MentionItem[] | Promise<MentionItem[]>
}

/**
 * Mentions: typing `@` suggests people (or anything else) from `search`,
 * and the chosen one goes into the text as a mention, kept in the
 * document as `{ type: 'inline', name: 'mention', props: { id, label } }`.
 */
export function mention(options: MentionOptions): EditorExtension {
  const Menu = defineComponent({
    name: 'DouEditorMentionMenu',
    setup() {
      return () => h(MentionMenu, { search: options.search })
    },
  })
  return defineExtension({
    name: 'mention',
    inlines: {
      mention: {
        atom: true,
        selectable: false,
        attrs: { id: { default: '' }, label: { default: '' } },
        leafText: (node) => `@${node.attrs.label}`,
        parseDOM: [
          {
            tag: 'span[data-mention]',
            getAttrs: (dom) => ({
              id: (dom as HTMLElement).dataset.mention ?? '',
              label: ((dom as HTMLElement).textContent ?? '').replace(/^@/, ''),
            }),
          },
        ],
        toDOM: (node) => [
          'span',
          { class: 'dou-editor__mention', 'data-mention': node.attrs.id },
          `@${node.attrs.label}`,
        ],
      },
    },
    plugins: () => [mentionPlugin()],
    overlays: [Menu],
  })
}

export type { MentionItem }
