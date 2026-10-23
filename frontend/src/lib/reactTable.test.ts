import { describe, expect, it } from 'vitest';
import { makeReactTableRows } from '../data/reactTableRows';
import { reorderIds, tableCsv, tableRowSchema, virtualWindow } from './reactTable';
describe('React Table helpers', () => {
  it('reorders without changing stable ids or losing rows', () => {
    expect(reorderIds(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'c', 'a']);
    expect(reorderIds(['a', 'b'], 'missing', 'b')).toEqual(['a', 'b']);
  });
  it('limits the virtual window at the beginning, middle and end of 10000 rows', () => {
    expect(virtualWindow(0, 10000)).toMatchObject({ start: 0, end: 18 });
    const mid = virtualWindow(200000, 10000);
    expect(mid.end - mid.start).toBe(18);
    expect(mid.start).toBeGreaterThan(3000);
    const end = virtualWindow(1000000, 10000);
    expect(end.end).toBe(10000);
    expect(end.start).toBe(9999);
    expect(virtualWindow(1000, 0)).toEqual({ start: 0, end: 0, top: 0, bottom: 0 });
  });
  it('exports visible fields in their chosen order and escapes user-authored CSV values', () => {
    const row = makeReactTableRows()[0];
    row.name = '=SUM(1,2)';
    row.email = 'a"b@example.com';
    const csv = tableCsv([row], ['email', 'name']);
    expect(csv).toContain('"email","name"');
    expect(csv).toContain('"a""b@example.com","\'=SUM(1,2)"');
    expect(csv).not.toContain('age');
  });
  it('provides isolated, validated demo records for each tenant', () => {
    const a = makeReactTableRows('acme'),
      b = makeReactTableRows('globex');
    expect(a).toHaveLength(100);
    expect(tableRowSchema.safeParse(a[0]).success).toBe(true);
    expect(a[0].id).not.toBe(b[0].id);
    expect(a[0].children).toHaveLength(2);
  });
});
