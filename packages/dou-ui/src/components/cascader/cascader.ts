import type { Placement } from '../../composables/use-floating'
import type { Size } from '../../utils/types'

export type CascaderValue = string | number

export interface CascaderOption {
  value: CascaderValue
  /** Defaults to the value. */
  label?: string
  disabled?: boolean
  children?: CascaderOption[]
  /** With `load`: the option has no children, so it is never loaded. */
  leaf?: boolean
}

export interface CascaderProps {
  /** The path of values from the top level down, bound with `v-model`. */
  modelValue?: CascaderValue[] | null
  options?: CascaderOption[]
  /** Load the children of an option the first time it opens. */
  load?: (option: CascaderOption, path: CascaderOption[]) => Promise<CascaderOption[]>
  /** Let any level be chosen, not only the last. */
  changeOnSelect?: boolean
  /** How a column opens the next one: on click, or as soon as the pointer rests on it. */
  expandTrigger?: 'click' | 'hover'
  /** Type to search every full path. Branches not loaded yet are not searched. */
  filterable?: boolean
  /** Put between the labels of the path in the field. */
  separator?: string
  /** Show only the last label in the field. */
  showLastOnly?: boolean
  placeholder?: string
  size?: Size
  disabled?: boolean
  invalid?: boolean
  clearable?: boolean
  placement?: Placement
  teleport?: string | HTMLElement | false
}

export interface CascaderEmits {
  'update:modelValue': [value: CascaderValue[] | null]
  change: [value: CascaderValue[] | null, path: CascaderOption[]]
}

export interface CascaderSlots {
  /** Each option in a column. */
  option?: (props: { option: CascaderOption; level: number }) => unknown
  /** Shown when the search finds nothing, or a column has no options. */
  empty?: () => unknown
}

export interface CascaderExpose {
  focus: () => void
  blur: () => void
}
