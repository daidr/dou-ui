import { StickyNoteIcon } from '@dou-ui/icons'
import { defineExtension } from '../../core/extension'
import CalloutBlock from './callout-block.vue'
import { calloutTones } from './tones'

/** A callout: text in a tinted box with an icon; the icon picks the tone. */
export const callout = defineExtension({
  name: 'callout',
  blocks: {
    callout: {
      content: 'inline*',
      defining: true,
      component: CalloutBlock,
      attrs: { tone: { default: 'info' } },
      parseDOM: [
        {
          tag: 'div[data-content-type="callout"]',
          getAttrs: (dom) => {
            const tone = (dom as HTMLElement).dataset.tone ?? ''
            return { tone: tone in calloutTones ? tone : 'info' }
          },
        },
      ],
      toDOM: (node) => [
        'div',
        {
          class: 'dou-editor__content dou-editor__content--callout',
          'data-content-type': 'callout',
          'data-tone': node.attrs.tone,
        },
        0,
      ],
    },
  },
  blockOptions: [
    {
      key: 'callout',
      type: 'callout',
      label: (m) => m.types.callout,
      hint: (m) => m.hints.callout,
      icon: StickyNoteIcon,
      keywords: ['callout', 'note', 'tip', 'warning', 'ts', 'tishi'],
    },
  ],
})

export type { CalloutTone } from './tones'
