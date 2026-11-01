import {
  FileCodeIcon,
  FileIcon,
  FileImageIcon,
  FileJsonIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
} from '@dou-ui/icons'
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
 * The icon of an exporter that gives none, by the file it writes: so an
 * exporter can be written without loading icons, as in a Worker.
 */
export const fileIconOf = (extension: string) => BY_EXTENSION[extension.toLowerCase()] ?? FileIcon
