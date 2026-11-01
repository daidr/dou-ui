import type { SheetExtension, SheetLabel } from '@dou-ui/sheet'
// only the file side of the sheet, so that a Worker writing .xlsx files loads no components
import { defineSheetExporter, defineSheetImporter } from '@dou-ui/sheet/core'
import { readXlsx, type SheetXlsxImportOptions, type SheetXlsxImportResult } from './read'
import { writeXlsx, type SheetXlsxExportOptions } from './write'

export { writeXlsx, type SheetXlsxExportOptions } from './write'
export {
  readXlsx,
  type SheetXlsxErrorCode,
  type SheetXlsxImportOptions,
  type SheetXlsxImportResult,
  type SheetXlsxReadOptions,
  type SheetXlsxWarning,
} from './read'
export { sheetXlsxLocales, sheetXlsxMessagesFor } from './messages'
export type { SheetXlsxMessages, SheetXlsxMessagesInput, SheetXlsxWarningCode } from './messages'

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

// a zip starts so; whether it is an .xlsx file shows once it is read
const isZip = (head: Uint8Array) =>
  head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04

/** Reads an .xlsx file as a workbook; what it can't bring over comes back in `warnings`. */
export const xlsxImporter = defineSheetImporter<SheetXlsxImportOptions, SheetXlsxImportResult>({
  name: 'xlsx',
  label: defaultLabel,
  accept: ['.xlsx', '.xlsm', MIME, 'application/vnd.ms-excel.sheet.macroEnabled.12'],
  sniff: isZip,
  import: (file, context, options) =>
    readXlsx(file, { locale: context.locale, signal: context.signal, ...options }),
})

export interface SheetXlsxOptions extends SheetXlsxExportOptions, SheetXlsxImportOptions {
  /** The name in the toolbar's export menu, and of the files in the import hints. */
  label?: SheetLabel
}

/**
 * The .xlsx extension: adds exporting and importing .xlsx files to the
 * toolbar, to `exportFile('xlsx')` / `saveFile('xlsx')` and to `importFile`.
 */
export function xlsx(options: SheetXlsxOptions = {}): SheetExtension {
  const { label, ...defaults } = options
  return {
    name: 'xlsx',
    exporters: [
      {
        ...xlsxExporter,
        label: label ?? xlsxExporter.label,
        export: (source, own) => xlsxExporter.export(source, { ...defaults, ...own }),
      },
    ],
    importers: [
      {
        ...xlsxImporter,
        label: label ?? xlsxImporter.label,
        import: (file, context, own) => xlsxImporter.import(file, context, { ...defaults, ...own }),
      },
    ],
  }
}
