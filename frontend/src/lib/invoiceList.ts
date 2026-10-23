import { invoiceTotals, type InvoiceValues } from './invoice';
export const invoiceQuantity = (invoice: InvoiceValues) =>
  invoice.items.reduce((total, item) => total + item.quantity, 0);
export function invoiceBalance(invoices: InvoiceValues[]) {
  const amounts: Partial<Record<InvoiceValues['currency'], number>> = {};
  invoices.forEach((invoice) => {
    amounts[invoice.currency] =
      Math.round(((amounts[invoice.currency] ?? 0) + invoiceTotals(invoice).total) * 100) / 100;
  });
  return Object.entries(amounts).length
    ? Object.entries(amounts)
    : [['USD', 0] as [string, number]];
}
export const invoiceOverdue = (invoice: InvoiceValues, date: string) =>
  invoice.status === 'Unpaid' && invoice.dueDate < date;
const csvCell = (value: string | number) => {
  const text = String(value);
  return `"${(/^[=+\-@\t\r]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`;
};
export function invoiceCsv(invoices: InvoiceValues[]) {
  return (
    '\uFEFF' +
    [
      [
        'Invoice Id',
        'Name',
        'Email',
        'Create Date',
        'Due Date',
        'Quantity',
        'Status',
        'Amount',
        'Currency',
      ],
      ...invoices.map((invoice) => [
        invoice.id,
        invoice.recipient?.name ?? '',
        invoice.recipient?.email ?? '',
        invoice.date,
        invoice.dueDate,
        invoiceQuantity(invoice),
        invoice.status,
        invoiceTotals(invoice).total.toFixed(2),
        invoice.currency,
      ]),
    ]
      .map((row) => row.map(csvCell).join(','))
      .join('\r\n')
  );
}
