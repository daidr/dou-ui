import { describe, expect, it, vi } from 'vitest'
import { createFileSource, exportWorkbook, type SheetWorkbook } from '@dou-ui/sheet'
import { unzip, zip } from '../zip'
import { writeXlsx, xlsx, xlsxExporter } from '../index'

const decoder = new TextDecoder()

async function parts(
  book: SheetWorkbook,
  options: Parameters<typeof createFileSource>[1] = {},
  xlsxOptions = {},
) {
  const bytes = await writeXlsx(createFileSource(book, options), xlsxOptions)
  const files = await unzip(bytes)
  const text = (path: string) => {
    const file = files.get(path)
    return file ? decoder.decode(file) : undefined
  }
  return { files, text, sheet: (n = 1) => text(`xl/worksheets/sheet${n}.xml`)! }
}

/** The shared strings, in order. */
const stringsOf = (xml: string) => [...xml.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((m) => m[1])

describe('zip', () => {
  it('stores the CRC-32 of each file, as other programs check it', async () => {
    const data = new Uint8Array(100_003).map((_, i) => (i * 7919) & 0xff)
    const bytes = await zip([{ path: 'a.bin', data: [data.subarray(0, 500), data.subarray(500)] }])
    let crc = 0xffffffff
    for (const byte of data) {
      crc ^= byte
      for (let k = 0; k < 8; k++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset)
    expect(view.getUint32(14, true)).toBe((crc ^ 0xffffffff) >>> 0)
    expect(view.getUint32(22, true)).toBe(data.length)
  })

  it('reads back what it writes', async () => {
    const big = 'x'.repeat(10_000)
    const bytes = await zip([
      { path: 'a.txt', data: 'hello' },
      { path: '目录/b.txt', data: big },
      { path: 'c.bin', data: new Uint8Array([0, 1, 2, 255]) },
    ])
    expect(bytes.length).toBeLessThan(big.length)
    const files = await unzip(bytes)
    expect(decoder.decode(files.get('a.txt'))).toBe('hello')
    expect(decoder.decode(files.get('目录/b.txt'))).toBe(big)
    expect([...files.get('c.bin')!]).toEqual([0, 1, 2, 255])
  })

  it('says what it needs when the platform has no CompressionStream', async () => {
    vi.stubGlobal('CompressionStream', undefined)
    try {
      await expect(zip([{ path: 'a', data: 'a' }])).rejects.toThrow(
        '[@dou-ui/sheet-xlsx] needs CompressionStream',
      )
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('refuses what is not a zip', async () => {
    await expect(unzip(new Uint8Array(30))).rejects.toThrow('[@dou-ui/sheet-xlsx]')
  })
})

describe('writeXlsx', () => {
  it('writes the parts a workbook needs', async () => {
    const { files, text } = await parts({ sheets: [{ name: '门店', cells: [['上海']] }] })
    expect([...files.keys()][0]).toBe('[Content_Types].xml')
    expect(
      [
        '_rels/.rels',
        'xl/workbook.xml',
        'xl/_rels/workbook.xml.rels',
        'xl/styles.xml',
        'xl/sharedStrings.xml',
        'xl/worksheets/sheet1.xml',
      ].filter((path) => !files.has(path)),
    ).toEqual([])
    expect(text('xl/workbook.xml')).toContain('<sheet name="门店" sheetId="1" r:id="rId1"/>')
  })

  it('writes numbers, text, booleans and shares repeated text', async () => {
    const { sheet, text } = await parts({
      sheets: [
        {
          name: 'S',
          cells: [
            [1.5, '上海', true],
            ['上海', ' 空格 ', "'=1+1"],
          ],
        },
      ],
    })
    const xml = sheet()
    expect(xml).toContain(
      '<row r="1"><c><v>1.5</v></c><c t="s"><v>0</v></c><c t="b"><v>1</v></c></row>',
    )
    expect(xml).toContain('<row r="2"><c t="s"><v>0</v></c>')
    const sst = text('xl/sharedStrings.xml')!
    expect(stringsOf(sst)).toEqual(['上海', ' 空格 ', '=1+1'])
    expect(sst).toContain('count="4" uniqueCount="3"')
    expect(sst).toContain('<t xml:space="preserve"> 空格 </t>')
  })

  it('names a cell only after a gap, as cells in a row follow on otherwise', async () => {
    const xml = (
      await parts({ sheets: [{ name: 'S', cells: [[null, 1, 2, null, 4, '']] }] })
    ).sheet()
    expect(xml).toContain(
      '<row r="1"><c r="B1"><v>1</v></c><c><v>2</v></c><c r="E1"><v>4</v></c></row>',
    )
  })

  it('escapes text and drops characters XML cannot hold', async () => {
    const { text } = await parts({ sheets: [{ name: 'S', cells: [['a<b & "c"\u0001']] }] })
    expect(text('xl/sharedStrings.xml')).toContain('<t>a&lt;b &amp; &quot;c&quot;</t>')
  })

  it('writes formulas with their results, or only the results', async () => {
    const book: SheetWorkbook = {
      sheets: [{ name: 'S', cells: [[2, 3, '=A1*B1', '=A1>1', '="a"&"b"', '=1/0', '=SUM(']] }],
    }
    const kept = (await parts(book)).sheet()
    expect(kept).toContain('<c><f>A1*B1</f><v>6</v></c>')
    expect(kept).toContain('<c t="b"><f>A1&gt;1</f><v>1</v></c>')
    expect(kept).toContain('<c t="str"><f>&quot;a&quot;&amp;&quot;b&quot;</f><v>ab</v></c>')
    expect(kept).toContain('<c t="e"><f>1/0</f><v>#DIV/0!</v></c>')
    // not a formula: kept as its text
    expect(kept).toContain('<c t="s">')
    const values = (await parts(book, {}, { formulas: false })).sheet()
    expect(values).not.toContain('<f>')
    expect(values).toContain('<c><v>6</v></c>')
    expect(values).toContain('<c t="e"><v>#DIV/0!</v></c>')
  })

  it('writes a formula that depends on itself as an error the file knows', async () => {
    const xml = (await parts({ sheets: [{ name: 'S', cells: [['=A1']] }] })).sheet()
    expect(xml).toContain('<v>#VALUE!</v>')
  })

  it('writes dates and times as day numbers with a format', async () => {
    const { sheet, text } = await parts({
      sheets: [
        {
          name: 'S',
          cells: [['2026-03-02', '09:30', { value: '2026-03-02', format: 'yyyy年m月d日' }]],
        },
      ],
    })
    const xml = sheet()
    expect(xml).toMatch(/<c s="\d+"><v>46083<\/v><\/c>/)
    expect(xml).toMatch(/<c s="\d+"><v>0\.3958333/)
    const styles = text('xl/styles.xml')!
    expect(styles).toContain('formatCode="yyyy-mm-dd"')
    expect(styles).toContain('formatCode="hh:mm"')
    expect(styles).toContain('formatCode="yyyy年m月d日"')
  })

  it('writes named styles with tones in light theme colors', async () => {
    const { sheet, text } = await parts({
      styles: { head: { bold: true, fill: 'primary', align: 'center' }, red: { color: '#c00' } },
      sheets: [
        {
          name: 'S',
          cells: [
            [
              { value: '名称', style: 'head' },
              { value: 1, style: 'red' },
            ],
          ],
        },
      ],
    })
    expect(sheet()).toMatch(/<c s="[1-9]\d*" t="s">/)
    const styles = text('xl/styles.xml')!
    expect(styles).toContain('<b/>')
    expect(styles).toContain('<color rgb="FFCC0000"/>')
    expect(styles).toMatch(/<fgColor rgb="FF[0-9A-F]{6}"\/>/)
    expect(styles).toContain('horizontal="center"')
  })

  it('writes merges, freeze, sizes and hidden lines', async () => {
    const xml = (
      await parts({
        sheets: [
          {
            name: 'S',
            cells: [['a', 'b'], ['c']],
            merges: ['A1:B1'],
            freeze: { rows: 1, cols: 1 },
            colSizes: { 0: 180, 1: 0 },
            rowSizes: { 1: 40 },
          },
        ],
      })
    ).sheet()
    expect(xml).toContain('<mergeCells count="1"><mergeCell ref="A1:B1"/></mergeCells>')
    expect(xml).toContain(
      '<pane xSplit="1" ySplit="1" topLeftCell="B2" activePane="bottomRight" state="frozen"/>',
    )
    expect(xml).toContain('<col min="1" max="1" width="25" customWidth="1"/>')
    expect(xml).toContain('<col min="2" max="2" width="13" hidden="1"/>')
    expect(xml).toContain('<row r="2" ht="30" customHeight="1">')
    expect(xml).toContain('defaultRowHeight="21" defaultColWidth="13"')
  })

  it('takes the grid sizes from options', async () => {
    const xml = (
      await parts({ sheets: [{ name: 'S', cells: [['a']] }] }, { colWidth: 124, rowHeight: 32 })
    ).sheet()
    expect(xml).toContain('defaultRowHeight="24" defaultColWidth="17"')
  })

  it('writes groups as outline levels, folded ones hidden', async () => {
    const xml = (
      await parts({
        sheets: [
          {
            name: 'S',
            cells: [['总计'], ['a'], ['b'], ['c']],
            groups: [{ range: '2:4', collapsed: true }, { range: '3:3' }, { range: 'B:C' }],
          },
        ],
      })
    ).sheet()
    expect(xml).toContain('<row r="2" hidden="1" outlineLevel="1">')
    expect(xml).toContain('<row r="3" hidden="1" outlineLevel="2">')
    expect(xml).toContain('<row r="1" collapsed="1">')
    expect(xml).toContain('outlineLevel="1"/>')
    expect(xml).toContain('outlineLevelRow="2" outlineLevelCol="1"')
    expect(xml).toContain('<outlinePr summaryBelow="0" summaryRight="0"/>')
  })

  it('writes notes as comments with their boxes', async () => {
    const { text, files } = await parts({
      sheets: [{ name: 'S', cells: [[null, { value: 1, note: '负责人：戴兜' }]] }],
    })
    expect(text('xl/comments1.xml')).toContain(
      '<comment ref="B1" authorId="0"><text><t xml:space="preserve">负责人：戴兜</t>',
    )
    expect(text('xl/drawings/vmlDrawing1.vml')).toContain('<x:Row>0</x:Row><x:Column>1</x:Column>')
    expect(text('xl/worksheets/_rels/sheet1.xml.rels')).toContain('Target="../comments1.xml"')
    expect(text('xl/worksheets/sheet1.xml')).toContain('<legacyDrawing r:id="rId2"/>')
    expect(text('[Content_Types].xml')).toContain('/xl/comments1.xml')
    expect(files.size).toBe(10)
  })

  it('writes validations', async () => {
    const xml = (
      await parts({
        sheets: [
          {
            name: 'S',
            cells: [['a']],
            validations: [
              { range: 'A2:A9', list: ['上海', '北京'], prompt: '选择城市' },
              { range: 'B2:B9', list: '=$D$1:$D$5' },
              {
                range: 'C2:C9',
                when: { op: 'between', value: 1, to: 5 },
                integer: true,
                strict: false,
              },
              { range: 'D2:D9', formula: '=D2>C2', message: '要大于 C 列' },
              { range: 'E2:E9', when: { op: 'contains', value: '@' } },
            ],
          },
        ],
      })
    ).sheet()
    expect(xml).toContain('<dataValidations count="5">')
    expect(xml).toContain('type="list"')
    expect(xml).toContain('<formula1>&quot;上海,北京&quot;</formula1>')
    expect(xml).toContain('<formula1>$D$1:$D$5</formula1>')
    expect(xml).toContain('type="whole" operator="between"')
    expect(xml).toContain('errorStyle="warning"')
    expect(xml).toContain('<formula1>1</formula1><formula2>5</formula2>')
    expect(xml).toContain('type="custom"')
    expect(xml).toContain('<formula1>D2&gt;C2</formula1>')
    expect(xml).toContain('<formula1>NOT(ISERROR(SEARCH(&quot;@&quot;,E2)))</formula1>')
  })

  it('writes cells of a list type as list validations', async () => {
    const xml = (
      await parts({
        types: {
          status: { type: 'select', options: ['进行中', { value: '完成', tone: 'success' }] },
        },
        sheets: [
          {
            name: 'S',
            cells: [[{ value: '完成', type: 'status' }], [{ value: '进行中', type: 'status' }]],
          },
        ],
      })
    ).sheet()
    expect(xml).toContain('sqref="A1:A2"><formula1>&quot;进行中,完成&quot;</formula1>')
  })

  it('writes conditional formats', async () => {
    const { sheet, text } = await parts({
      styles: { warn: { fill: 'warning' } },
      sheets: [
        {
          name: 'S',
          cells: [[1], [2], [3]],
          conditionalFormats: [
            { range: 'A1:A3', when: { op: 'gt', value: 1 }, style: 'warn' },
            { range: 'A1:A3', when: { op: 'contains', value: '上海' }, style: { bold: true } },
            { range: 'A1:A3', formula: '=A1>AVERAGE($A$1:$A$3)', style: { tone: 'danger' } },
            { range: 'A1:A3', top: 2, style: 'warn' },
            { range: 'A1:A3', average: 'below', style: 'warn' },
            { range: 'A1:A3', duplicates: true, style: 'warn' },
            { range: ['A1:A3', 'C1:C3'], scale: ['danger', 'warning', 'success'] },
            { range: 'A1:A3', bar: 'primary' },
          ],
        },
      ],
    })
    const xml = sheet()
    expect(xml).toContain(
      'type="cellIs" dxfId="0" priority="1" operator="greaterThan"><formula>1</formula>',
    )
    expect(xml).toContain('type="containsText"')
    expect(xml).toContain('<formula>NOT(ISERROR(SEARCH(&quot;上海&quot;,A1)))</formula>')
    expect(xml).toContain('type="expression"')
    expect(xml).toContain('<formula>A1&gt;AVERAGE($A$1:$A$3)</formula>')
    expect(xml).toContain('type="top10" dxfId="0" priority="4" rank="2"')
    expect(xml).toContain('aboveAverage="0"')
    expect(xml).toContain('type="duplicateValues"')
    expect(xml).toContain('<conditionalFormatting sqref="A1:A3 C1:C3"><cfRule type="colorScale"')
    expect(xml).toMatch(
      /<dataBar><cfvo type="min"\/><cfvo type="max"\/><color rgb="FF[0-9A-F]{6}"\/>/,
    )
    expect(text('xl/styles.xml')).toMatch(/<dxfs count="3">/)
  })

  it('writes the filter and what it keeps', async () => {
    const { sheet, text } = await parts({
      sheets: [
        {
          name: '销售',
          cells: [
            ['城市', '金额'],
            ['上海', 1],
          ],
          filter: {
            range: 'A1:B9',
            columns: { 0: { values: ['上海', ''] }, 1: { condition: { op: 'gt', value: 100 } } },
          },
        },
      ],
    })
    const xml = sheet()
    expect(xml).toContain('<autoFilter ref="A1:B9">')
    expect(xml).toContain(
      '<filterColumn colId="0"><filters blank="1"><filter val="上海"/></filters></filterColumn>',
    )
    expect(xml).toContain(
      '<filterColumn colId="1"><customFilters><customFilter operator="greaterThan" val="100"/>',
    )
    expect(text('xl/workbook.xml')).toContain(
      'localSheetId="0" hidden="1">销售!$A$1:$B$9</definedName>',
    )
  })

  it('hides the rows the filter hides, as other programs do not filter on opening', async () => {
    const xml = (
      await parts({
        sheets: [
          {
            name: 'S',
            cells: [
              ['城市', '金额'],
              ['上海', 300],
              ['北京', 50],
              ['上海', 20],
            ],
            filter: {
              range: 'A1:B4',
              columns: { 0: { values: ['上海'] }, 1: { condition: { op: 'gt', value: 100 } } },
            },
          },
        ],
      })
    ).sheet()
    expect(xml).toContain('<row r="2"><c')
    expect(xml).toContain('<row r="3" hidden="1">')
    expect(xml).toContain('<row r="4" hidden="1">')
  })

  it('writes the selected cells from A1, as values', async () => {
    const book: SheetWorkbook = {
      sheets: [
        {
          name: 'S',
          cells: [
            [1, 2, 3],
            [4, 5, '=A2+B2'],
            [7, 8, 9],
          ],
          merges: ['B2:C2', 'A3:C3'],
          freeze: { rows: 1 },
        },
      ],
    }
    const xml = (
      await parts(book, { scope: 'selection', bounds: { top: 1, left: 1, bottom: 2, right: 2 } })
    ).sheet()
    expect(xml).toContain('<row r="1"><c><v>5</v></c><c><v>9</v></c></row>')
    expect(xml).toContain('<mergeCell ref="A1:B1"/>')
    expect(xml).not.toContain('<f>')
    expect(xml).not.toContain('pane')
    expect(xml).toContain('<dimension ref="A1:B2"/>')
  })

  it('writes every sheet, with names other programs take', async () => {
    const { text, files } = await parts({
      sheets: [
        { name: '计划/2026', cells: [[1]] },
        { name: 'x'.repeat(40), cells: [[2]] },
        { name: '计划_2026', cells: [[3]] },
      ],
    })
    const workbook = text('xl/workbook.xml')!
    // a name that is fine keeps it; a changed one takes a number
    expect(workbook).toContain('name="计划_2026 (2)" sheetId="1"')
    expect(workbook).toContain(`name="${'x'.repeat(31)}" sheetId="2"`)
    expect(workbook).toContain('name="计划_2026" sheetId="3"')
    expect(files.has('xl/worksheets/sheet3.xml')).toBe(true)
  })

  it('changes the formulas that refer to a sheet whose name changed', async () => {
    const { sheet } = await parts({
      sheets: [
        {
          name: '一季度/二季度',
          cells: [[10]],
          conditionalFormats: [
            { range: 'A1', formula: "='一季度/二季度'!A1>5", style: { bold: true } },
          ],
        },
        {
          name: '汇总',
          cells: [["='一季度/二季度'!A1*2", '=SUM(一季度/二季度!A1:A1)']],
          validations: [{ range: 'C1', list: "='一季度/二季度'!A1:A3" }],
        },
      ],
    })
    expect(sheet(1)).toContain('<formula>一季度_二季度!A1&gt;5</formula>')
    const xml = sheet(2)
    expect(xml).toContain('<f>一季度_二季度!A1*2</f><v>20</v>')
    expect(xml).toContain('<formula1>一季度_二季度!A1:A3</formula1>')
  })

  it('quotes sheet names that read as cells', async () => {
    const { text } = await parts({
      sheets: [
        { name: 'AB12', cells: [['a']], filter: { range: 'A1:A3' } },
        { name: 'R1C1', cells: [['a']], filter: { range: 'A1:A3' } },
      ],
    })
    const workbook = text('xl/workbook.xml')!
    expect(workbook).toContain("'AB12'!$A$1:$A$3")
    expect(workbook).toContain("'R1C1'!$A$1:$A$3")
  })

  it('refuses a workbook without sheets', async () => {
    await expect(writeXlsx(createFileSource({ sheets: [] }))).rejects.toThrow(
      '[@dou-ui/sheet-xlsx] a workbook needs at least one sheet',
    )
  })

  it('writes dates formulas come to as dates', async () => {
    const xml = (
      await parts({ sheets: [{ name: 'S', cells: [['2026-03-02', '=A1+1', '=DATE(2026,3,4)']] }] })
    ).sheet()
    expect(xml).toMatch(
      /<c s="(\d+)"><f>A1\+1<\/f><v>46084<\/v><\/c><c s="\1"><f>DATE\(2026,3,4\)<\/f><v>46085<\/v>/,
    )
  })

  it('writes numbers the file cannot hold as #NUM!', async () => {
    const xml = (
      await parts({ sheets: [{ name: 'S', cells: [[Number.NaN, Infinity, '=B1']] }] })
    ).sheet()
    expect(xml).toContain(
      '<row r="1"><c t="e"><v>#NUM!</v></c><c t="e"><v>#NUM!</v></c><c t="e"><f>B1</f><v>#NUM!</v></c></row>',
    )
  })

  it('keeps text that reads as a formula text when edited elsewhere', async () => {
    const { sheet, text } = await parts({ sheets: [{ name: 'S', cells: [["'=1+1"]] }] })
    expect(sheet()).toMatch(/<c s="[1-9]\d*" t="s">/)
    expect(text('xl/styles.xml')).toContain('quotePrefix="1"')
  })

  it('leaves out lists whose values hold a comma or a quote', async () => {
    const xml = (
      await parts({
        types: { area: { type: 'select', options: ['上海,浦东', '上海,静安'] } },
        sheets: [
          {
            name: 'S',
            cells: [[{ value: '上海,浦东', type: 'area' }]],
            validations: [
              { range: 'B1:B3', list: ['a"b', 'c'] },
              { range: 'C1:C3', list: ['甲', '乙'] },
            ],
          },
        ],
      })
    ).sheet()
    expect(xml).toContain('<dataValidations count="1">')
    expect(xml).toContain('<formula1>&quot;甲,乙&quot;</formula1>')
  })

  it('takes the grid sizes from the source', async () => {
    const blob = await exportWorkbook({ sheets: [{ name: 'S', cells: [['a']] }] }, xlsxExporter, {
      colWidth: 200,
      rowHeight: 40,
    })
    const files = await unzip(new Uint8Array(await blob.arrayBuffer()))
    expect(decoder.decode(files.get('xl/worksheets/sheet1.xml'))).toContain(
      'defaultRowHeight="30" defaultColWidth="27.86"',
    )
  })

  it('stops when the export is called off', async () => {
    const controller = new AbortController()
    controller.abort()
    const source = createFileSource(
      { sheets: [{ name: 'S', cells: [[1]] }] },
      { signal: controller.signal },
    )
    await expect(writeXlsx(source)).rejects.toThrow(/abort/i)
  })
})

describe('xlsx()', () => {
  it('adds the exporter, with its options as defaults', async () => {
    const extension = xlsx({ formulas: false })
    const exporter = extension.exporters![0]!
    expect(exporter.name).toBe('xlsx')
    const blob = await exportWorkbook({ sheets: [{ name: 'S', cells: [[1, '=A1+1']] }] }, exporter)
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    const files = await unzip(new Uint8Array(await blob.arrayBuffer()))
    expect(decoder.decode(files.get('xl/worksheets/sheet1.xml'))).not.toContain('<f>')
  })

  it('says its name as the sheet says CSV', () => {
    const label = xlsxExporter.label as (m: unknown) => string
    expect(label({ file: { csv: 'CSV 文件 (.csv)' } })).toBe('XLSX 文件 (.xlsx)')
    expect(label({ file: { csv: 'Comma separated' } })).toBe('XLSX (.xlsx)')
    expect(xlsx({ label: '表格文件' }).exporters![0]!.label).toBe('表格文件')
  })
})
