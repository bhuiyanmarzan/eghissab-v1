import type { Order } from '../api/client';
const headings = ['Tracking No.', 'Product Name', 'Total Order', 'Status', 'Total Amount'];
const fields = (r: Order) => [r.id, r.product, r.quantity, r.status, r.amount];
export function ordersCsv(rows: Order[]) {
  const quote = (v: string | number) => {
    const s = String(v);
    return '"' + (/^\s*[=+\-@]/.test(s) ? "'" + s : s).replaceAll('"', '""') + '"';
  };
  return '\uFEFF' + [headings, ...rows.map(fields)].map((r) => r.map(quote).join(',')).join('\r\n');
}
// Small, standards-based OOXML workbook with inline strings; no formula cells.
export function ordersWorkbook(rows: Order[]): Uint8Array {
  const encode = new TextEncoder();
  const xml = (s: string) =>
    s
      .replace(
        /[<>&"']/g,
        (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!,
      )
      .split('')
      .filter((c) => c.charCodeAt(0) >= 32 || [9, 10, 13].includes(c.charCodeAt(0)))
      .join('');
  const sheet = [headings, ...rows.map(fields)]
    .map(
      (row, index) =>
        `<row r="${index + 1}">${row.map((v, col) => `<c r="${String.fromCharCode(65 + col)}${index + 1}" ${typeof v === 'number' ? '' : 't="inlineStr"'}>${typeof v === 'number' ? `<v>${v}</v>` : `<is><t xml:space="preserve">${xml(v)}</t></is>`}</c>`).join('')}</row>`,
    )
    .join('');
  const files: Record<string, string> = {
    '[Content_Types].xml':
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels':
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml':
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Recent Orders" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="18" customWidth="1"/><col min="2" max="2" width="32" customWidth="1"/><col min="3" max="5" width="20" customWidth="1"/></cols><sheetData>${sheet}</sheetData></worksheet>`,
  };
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const crc = (bytes: Uint8Array) => {
    let value = 0xffffffff;
    for (const byte of bytes) {
      value ^= byte;
      for (let i = 0; i < 8; i++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
    }
    return (value ^ 0xffffffff) >>> 0;
  };
  for (const [name, content] of Object.entries(files)) {
    const n = encode.encode(name),
      data = encode.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + content);
    const checksum = crc(data);
    const header = new Uint8Array(30 + n.length);
    const h = new DataView(header.buffer);
    h.setUint32(0, 0x04034b50, true);
    h.setUint16(4, 20, true);
    h.setUint32(14, checksum, true);
    h.setUint32(18, data.length, true);
    h.setUint32(22, data.length, true);
    h.setUint16(26, n.length, true);
    header.set(n, 30);
    local.push(header, data);
    const entry = new Uint8Array(46 + n.length);
    const c = new DataView(entry.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint32(16, checksum, true);
    c.setUint32(20, data.length, true);
    c.setUint32(24, data.length, true);
    c.setUint16(28, n.length, true);
    c.setUint32(42, offset, true);
    entry.set(n, 46);
    central.push(entry);
    offset += header.length + data.length;
  }
  const size = central.reduce((sum, p) => sum + p.length, 0);
  const end = new Uint8Array(22);
  const e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, central.length, true);
  e.setUint16(10, central.length, true);
  e.setUint32(12, size, true);
  e.setUint32(16, offset, true);
  const result = new Uint8Array(offset + size + 22);
  let position = 0;
  for (const chunk of [...local, ...central, end]) {
    result.set(chunk, position);
    position += chunk.length;
  }
  return result;
}
export function downloadOrders(rows: Order[], format: 'csv' | 'xlsx') {
  const content = format === 'csv' ? ordersCsv(rows) : ordersWorkbook(rows);
  const blob = new Blob([typeof content === 'string' ? content : new Uint8Array(content).buffer], {
    type:
      format === 'csv'
        ? 'text/csv;charset=utf-8'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `recent-orders.${format}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
