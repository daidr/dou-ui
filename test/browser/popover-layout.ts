import { createApp, h, ref } from 'vue'
import { DouPopover, type PopoverPlacement } from 'dou-ui'
import 'dou-ui/style.css'

const params = new URLSearchParams(location.search)
const mode = params.get('mode')
const long =
  'A sufficiently long popover message with naturally wrapping text. It grows as it moves away from the edge of the viewport. Its width should settle without visible changes.'
const parseSize = (value: string | null) =>
  value ? (Number.isNaN(Number(value)) ? value : Number(value)) : undefined
const width = params.get('rawWidth') ?? parseSize(params.get('width'))
const maxHeight = parseSize(params.get('maxHeight'))

createApp({
  setup() {
    const content = ref('Hi')
    if (mode === 'scroll') {
      const anchor = ref(params.get('anchor') ?? 'bottom')
      const itemCount = Number(params.get('items')) || 30
      const triggerStyle = () => {
        const style: Record<string, string> = { position: 'fixed', left: '24px' }
        if (anchor.value === 'top') style.top = '16px'
        else if (anchor.value === 'side') style.top = '120px'
        else if (anchor.value === 'mid') style.top = '280px'
        else style.bottom = '16px'
        return style
      }
      return () => [
        h(
          'button',
          {
            id: 'move-bottom',
            style: { position: 'fixed', top: '16px', right: '16px' },
            onClick: () => (anchor.value = 'bottom'),
          },
          'Move bottom',
        ),
        h(
          DouPopover,
          {
            title: '后台任务',
            placement: (params.get('placement') ?? 'bottom-start') as PopoverPlacement,
            width: width ?? 280,
            maxHeight,
          },
          {
            default: () => h('button', { id: 'show', style: triggerStyle() }, 'Show'),
            content: () =>
              h(
                'div',
                { id: 'scroll-items' },
                Array.from({ length: itemCount }, (_, i) =>
                  h('div', { style: { height: '28px', lineHeight: '28px' } }, `Task #${i + 1}`),
                ),
              ),
          },
        ),
      ]
    }
    return () => [
      h('button', { id: 'long', onClick: () => (content.value = long) }, 'Long content'),
      h('button', { id: 'short', onClick: () => (content.value = 'Hi') }, 'Short content'),
      h(
        DouPopover,
        { placement: (params.get('placement') ?? 'bottom-end') as PopoverPlacement, width },
        {
          default: () =>
            h(
              'button',
              {
                id: 'show',
                style: {
                  position: 'fixed',
                  top: '100px',
                  [params.get('edge') === 'left' ? 'left' : 'right']: '4px',
                },
              },
              'Show',
            ),
          content: () => h('div', content.value),
        },
      ),
    ]
  },
}).mount('#app')
