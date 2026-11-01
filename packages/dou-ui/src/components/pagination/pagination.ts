import type { Size } from '../../utils/types'

export type PaginationSize = Size

export interface PaginationProps {
  /** The current page, from 1, bound with `v-model:page`. */
  page?: number
  /** Items per page, bound with `v-model:page-size`. */
  pageSize?: number
  /** The number of items. */
  total: number
  /** Offer these page sizes in a select. Hidden when omitted. */
  pageSizes?: number[]
  /** Pages shown on each side of the current one. */
  siblings?: number
  /** Pages always shown at each end. */
  boundaries?: number
  /** Show "3 / 10" in place of the page numbers. */
  simple?: boolean
  /** Show the number of items. */
  showTotal?: boolean
  /** Show a box for typing a page number to go to. */
  showJumper?: boolean
  /** Render nothing when everything fits on one page. */
  hideOnSinglePage?: boolean
  disabled?: boolean
  size?: PaginationSize
}

export interface PaginationEmits {
  'update:page': [page: number]
  'update:pageSize': [pageSize: number]
  /** The page or the page size changed. */
  change: [page: number, pageSize: number]
}

/** One slot in the row of pages: a page number or a gap. */
export type PaginationItem = { type: 'page'; page: number } | { type: 'ellipsis'; key: string }
