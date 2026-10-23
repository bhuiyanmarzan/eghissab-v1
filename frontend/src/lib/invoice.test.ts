import { describe, expect, it } from 'vitest';
import { invoiceEmail, invoiceMoney, invoiceSchema, invoiceTotals, newInvoice } from './invoice';

describe('invoice calculations and validation', () => {
  it('rounds line amounts and applies tax and discount to the reference subtotal', () => {
    expect(
      invoiceTotals({
        items: [
          { name: 'Design', description: '', quantity: 2, price: 19.99 },
          { name: 'Review', description: '', quantity: 3, price: 5 },
        ],
        discount: 10,
        tax: 20,
      }),
    ).toEqual({ subtotal: 54.98, discount: 5.5, tax: 11, total: 60.48 });
  });
  it('keeps totals finite while number fields are empty', () => {
    expect(
      invoiceTotals({
        items: [{ name: '', description: '', quantity: NaN, price: 100 }],
        discount: NaN,
        tax: NaN,
      }).total,
    ).toBe(0);
  });
  it('rejects invalid dates, negative prices, excessive percentages and empty recipients', () => {
    const invoice = newInvoice();
    invoice.status = 'Paid';
    invoice.date = '2026-02-30';
    invoice.dueDate = '2026-02-20';
    invoice.discount = 101;
    invoice.items[0].price = -1;
    const result = invoiceSchema.safeParse(invoice);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues.map((issue) => issue.path.join('.'))).toEqual(
        expect.arrayContaining(['date', 'discount', 'items.0.price', 'recipient']),
      );
    invoice.date = '2026-03-01';
    const dates = invoiceSchema.safeParse(invoice);
    if (!dates.success)
      expect(dates.error.issues.map((issue) => issue.message)).toContain(
        'Due date cannot be before the invoice date',
      );
  });
  it('formats the selected currency and safely encodes the email draft', () => {
    const invoice = newInvoice();
    invoice.sender.name = 'A & B';
    invoice.notes = 'Review & approve #1';
    invoice.recipient = { ...invoice.sender, email: 'client@example.com' };
    expect(invoiceMoney(123, 'GBP')).toBe('£123.00');
    const link = new URL(invoiceEmail(invoice));
    expect(link.protocol).toBe('mailto:');
    expect(link.searchParams.get('subject')).toContain('A & B');
    expect(link.searchParams.get('body')).toContain('Review & approve #1');
  });
});
