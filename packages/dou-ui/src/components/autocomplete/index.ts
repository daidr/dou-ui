import { withInstall } from '../../utils/install'
import Autocomplete from './autocomplete.vue'

export const DouAutocomplete = withInstall(Autocomplete)
export default DouAutocomplete

export type * from './autocomplete'
export type AutocompleteInstance = InstanceType<typeof Autocomplete>

declare module 'vue' {
  export interface GlobalComponents {
    DouAutocomplete: typeof DouAutocomplete
  }
}
