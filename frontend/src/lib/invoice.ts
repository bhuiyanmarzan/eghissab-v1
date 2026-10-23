import { z } from 'zod';

export const addressSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1, 'Name is required').max(120, 'Use at most 120 characters'),
  address: z.string().trim().min(1, 'Address is required').max(500, 'Use at most 500 characters'),
  phone: z.string().trim().min(1, 'Phone is required').max(50, 'Use at most 50 characters'),
  email: z.email('Enter a valid email'),
});
export type InvoiceAddress = z.infer<typeof addressSchema>;
export const invoiceCurrencies = [
  { code: 'USD', name: 'United States Dollar', flag: '🇺🇸' },
  { code: 'GBP', name: 'United Kingdom Pound', flag: '🇬🇧' },
  { code: 'INR', name: 'India Rupee', flag: '🇮🇳' },
  { code: 'JPY', name: 'Japan Yen', flag: '🇯🇵' },
] as const;
const validDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
export const invoiceSchema = z
  .object({
    id: z.string().min(1),
    status: z
      .enum(['', 'Paid', 'Unpaid', 'Cancelled'])
      .refine((value): boolean => value !== '', 'Select a status'),
    date: z.string().refine(validDate, 'Select a valid invoice date'),
    dueDate: z.string().refine(validDate, 'Select a valid due date'),
    sender: addressSchema,
    recipient: addressSchema
      .nullable()
      .refine((value): boolean => value !== null, 'Select a recipient'),
    items: z
      .array(
        z.object({
          name: z
            .string()
            .trim()
            .min(1, 'Item name is required')
            .max(120, 'Use at most 120 characters'),
          description: z.string().max(500, 'Use at most 500 characters'),
          quantity: z
            .number({ error: 'Enter a valid quantity' })
            .int('Quantity must be a whole number')
            .min(1, 'Quantity must be at least 1')
            .max(1000000, 'Quantity is too large'),
          price: z
            .number({ error: 'Enter a valid price' })
            .min(0, 'Price cannot be negative')
            .max(1000000, 'Price is too large'),
        }),
      )
      .min(1, 'Add at least one item'),
    discount: z
      .number({ error: 'Enter a valid discount' })
      .min(0, 'Enter a percentage from 0 to 100')
      .max(100, 'Enter a percentage from 0 to 100'),
    tax: z
      .number({ error: 'Enter a valid tax' })
      .min(0, 'Enter a percentage from 0 to 100')
      .max(100, 'Enter a percentage from 0 to 100'),
    notes: z.string().max(500, 'Use at most 500 characters'),
    currency: z.enum(['USD', 'GBP', 'INR', 'JPY']),
  })
  .refine(
    (value) => !validDate(value.date) || !validDate(value.dueDate) || value.dueDate >= value.date,
    {
      message: 'Due date cannot be before the invoice date',
      path: ['dueDate'],
    },
  );
export type InvoiceValues = z.infer<typeof invoiceSchema>;
export type InvoiceItem = InvoiceValues['items'][number];
export const invoiceAddresses: InvoiceAddress[] = [
  {
    id: 'ian',
    name: 'Ian Carpenter',
    address: '1754 Ureate, RhodSA5 5BO',
    phone: '+91 1234567890',
    email: 'iacrpt65@gmail.com',
  },
  {
    id: 'belle',
    name: 'Belle J. Richter',
    address: '1300 Cooks Mine, NM 87829',
    phone: '305-829-7809',
    email: 'belljrc23@gmail.com',
  },
  {
    id: 'ritika',
    name: 'Ritika Yohannan',
    address: '3488 Arbutus DriveMiami, FL',
    phone: '+91 1234567890',
    email: 'rtyhn65@gmail.com',
  },
  {
    id: 'jesse',
    name: 'Jesse G. Hassen',
    address: '3488 Arbutus DriveMiami, FL 33012',
    phone: '+91 1234567890',
    email: 'jessghs78@gmail.com',
  },
  {
    id: 'christopher',
    name: 'Christopher P. Iacovelli',
    address: '4388 House DriveWestville, OH',
    phone: '+91 1234567890',
    email: 'crpthl643@gmail.com',
  },
  {
    id: 'thomas',
    name: 'Thomas D. Johnson',
    address: '4388 House DriveWestville, OH',
    phone: '+91 1234567890',
    email: 'thomshj56@gmail.com',
  },
];
export const emptyInvoiceItem = (): InvoiceItem => ({
  name: '',
  description: '',
  quantity: 1,
  price: 1,
});
export function newInvoice(): InvoiceValues {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return {
    id: String(Date.now()),
    status: '',
    date,
    dueDate: '',
    sender: { ...invoiceAddresses[1] },
    recipient: null,
    items: [emptyInvoiceItem()],
    discount: 0,
    tax: 0,
    notes: '',
    currency: 'USD',
  };
}
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const nonnegative = (value: number) => (Number.isFinite(value) ? Math.max(0, value) : 0);
export const itemAmount = (item: InvoiceItem) =>
  round(nonnegative(item.quantity) * nonnegative(item.price));
export function invoiceTotals(invoice: Pick<InvoiceValues, 'items' | 'discount' | 'tax'>) {
  const subtotal = round(invoice.items.reduce((sum, item) => sum + itemAmount(item), 0));
  const discount = round((subtotal * Math.min(100, nonnegative(invoice.discount))) / 100);
  // The reference applies both percentage adjustments to the subtotal.
  const tax = round((subtotal * Math.min(100, nonnegative(invoice.tax))) / 100);
  return { subtotal, discount, tax, total: round(subtotal - discount + tax) };
}
export function invoiceMoney(value: number, currency: string, locale = 'en-US') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
export function invoiceEmail(invoice: InvoiceValues) {
  const money = (value: number) => invoiceMoney(value, invoice.currency);
  const totals = invoiceTotals(invoice);
  const body = [
    `Invoice #${invoice.id}`,
    `From: ${invoice.sender.name}`,
    invoice.sender.address,
    `To: ${invoice.recipient?.name ?? ''}`,
    `Date: ${invoice.date}`,
    `Due Date: ${invoice.dueDate}`,
    `Status: ${invoice.status}`,
    '',
    ...invoice.items.map(
      (item) =>
        `${item.name}${item.description ? ` — ${item.description}` : ''}: ${item.quantity} × ${money(item.price)} = ${money(itemAmount(item))}`,
    ),
    '',
    `Sub Total: ${money(totals.subtotal)}`,
    `Discount (${invoice.discount}%): ${money(totals.discount)}`,
    `Tax (${invoice.tax}%): ${money(totals.tax)}`,
    `Grand Total: ${money(totals.total)}`,
    ...(invoice.notes ? ['', `Notes: ${invoice.notes}`] : []),
  ].join('\n');
  return `mailto:${encodeURIComponent(invoice.recipient?.email ?? '')}?subject=${encodeURIComponent(`Invoice #${invoice.id} from ${invoice.sender.name}`)}&body=${encodeURIComponent(body)}`;
}
