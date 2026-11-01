import { FileSpreadsheetIcon } from '@dou-ui/icons'
import type { SheetExtension, SheetLabel } from '@dou-ui/sheet'
// only the file side of the sheet, so that a Worker writing .xlsx files loads no components
import { defineSheetExporter } from '@dou-ui/sheet/core'
import { writeXlsx, type SheetXlsxExportOptions } from './write'

export { writeXlsx, type SheetXlsxExportOptions } from './write'

declare module '@dou-ui/sheet' {
  interface SheetExporterOptions {
    xlsx: SheetXlsxExportOptions
  }
}

const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/**
 * The name in the export menu, said as the sheet's language says CSV's:
 * `CSV 文件 (.csv)` becomes `XLSX 文件 (.xlsx)`.
 */
const defaultLabel: SheetLabel = (m) =>
  m.file.csv.includes('CSV')
    ? m.file.csv.replaceAll('CSV', 'XLSX').replaceAll('.csv', '.xlsx')
    : 'XLSX (.xlsx)'

/** Writes the workbook, one sheet or the selected cells as an .xlsx file. */
export const xlsxExporter = defineSheetExporter<SheetXlsxExportOptions>({
  name: 'xlsx',
  label: defaultLabel,
  extension: 'xlsx',
  mime: MIME,
  scopes: ['workbook', 'sheet', 'selection'],
  async export(source, options) {
    const bytes = await writeXlsx(source, options)
    return new Blob([bytes as BlobPart], { type: MIME })
  },
})

export interface SheetXlsxOptions extends SheetXlsxExportOptions {
  /** The name in the toolbar's export menu. */
  label?: SheetLabel
}

/**
 * The .xlsx extension: adds exporting to .xlsx to the toolbar and to
 * `exportFile('xlsx')` / `saveFile('xlsx')`.
 */
export function xlsx(options: SheetXlsxOptions = {}): SheetExtension {
  const { label, ...defaults } = options
  return {
    name: 'xlsx',
    exporters: [
      {
        ...xlsxExporter,
        label: label ?? xlsxExporter.label,
        icon: FileSpreadsheetIcon,
        export: (source, own) => xlsxExporter.export(source, { ...defaults, ...own }),
      },
    ],
  }
}
