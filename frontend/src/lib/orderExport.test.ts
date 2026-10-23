import { describe, expect, it } from 'vitest';
import { ordersCsv, ordersWorkbook } from './orderExport';
const row = {
  id: '13256498',
  product: 'Keyboard',
  quantity: 125,
  status: 'Rejected' as const,
  amount: 70999,
};
describe('Order export', () => {
  it('exports the chosen orders with CSV escaping and formula neutralization', () => {
    const csv = ordersCsv([{ ...row, product: '=SUM(1,2) "name"' }]);
    expect(csv).toContain('"\'=SUM(1,2) ""name"""');
    expect(csv).toContain('"70999"');
    expect(csv.split('\r\n')).toHaveLength(2);
  });
  it('creates an OOXML ZIP package with preserved tracking ids, numbers and escaped strings', () => {
    const workbook = ordersWorkbook([{ ...row, product: '<Keyboard> & "mouse"' }]);
    expect(Array.from(workbook.slice(0, 4))).toEqual([80, 75, 3, 4]);
    const text = new TextDecoder().decode(workbook);
    expect(text).toContain('xl/worksheets/sheet1.xml');
    expect(text).toContain('<v>70999</v>');
    expect(text).toContain('<t xml:space="preserve">13256498</t>');
    expect(text).toContain('&lt;Keyboard&gt; &amp; &quot;mouse&quot;');
    expect(text).not.toContain('<f>');
  });
  it('supports empty workbooks with only headers', () => {
    const text = new TextDecoder().decode(ordersWorkbook([]));
    expect(text).toContain('Total Amount');
    expect(text).not.toContain('<row r="2">');
  });
});
