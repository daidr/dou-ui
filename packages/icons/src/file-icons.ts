import {
  FileCodeIcon,
  FileIcon,
  FileImageIcon,
  FileJsonIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
} from './generated'
import type { Component } from 'vue'

const BY_EXTENSION: Record<string, Component> = {
  csv: FileTextIcon,
  tsv: FileTextIcon,
  txt: FileTextIcon,
  md: FileTextIcon,
  xlsx: FileSpreadsheetIcon,
  xlsm: FileSpreadsheetIcon,
  xls: FileSpreadsheetIcon,
  ods: FileSpreadsheetIcon,
  json: FileJsonIcon,
  html: FileCodeIcon,
  xml: FileCodeIcon,
  png: FileImageIcon,
  jpg: FileImageIcon,
  jpeg: FileImageIcon,
  webp: FileImageIcon,
  svg: FileImageIcon,
}

/**
 * The icon of a file by its extension (`'xlsx'`, `'csv'`), such as for a
 * menu of file types; the plain file icon for one not listed.
 */
export const fileIconOf = (extension: string) => BY_EXTENSION[extension.toLowerCase()] ?? FileIcon
