import { withInstall } from '../../utils/install'
import ColorPanel from './color-panel.vue'

export const DouColorPanel = withInstall(ColorPanel)
export default DouColorPanel

export type * from './color-panel'
export type ColorPanelInstance = InstanceType<typeof ColorPanel>

declare module 'vue' {
  export interface GlobalComponents {
    DouColorPanel: typeof DouColorPanel
  }
}
