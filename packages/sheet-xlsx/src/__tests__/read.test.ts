import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  createFileSource,
  readWorkbook,
  SheetFileError,
  type SheetWorkbook,
} from '@dou-ui/sheet/core'
import { zip, type ZipEntry } from '../zip'
import { readXlsx, writeXlsx, xlsxImporter, type SheetXlsxWarning } from '../index'
import { parseXml, unescape } from '../xml-read'
import { formatKind } from '../read-styles'

const roundTrip = async (book: SheetWorkbook, options = {}) =>
  readXlsx(await writeXlsx(createFileSource(book)), options)

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
const R = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
const PKG = 'xmlns="http://schemas.openxmlformats.org/package/2006/relationships"'
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

/** A file as another program might write it: one sheet, with the parts given. */
async function fileOf(
  sheet: string,
  parts: {
    styles?: string
    strings?: string[]
    extra?: ZipEntry[]
    sheetRels?: string
    workbook?: string
    workbookRels?: string
  } = {},
) {
  const entries: ZipEntry[] = [
    {
      path: '_rels/.rels',
      data: `<Relationships ${PKG}><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      path: 'xl/workbook.xml',
      data:
        parts.workbook ??
        `<workbook ${NS} ${R}><sheets><sheet name="数据" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    {
      path: 'xl/_rels/workbook.xml.rels',
      data:
        `<Relationships ${PKG}><Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/>` +
        `<Relationship Id="rId2" Type="${REL}/styles" Target="styles.xml"/>` +
        `<Relationship Id="rId3" Type="${REL}/sharedStrings" Target="/xl/sharedStrings.xml"/>${parts.workbookRels ?? ''}</Relationships>`,
    },
    { path: 'xl/worksheets/sheet1.xml', data: `<worksheet ${NS} ${R}>${sheet}</worksheet>` },
    {
      path: 'xl/sharedStrings.xml',
      data: `<sst ${NS}>${(parts.strings ?? []).join('')}</sst>`,
    },
    {
      path: 'xl/styles.xml',
      data:
        parts.styles ??
        `<styleSheet ${NS}><fonts><font><sz val="11"/><name val="Calibri"/></font></fonts><cellXfs><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellXfs></styleSheet>`,
    },
    ...(parts.sheetRels
      ? [
          {
            path: 'xl/worksheets/_rels/sheet1.xml.rels',
            data: `<Relationships ${PKG}>${parts.sheetRels}</Relationships>`,
          },
        ]
      : []),
    ...(parts.extra ?? []),
  ]
  return zip(entries)
}

/** A run's look as programs write it, with only its typeface given. */
const font = (name: string) => `<rPr><sz val="11"/><color theme="1"/><rFont val="${name}"/></rPr>`

/** Why reading failed: its code, its reason and its message; `null` when it didn't. */
const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: SheetFileError) => [error.code, error.reason, error.message],
  )

/** An older-style container, as .xls files and files with a password come in: its header and its streams' names. */
function containerOf(names: string[]) {
  const bytes = new Uint8Array(512 + names.length * 128)
  bytes.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
  bytes.set([0x3e, 0, 3, 0, 0xfe, 0xff, 9, 0], 24)
  for (const [i, name] of names.entries())
    for (const [j, ch] of [...name].entries()) bytes[512 + i * 128 + j * 2] = ch.charCodeAt(0)
  return bytes
}

describe('xml reading', () => {
  it('turns entities back and reads prefixed names without the prefix', () => {
    expect(unescape('a&lt;b &amp; &quot;c&quot; &#20013;&#x6587;')).toBe('a<b & "c" 中文')
    const node = parseXml(
      '<?xml version="1.0"?><x:a x:b="1" xmlns:x="u"><x:c>t<![CDATA[<d>]]></x:c></x:a>',
    )
    expect(node.name).toBe('a')
    expect(node.attrs).toEqual({ b: '1' })
    expect(node.children[0]!.text).toBe('t<d>')
  })

  it('tells dates, times and numbers apart by their format', () => {
    expect(formatKind('yyyy/m/d')).toBe('date')
    expect(formatKind('[$-804]yyyy"年"m"月"d"日"')).toBe('date')
    expect(formatKind('h:mm AM/PM')).toBe('time')
    expect(formatKind('[h]:mm:ss')).toBe('number')
    expect(formatKind('#,##0.00 "元"')).toBe('number')
    expect(formatKind('[Red]0.00')).toBe('number')
    expect(formatKind('mmm')).toBe('date')
    expect(formatKind(undefined)).toBe('number')
  })
})

describe('readXlsx', () => {
  it('reads back what writeXlsx writes: values, formulas, formats and styles', async () => {
    const { book, warnings } = await roundTrip({
      version: 1,
      styles: { head: { bold: true, background: '#e6eaf7', align: 'center' } },
      sheets: [
        {
          name: '门店',
          cells: [
            [{ value: '门店', style: 'head' }, { value: '营收', style: 'head' }, '开业'],
            ['上海', { value: 186_400, format: '#,##0' }, '2026-03-05'],
            ['杭州', 129_800.5, '2026-04-01 09:30'],
            ['合计', '=SUM(B2:B3)', true],
            ["'=不是公式", { value: 0.125, format: '0.00%' }, '08:15'],
          ],
        },
      ],
    })
    expect(warnings).toEqual([])
    const sheet = book.sheets[0]!
    expect(sheet.name).toBe('门店')
    expect(sheet.cells).toEqual([
      [{ value: '门店', style: 'style1' }, { value: '营收', style: 'style1' }, '开业'],
      ['上海', { value: 186_400, format: '#,##0' }, '2026-03-05'],
      ['杭州', 129_800.5, '2026-04-01 09:30'],
      ['合计', '=SUM(B2:B3)', true],
      ["'=不是公式", { value: 0.125, format: '0.00%' }, '08:15'],
    ])
    expect(book.styles).toEqual({ style1: { bold: true, background: '#e6eaf7', align: 'center' } })
  })

  it('reads only the results with formulas off', async () => {
    const { book } = await roundTrip(
      { version: 1, sheets: [{ name: 'S', cells: [[1, 2, '=A1+B1']] }] },
      { formulas: false },
    )
    expect(book.sheets[0]!.cells[0]).toEqual([1, 2, 3])
  })

  it('reads sizes, hidden lines, merges, frozen panes, groups and notes', async () => {
    const { book } = await roundTrip({
      version: 1,
      sheets: [
        {
          name: 'S',
          cells: [['a', { value: 'b', note: '戴兜的批注' }], ['c'], ['d'], ['e'], ['f']],
          colSizes: { 0: 160, 2: 0 },
          rowSizes: { 0: 40, 4: 0 },
          merges: ['A1:A2'],
          freeze: { rows: 1, cols: 1 },
          groups: [{ range: '2:3', collapsed: true }, { range: 'D:E' }],
          groupSummary: 'after',
        },
      ],
    })
    const sheet = book.sheets[0]!
    expect(sheet.colSizes).toEqual({ 0: 160, 2: 0 })
    expect(sheet.rowSizes).toEqual({ 0: 40, 4: 0 })
    expect(sheet.merges).toEqual(['A1:A2'])
    expect(sheet.freeze).toEqual({ rows: 1, cols: 1 })
    expect(sheet.groups).toEqual([{ range: '2:3', collapsed: true }, { range: 'D:E' }])
    expect(sheet.groupSummary).toBe('after')
    expect(sheet.cells[0]![1]).toEqual({ value: 'b', note: '戴兜的批注' })
  })

  it('reads filters, conditional formats and validations', async () => {
    const { book, warnings } = await roundTrip({
      version: 1,
      sheets: [
        {
          name: 'S',
          cells: [
            ['城市', '营收'],
            ['上海', 120],
            ['杭州', 80],
            ['苏州', 95],
          ],
          filter: {
            range: 'A1:B4',
            columns: { 0: { values: ['上海', '苏州'] }, 1: { condition: { op: 'gt', value: 90 } } },
          },
          conditionalFormats: [
            { range: 'B2:B4', when: { op: 'gt', value: 100 }, style: { color: '#b2423e' } },
            { range: 'A2:A4', when: { op: 'contains', value: '州' }, style: { bold: true } },
            { range: 'B2:B4', formula: '=B2>AVERAGE($B$2:$B$4)', style: { italic: true } },
            { range: 'B2:B4', top: 1, style: { underline: true } },
            { range: 'B2:B4', scale: ['#ffffff', '#3366cc'] },
          ],
          validations: [
            { range: 'A2:A4', list: ['上海', '杭州', '苏州'] },
            {
              range: 'B2:B4',
              when: { op: 'between', value: 0, to: 1000 },
              integer: true,
              strict: false,
              message: '0 到 1000',
            },
          ],
        },
      ],
    })
    expect(warnings).toEqual([])
    const sheet = book.sheets[0]!
    expect(sheet.filter).toEqual({
      range: 'A1:B4',
      columns: { 0: { values: ['上海', '苏州'] }, 1: { condition: { op: 'gt', value: 90 } } },
    })
    // rows the filter hides aren't stored as hidden
    expect(sheet.rowSizes).toBeUndefined()
    expect(sheet.conditionalFormats).toEqual([
      { range: 'B2:B4', when: { op: 'gt', value: 100 }, style: { color: '#b2423e' } },
      { range: 'A2:A4', when: { op: 'contains', value: '州' }, style: { bold: true } },
      { range: 'B2:B4', formula: '=B2>AVERAGE($B$2:$B$4)', style: { italic: true } },
      { range: 'B2:B4', top: 1, style: { underline: true } },
      { range: 'B2:B4', scale: ['#ffffff', '#3366cc'] },
    ])
    expect(sheet.validations).toEqual([
      { range: 'A2:A4', list: ['上海', '杭州', '苏州'] },
      {
        range: 'B2:B4',
        when: { op: 'between', value: 0, to: 1000 },
        integer: true,
        strict: false,
        message: '0 到 1000',
      },
    ])
  })

  it('reads several sheets, and formulas that refer across them', async () => {
    const { book } = await roundTrip({
      version: 1,
      sheets: [
        { name: '一月', cells: [[10]] },
        { name: '二 月', cells: [["='一月'!A1*2"]] },
      ],
    })
    expect(book.sheets.map((s) => s.name)).toEqual(['一月', '二 月'])
    expect(book.sheets[1]!.cells[0]).toEqual(["='一月'!A1*2"])
  })

  it('reads what other programs write: shared formulas, inline text, rich text and theme colors', async () => {
    const styles =
      `<styleSheet ${NS}><numFmts><numFmt numFmtId="164" formatCode="yyyy/m/d"/></numFmts>` +
      '<fonts><font><sz val="11"/><color theme="1"/><name val="宋体"/></font><font><b/><sz val="11"/><color rgb="FFFF0000"/><name val="宋体"/></font><font><sz val="16"/><name val="黑体"/></font></fonts>' +
      '<fills><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor theme="4" tint="0.79998"/></patternFill></fill></fills>' +
      '<borders><border/><border><left style="thin"/></border></borders>' +
      '<cellXfs><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1"/><xf numFmtId="14" fontId="2" fillId="0" borderId="0"/></cellXfs></styleSheet>'
    const theme =
      '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:themeElements><a:clrScheme name="Office">' +
      '<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>' +
      '<a:dk2><a:srgbClr val="44546A"/></a:dk2><a:lt2><a:srgbClr val="E7E6E6"/></a:lt2><a:accent1><a:srgbClr val="4472C4"/></a:accent1>' +
      '</a:clrScheme></a:themeElements></a:theme>'
    const bytes = await fileOf(
      '<sheetData>' +
        '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="inlineStr"><is><t>行内</t></is></c></row>' +
        '<row r="2"><c r="A2"><v>1</v></c><c r="B2"><f t="shared" ref="B2:B4" si="0">A2*2</f><v>2</v></c><c r="C2" s="1"><v>46086</v></c></row>' +
        '<row r="3"><c r="A3"><v>2</v></c><c r="B3"><f t="shared" si="0"/><v>4</v></c><c r="C3" s="2" t="str"><f>_xlfn.CONCAT("a","b")</f><v>ab</v></c></row>' +
        '<row r="4"><c r="A4"><v>3</v></c><c r="B4"><f t="shared" si="0"/><v>6</v></c><c r="C4" s="3"><v>46086</v></c></row>' +
        '</sheetData><hyperlinks><hyperlink ref="A1" r:id="rId9"/></hyperlinks>',
      {
        styles,
        strings: [
          '<si><t>上海</t></si>',
          '<si><r><t>营</t></r><r><rPr><b/></rPr><t>收</t></r><rPh><t>えい</t></rPh></si>',
        ],
        extra: [{ path: 'xl/theme/theme1.xml', data: theme }],
        workbookRels: `<Relationship Id="rId4" Type="${REL}/theme" Target="theme/theme1.xml"/>`,
      },
    )
    const { book, warnings } = await readXlsx(bytes)
    const cells = book.sheets[0]!.cells
    expect(cells[0]).toEqual(['上海', '营收', '行内'])
    expect(cells[1]).toEqual([1, '=A2*2', { value: '2026-03-05', format: 'yyyy/m/d' }])
    expect(cells[2]).toEqual([2, '=A3*2', { value: '=CONCAT("a","b")', style: 'style1' }])
    expect(cells[3]).toEqual([3, '=A4*2', '2026-03-05'])
    expect(book.styles).toEqual({ style1: { bold: true, color: '#ff0000', background: '#dae3f3' } })
    expect(warnings.map((w) => [w.code, w.count])).toEqual([
      ['border', 1],
      ['font', 1],
      ['richText', 1],
      ['hyperlink', 1],
    ])
    expect(warnings[0]).toMatchObject({ message: '边框', sheet: '数据' })
  })

  it('counts dates from 1904 when the file does', async () => {
    const styles = `<styleSheet ${NS}><fonts><font><sz val="11"/></font></fonts><cellXfs><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="14" fontId="0" fillId="0" borderId="0"/></cellXfs></styleSheet>`
    const bytes = await fileOf(
      '<sheetData><row r="1"><c r="A1" s="1"><v>44624</v></c></row></sheetData>' +
        '<dataValidations count="1"><dataValidation type="date" operator="greaterThan" sqref="A1"><formula1>44624</formula1></dataValidation></dataValidations>',
      {
        styles,
        workbook: `<workbook ${NS} ${R}><workbookPr date1904="1"/><sheets><sheet name="数据" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      },
    )
    const sheet = (await readXlsx(bytes)).book.sheets[0]!
    expect(sheet.cells[0]).toEqual(['2026-03-05'])
    expect(sheet.validations).toEqual([{ range: 'A1', when: { op: 'gt', value: '2026-03-05' } }])
  })

  it('reads column widths as other programs show them', async () => {
    const bytes = await fileOf(
      '<cols><col min="1" max="1" width="20" customWidth="1"/><col min="2" max="2" width="9.140625" customWidth="1"/></cols><sheetData/>',
    )
    expect((await readXlsx(bytes)).book.sheets[0]!.colSizes).toEqual({ 0: 140, 1: 64 })
  })

  it('keeps results of formulas on tables, and lists the tables', async () => {
    const bytes = await fileOf(
      '<sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>数量</t></is></c><c r="B1"><f>SUM(表一[数量])</f><v>3</v></c><c r="C1"><f>SUM(A2:A3)</f><v>3</v></c></row>' +
        '<row r="2"><c r="A2"><v>1</v></c></row><row r="3"><c r="A3"><v>2</v></c></row></sheetData><tableParts count="1"><tablePart r:id="rId1"/></tableParts>',
      {
        sheetRels: `<Relationship Id="rId1" Type="${REL}/table" Target="../tables/table1.xml"/>`,
        extra: [
          {
            path: 'xl/tables/table1.xml',
            data: `<table ${NS} id="1" name="表一" displayName="表一" ref="A1:A3"><tableColumns count="1"><tableColumn id="1" name="数量"/></tableColumns></table>`,
          },
        ],
      },
    )
    const { book, warnings } = await readXlsx(bytes)
    expect(book.sheets[0]!.cells[0]).toEqual(['数量', 3, '=SUM(A2:A3)'])
    expect(warnings.map((w) => [w.code, w.count])).toEqual([['table', 2]])
    expect(warnings[0]!.message).toBe('表格对象和引用它的公式')
  })

  it('does not count text split only by typeface as formatted in parts', async () => {
    const bytes = await fileOf(
      '<sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row></sheetData>',
      {
        strings: [
          `<si><r>${font('Calibri')}<t>Q</t></r><r>${font('宋体')}<t>项</t></r></si>`,
          `<si><r>${font('Calibri')}<t>Q</t></r><r><rPr><b/><sz val="11"/></rPr><t>项</t></r></si>`,
        ],
      },
    )
    const { warnings } = await readXlsx(bytes)
    expect(warnings.map((w) => [w.code, w.count])).toEqual([['richText', 1]])
  })

  it('reads outline levels as groups and keeps rows a filter hides visible', async () => {
    const bytes = await fileOf(
      '<sheetPr><outlinePr summaryBelow="0"/></sheetPr><sheetData>' +
        '<row r="1"><c r="A1" t="inlineStr"><is><t>城市</t></is></c></row>' +
        '<row r="2" hidden="1"><c r="A2" t="inlineStr"><is><t>杭州</t></is></c></row>' +
        '<row r="3" outlineLevel="1"/><row r="4" outlineLevel="2" hidden="1"/><row r="5" outlineLevel="2" hidden="1"/><row r="6" outlineLevel="1"/>' +
        '</sheetData><autoFilter ref="A1:A2"><filterColumn colId="0"><filters><filter val="上海"/></filters></filterColumn></autoFilter>',
    )
    const { book } = await readXlsx(bytes)
    const sheet = book.sheets[0]!
    expect(sheet.groups).toEqual([{ range: '3:6' }, { range: '4:5', collapsed: true }])
    expect(sheet.groupSummary).toBe('before')
    expect(sheet.rowSizes).toBeUndefined()
    expect(sheet.filter).toEqual({ range: 'A1:A2', columns: { 0: { values: ['上海'] } } })
  })

  it('keeps links, protection and unlocked cells', async () => {
    const source: SheetWorkbook = {
      protect: true,
      styles: { blank: { locked: false } },
      sheets: [
        {
          name: '报价单',
          protect: { formatColumns: true, filter: true },
          cells: [
            [
              { value: '官网', link: 'https://ui.daidr.me/' },
              { value: '看汇总', link: "#'汇 总'!B2" },
              { value: '戴兜', style: 'blank' },
            ],
            [{ value: 3, link: 'mailto:daidr@daidr.me' }],
          ],
        },
        { name: '汇 总', cells: [['合计']] },
      ],
    }
    const { book, warnings } = await roundTrip(source)
    expect(warnings).toEqual([])
    expect(book.protect).toBe(true)
    const [sheet, other] = book.sheets
    expect(sheet!.protect).toEqual({ formatColumns: true, filter: true })
    expect(other!.protect).toBeUndefined()
    expect(sheet!.cells[0]![0]).toEqual({ value: '官网', link: 'https://ui.daidr.me/' })
    expect(sheet!.cells[0]![1]).toEqual({ value: '看汇总', link: "#'汇 总'!B2" })
    expect(sheet!.cells[1]![0]).toEqual({ value: 3, link: 'mailto:daidr@daidr.me' })
    const blank = sheet!.cells[0]![2] as { style: string }
    expect(book.styles![blank.style]).toEqual({ locked: false })
    // a sheet protected with nothing allowed comes back as `true`
    source.sheets[0]!.protect = true
    expect((await roundTrip(source)).book.sheets[0]!.protect).toBe(true)
  })

  it('reads links and protection other programs write, and says when a password is dropped', async () => {
    const bytes = await fileOf(
      '<sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>官网</t></is></c><c r="B1"><v>1</v></c></row></sheetData>' +
        '<sheetProtection password="CC1A" sheet="1" objects="1" scenarios="1" formatRows="0" sort="0"/>' +
        '<hyperlinks><hyperlink ref="A1" r:id="rId1"/><hyperlink ref="B1" location="数据!A1"/><hyperlink ref="C1" r:id="rId2"/></hyperlinks>',
      {
        sheetRels:
          `<Relationship Id="rId1" Type="${REL}/hyperlink" Target="https://ui.daidr.me/" TargetMode="External"/>` +
          `<Relationship Id="rId2" Type="${REL}/hyperlink" Target="javascript:alert(1)" TargetMode="External"/>`,
        workbook: `<workbook ${NS} ${R}><workbookProtection lockStructure="1" workbookPassword="CC1A"/><sheets><sheet name="数据" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      },
    )
    const { book, warnings } = await readXlsx(bytes)
    const sheet = book.sheets[0]!
    expect(book.protect).toBe(true)
    expect(sheet.protect).toEqual({ formatRows: true })
    expect(sheet.cells[0]).toEqual([
      { value: '官网', link: 'https://ui.daidr.me/' },
      { value: 1, link: '#数据!A1' },
    ])
    expect(warnings.map((w) => [w.code, w.count])).toEqual([
      ['hyperlink', 1],
      ['password', 1],
      ['password', 1],
    ])
    // one for the sheet, one for the workbook
    expect(warnings.filter((w) => w.code === 'password').map((w) => w.sheet)).toEqual([
      '数据',
      undefined,
    ])
  })

  it('lists what it leaves out, and keeps results of formulas on other files', async () => {
    const bytes = await fileOf(
      '<sheetData><row r="1"><c r="A1"><f>[1]Sheet1!A1</f><v>5</v></c></row></sheetData>' +
        '<conditionalFormatting sqref="A1"><cfRule type="iconSet" priority="1"><iconSet><cfvo type="min"/></iconSet></cfRule></conditionalFormatting>' +
        '<drawing r:id="rId1"/>',
      {
        workbook: `<workbook ${NS} ${R}><sheets><sheet name="数据" sheetId="1" r:id="rId1" state="hidden"/></sheets><definedNames><definedName name="税率">数据!$A$1</definedName></definedNames></workbook>`,
        sheetRels: `<Relationship Id="rId1" Type="${REL}/drawing" Target="../drawings/drawing1.xml"/>`,
        extra: [
          {
            path: 'xl/drawings/_rels/drawing1.xml.rels',
            data: `<Relationships ${PKG}><Relationship Id="rId1" Type="${REL}/chart" Target="../charts/chart1.xml"/><Relationship Id="rId2" Type="${REL}/image" Target="../media/image1.png"/></Relationships>`,
          },
          { path: 'xl/vbaProject.bin', data: new Uint8Array([1]) },
        ],
      },
    )
    const { book, warnings } = await readXlsx(bytes, { locale: 'en' })
    expect(book.sheets[0]!.cells[0]).toEqual([5])
    expect(new Set(warnings.map((w) => w.code))).toEqual(
      new Set(['macro', 'name', 'hiddenSheet', 'chart', 'image', 'conditional', 'external']),
    )
    expect(warnings.find((w) => w.code === 'macro')!.message).toBe('Macros')
  })

  it('says why a file can not be read: a code, a reason in the sheet language, and a message for developers', async () => {
    expect(await failure(readXlsx(new TextEncoder().encode('a,b\n1,2')))).toEqual([
      'notXlsx',
      '这不是 .xlsx 文件',
      "[@dou-ui/sheet-xlsx] The file isn't an .xlsx file.",
    ])
    // an older .xls and a file with a password come in the same kind of container
    expect((await failure(readXlsx(containerOf(['Root Entry', 'Workbook']))))![0]).toBe('notXlsx')
    const locked = containerOf(['Root Entry', 'EncryptionInfo', 'EncryptedPackage'])
    expect((await failure(readXlsx(locked, { locale: 'en' })))!.slice(0, 2)).toEqual([
      'locked',
      'The file has a password; remove it in the program it came from first',
    ])
    const cut = (
      await writeXlsx(createFileSource({ version: 1, sheets: [{ name: 'S', cells: [[1]] }] }))
    ).slice(0, 200)
    await expect(readXlsx(cut)).rejects.toBeInstanceOf(SheetFileError)
    expect((await failure(readXlsx(cut)))!.slice(0, 2)).toEqual(['damaged', '文件已损坏'])
  })

  it('takes texts of its own, in part', async () => {
    const bytes = await fileOf('<sheetData/>', {
      workbook: `<workbook ${NS} ${R}><sheets><sheet name="数据" sheetId="1" r:id="rId1" state="hidden"/></sheets><definedNames><definedName name="税率">数据!$A$1</definedName></definedNames></workbook>`,
    })
    const { warnings } = await readXlsx(bytes, {
      messages: { warnings: { name: '名称' }, notXlsx: '请选择 .xlsx 文件' },
    })
    expect(warnings.map((w) => w.message)).toEqual(['名称', '隐藏的工作表'])
    await expect(
      readXlsx(new Uint8Array([1, 2]), { messages: { notXlsx: '请选择 .xlsx 文件' } }),
    ).rejects.toMatchObject({ reason: '请选择 .xlsx 文件' })
  })

  it('stops when called off', async () => {
    const bytes = await writeXlsx(
      createFileSource({ version: 1, sheets: [{ name: 'S', cells: [[1]] }] }),
    )
    const controller = new AbortController()
    controller.abort()
    await expect(readXlsx(bytes, { signal: controller.signal })).rejects.toThrow(/abort/i)
  })

  it('is an importer the sheet picks for .xlsx files', async () => {
    const bytes = await writeXlsx(
      createFileSource({ version: 1, sheets: [{ name: 'S', cells: [['上海']] }] }),
    )
    expect(xlsxImporter.sniff!(bytes.subarray(0, 8))).toBe(true)
    const file = new File([bytes as BlobPart], '门店.xlsx')
    const result = await xlsxImporter.import(file, { messages: {} as never, locale: 'zh-CN' })
    expect(result.book.sheets[0]!.cells).toEqual([['上海']])
    // what it gives back keeps its type through readWorkbook: warnings always come, with their codes
    const read = await readWorkbook(file, xlsxImporter)
    expectTypeOf(read.warnings).toEqualTypeOf<SheetXlsxWarning[]>()
    expect(read.warnings).toEqual([])
  })
})
