import type { InputHTMLAttributes } from 'vue'
import { withInstall } from '../../utils/install'
import Autocomplete from './autocomplete.vue'

export const DouAutocomplete = withInstall<typeof Autocomplete, InputHTMLAttributes>(Autocomplete)
export default DouAutocomplete

export type * from './autocomplete'
export type AutocompleteInstance = InstanceType<typeof Autocomplete>

declare module 'vue' {
  export interface GlobalComponents {
    DouAutocomplete: typeof DouAutocomplete
  }
}
