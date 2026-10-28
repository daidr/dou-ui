export type TransferKey = string | number
export type TransferDirection = 'source' | 'target'

export interface TransferItem {
  key: TransferKey
  label: string
  /** A quieter line after the label. */
  description?: string
  disabled?: boolean
}

export interface TransferProps {
  /** Every item, on either side. */
  data?: TransferItem[]
  /** The keys of the items on the right, in their order there. Bound with `v-model`. */
  modelValue?: TransferKey[]
  /** The headings of the two lists. Default to the locale's. */
  titles?: [source: string, target: string]
  /** A search box above each list. */
  filterable?: boolean
  /** How an item matches the search. Defaults to its label containing the text. */
  filter?: (item: TransferItem, query: string) => boolean
  /** The height of each list in px. The lists render only the rows in view. */
  height?: number
  disabled?: boolean
}

export interface TransferEmits {
  'update:modelValue': [value: TransferKey[]]
  /** Items were moved: `direction` is where they went. */
  change: [value: TransferKey[], direction: TransferDirection, moved: TransferKey[]]
}

export interface TransferSlots {
  /** Each row's label. */
  item?: (props: { item: TransferItem; direction: TransferDirection }) => unknown
  /** Below a list, e.g. an action. */
  footer?: (props: { direction: TransferDirection }) => unknown
}
