import { type PropType, type VNodeChild, defineComponent } from 'vue'

/** Draws what a render function returns: panels and widgets given by extensions. */
export default defineComponent({
  name: 'DouCodeRenderPart',
  props: { render: { type: Function as PropType<() => VNodeChild>, required: true } },
  setup: (props) => () => props.render(),
})
