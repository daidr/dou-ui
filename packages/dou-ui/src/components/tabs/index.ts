import { withInstall } from '../../utils/install'
import Tabs from './tabs.vue'
import TabPanel from './tab-panel.vue'

export const DouTabs = withInstall(Tabs)
export const DouTabPanel = withInstall(TabPanel)
export default DouTabs

export type * from './tabs'
export type TabsInstance = InstanceType<typeof Tabs>
export type TabPanelInstance = InstanceType<typeof TabPanel>

declare module 'vue' {
  export interface GlobalComponents {
    DouTabs: typeof DouTabs
    DouTabPanel: typeof DouTabPanel
  }
}
