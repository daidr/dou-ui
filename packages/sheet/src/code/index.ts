import { withInstall } from 'dou-ui'
import CodeFormulaBar from './code-formula-bar.vue'

/**
 * The formula bar with the formula in `@dou-ui/code`'s code input. Use it
 * in place of `DouSheetFormulaBar`; needs `@dou-ui/code` and its styles.
 */
export const DouSheetCodeFormulaBar = withInstall(CodeFormulaBar)
export { sheetFormula } from './language'
export type { SheetFormulaState } from './language'

declare module 'vue' {
  export interface GlobalComponents {
    DouSheetCodeFormulaBar: typeof DouSheetCodeFormulaBar
  }
}
