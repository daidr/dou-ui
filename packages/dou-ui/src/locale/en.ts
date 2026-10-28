import type { Locale } from './types'

export const en: Locale = {
  name: 'en',
  input: {
    clear: 'Clear',
  },
  tag: {
    remove: 'Remove',
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
