import type { Locale } from './types'

export const en: Locale = {
  name: 'en',
  input: {
    clear: 'Clear',
  },
  tag: {
    remove: 'Remove',
  },
  inputNumber: {
    increase: 'Increase',
    decrease: 'Decrease',
  },
  slider: {
    start: 'Start',
    end: 'End',
  },
  alert: {
    close: 'Close',
  },
  dialog: {
    close: 'Close',
  },
  drawer: {
    close: 'Close',
  },
  select: {
    placeholder: 'Select',
    empty: 'No matches',
    clear: 'Clear',
  },
  spinner: {
    loading: 'Loading',
  },
  toast: {
    region: 'Notifications',
    close: 'Close',
  },
  empty: {
    title: 'No data',
  },
  breadcrumb: {
    label: 'Breadcrumb',
    expand: 'Show full path',
  },
  pagination: {
    label: 'Pagination',
    prev: 'Previous page',
    next: 'Next page',
    page: 'Page {page}',
    total: '{total} items',
    pageSize: '{size} / page',
    pageSizeLabel: 'Items per page',
  },
  table: {
    selectAll: 'Select all',
    selectRow: 'Select row',
  },
  upload: {
    choose: 'Choose file',
    drop: 'Drop files here, or',
    browse: 'browse',
    list: 'Files',
    remove: 'Remove',
    retry: 'Retry',
    uploading: 'Uploading',
    error: 'Upload failed',
  },
  form: {
    optional: 'optional',
    required: 'This field is required',
    minLength: 'Must be at least {min} characters',
    maxLength: 'Must be at most {max} characters',
    minItems: 'Choose at least {min}',
    maxItems: 'Choose at most {max}',
    min: 'Must be at least {min}',
    max: 'Must be at most {max}',
    pattern: 'Invalid format',
    email: 'Enter a valid email address',
    url: 'Enter a valid URL',
    invalid: 'This value is not valid',
  },
}
