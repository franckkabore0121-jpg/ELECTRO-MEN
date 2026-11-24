import { Product, getProductStockStatus, getStockStatusLabel } from '../data/mockData.ts';

export interface ProductXlsxExportOptions {
  sheetName?: string;
  filename?: string;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function encodeUtf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function escapeXml(value: string): string {
  // Strip invalid XML 1.0 control characters before escaping entities
  const clean = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '');
  return clean
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toColumnLetter(indexZeroBased: number): string {
  let n = indexZeroBased + 1;
  let result = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

function sanitizeSheetName(raw: string): string {
  const cleaned = raw.replace(/[\\/*?:[\]]/g, ' ').trim();
  return (cleaned || 'Catalogue Produits').slice(0, 31);
}

function formatBoutiqueName(domain?: string): string {
  switch (domain) {
    case 'electronique':
      return 'Boutique Composants Électroniques';
    case 'electrotechnique':
      return 'Boutique Électrotechnique & Puissance';
    case 'informatique':
      return 'Boutique Équipements Informatiques';
    default:
      return 'ELECTRO-MEN';
  }
}

function formatCharacteristics(product: Product): string {
  const specs = Array.isArray(product.specs)
    ? product.specs.map((item) => item.trim()).filter(Boolean)
    : [];
  const details = Array.isArray(product.details)
    ? product.details.map((item) => item.trim()).filter(Boolean)
    : [];
  const combined = Array.from(new Set([...specs, ...details]));
  return combined.join(' | ');
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

function buildStoredZip(entries: ZipEntry[]): Uint8Array {
  const now = new Date();
  const dosTime = ((now.getHours() & 0x1f) << 11) | ((now.getMinutes() & 0x3f) << 5) | ((now.getSeconds() >> 1) & 0x1f);
  const dosDate =
    (((Math.max(1980, now.getFullYear()) - 1980) & 0x7f) << 9) |
    (((now.getMonth() + 1) & 0x0f) << 5) |
    (now.getDate() & 0x1f);

  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encodeUtf8(entry.name);
    const data = entry.data;
    const checksum = crc32(data);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true); // Local file header signature
    lv.setUint16(4, 20, true); // Version needed to extract (2.0)
    lv.setUint16(6, 0x0800, true); // UTF-8 filename flag
    lv.setUint16(8, 0, true); // Compression method 0 (stored)
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, checksum, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true); // Central directory header signature
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, checksum, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + data.length;
  }

  const centralSize = centralParts.reduce((acc, part) => acc + part.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true); // End of central directory signature
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const totalSize = offset + centralSize + eocd.length;
  const archive = new Uint8Array(totalSize);
  let cursor = 0;
  for (const part of localParts) {
    archive.set(part, cursor);
    cursor += part.length;
  }
  for (const part of centralParts) {
    archive.set(part, cursor);
    cursor += part.length;
  }
  archive.set(eocd, cursor);
  return archive;
}

export function buildProductsXlsxBytes(
  productsToExport: Product[],
  options: ProductXlsxExportOptions = {}
): Uint8Array {
  const sheetName = sanitizeSheetName(options.sheetName || 'Catalogue Produits');

  const headers = [
    'N°',
    'Référence',
    'Nom du produit',
    'Boutique',
    'Catégorie',
    'Marque',
    'Description',
    'Caractéristiques techniques',
    'Prix (FCFA)',
    'Disponibilité',
    'Quantité en stock'
  ];

  type CellValue = string | number;
  const rows: CellValue[][] = productsToExport.map((product, index) => {
    const stockStatus = getProductStockStatus(product);
    const availabilityLabel = getStockStatusLabel(stockStatus);
    const categoryText = product.subGroupLabel || product.categoryLabel || product.category || 'Général';
    const price = Number.isFinite(Number(product.price)) ? Math.max(0, Math.round(Number(product.price))) : 0;
    const stockQty = stockStatus === 'out_of_stock'
      ? 0
      : Number.isFinite(Number(product.stock))
      ? Math.max(0, Math.round(Number(product.stock)))
      : 0;

    return [
      index + 1,
      product.ref || '',
      product.name || '',
      formatBoutiqueName(product.domain),
      categoryText,
      product.brand || 'ELECTRO-MEN',
      product.description || '',
      formatCharacteristics(product),
      price,
      availabilityLabel,
      stockQty
    ];
  });

  // Compute clean column widths based on header + cell content length
  const minWidths = [6, 16, 32, 32, 24, 16, 44, 42, 16, 22, 18];
  const maxWidths = [8, 24, 48, 36, 32, 24, 60, 56, 20, 26, 20];
  const colWidths = headers.map((header, colIdx) => {
    let widest = header.length;
    for (const row of rows) {
      const val = row[colIdx];
      const len = typeof val === 'number'
        ? val.toLocaleString('fr-FR').length
        : String(val).split('\n').reduce((m, line) => Math.max(m, line.length), 0);
      if (len > widest) widest = len;
    }
    return Math.min(maxWidths[colIdx], Math.max(minWidths[colIdx], widest + 4));
  });

  const colsXml = colWidths
    .map((width, idx) => `<col min="${idx + 1}" max="${idx + 1}" width="${width}" customWidth="1"/>`)
    .join('');

  const lastColLetter = toColumnLetter(headers.length - 1);
  const lastRowNumber = rows.length + 1;

  // Styles:
  // 0: default body text (wrapText)
  // 1: header cell (bold white on dark slate #0F172A + thin border)
  // 2: body numeric integer #,##0 (right-aligned + thin border)
  // 3: body text (wrapText + thin border)
  // 4: centered index / status (thin border)
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1">
    <numFmt numFmtId="164" formatCode="#,##0"/>
  </numFmts>
  <fonts count="2">
    <font><sz val="10"/><color rgb="FF0F172A"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0F172A"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFCBD5E1"/></left>
      <right style="thin"><color rgb="FFCBD5E1"/></right>
      <top style="thin"><color rgb="FFCBD5E1"/></top>
      <bottom style="thin"><color rgb="FFCBD5E1"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="5">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
    </xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center"/>
    </xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1">
      <alignment horizontal="left" vertical="center" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>`;

  const headerCellsXml = headers
    .map((label, colIdx) => {
      const ref = `${toColumnLetter(colIdx)}1`;
      return `<c r="${ref}" t="inlineStr" s="1"><is><t xml:space="preserve">${escapeXml(label)}</t></is></c>`;
    })
    .join('');

  const bodyRowsXml = rows
    .map((row, rowIdx) => {
      const rowNum = rowIdx + 2;
      const cells = row
        .map((val, colIdx) => {
          const ref = `${toColumnLetter(colIdx)}${rowNum}`;
          if (typeof val === 'number') {
            const styleId = colIdx === 0 ? 4 : 2;
            return `<c r="${ref}" s="${styleId}"><v>${val}</v></c>`;
          }
          const styleId = colIdx === 9 ? 4 : 3;
          return `<c r="${ref}" t="inlineStr" s="${styleId}"><is><t xml:space="preserve">${escapeXml(val)}</t></is></c>`;
        })
        .join('');
      return `<row r="${rowNum}" ht="24" customHeight="0">${cells}</row>`;
    })
    .join('');

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews>
    <sheetView workbookViewId="0">
      <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="20"/>
  <cols>${colsXml}</cols>
  <sheetData>
    <row r="1" ht="28" customHeight="1">${headerCellsXml}</row>
    ${bodyRowsXml}
  </sheetData>
  <autoFilter ref="A1:${lastColLetter}${lastRowNumber}"/>
</worksheet>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  return buildStoredZip([
    { name: '[Content_Types].xml', data: encodeUtf8(contentTypesXml) },
    { name: '_rels/.rels', data: encodeUtf8(rootRelsXml) },
    { name: 'xl/workbook.xml', data: encodeUtf8(workbookXml) },
    { name: 'xl/_rels/workbook.xml.rels', data: encodeUtf8(workbookRelsXml) },
    { name: 'xl/styles.xml', data: encodeUtf8(stylesXml) },
    { name: 'xl/worksheets/sheet1.xml', data: encodeUtf8(sheetXml) }
  ]);
}

export function exportProductsToXlsx(
  productsToExport: Product[],
  options: ProductXlsxExportOptions = {}
): void {
  const bytes = buildProductsXlsxBytes(productsToExport, options);
  const blobBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const blob = new Blob([blobBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const today = new Date().toISOString().slice(0, 10);
  const filename = options.filename || `ELECTRO-MEN_Catalogue_${today}.xlsx`;
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
