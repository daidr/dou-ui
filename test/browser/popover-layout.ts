import { createApp, h, ref } from 'vue'
import { DouPopover, type PopoverPlacement } from 'dou-ui'
import 'dou-ui/style.css'

const params = new URLSearchParams(location.search)
const long =
  'A sufficiently long popover message with naturally wrapping text. It grows as it moves away from the edge of the viewport. Its width should settle without visible changes.'
const widthValue = params.get('width')
const width = widthValue
  ? Number.isNaN(Number(widthValue))
    ? widthValue
    : Number(widthValue)
  : undefined

createApp({
  setup() {
    const content = ref('Hi')
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
