import { invoiceAddresses, type InvoiceValues } from '../lib/invoice';

// Reference demonstration records, reused until this project has an invoice API.
export const initialInvoiceRecords: InvoiceValues[] = [
  ['2', 'Abey Boseley', 'aabsl32@gmail.com', '2022-07-15', '2022-02-15', 2030, 'Unpaid'],
  ['5', 'Mickie Melmoth', 'mmsht23@gmail.com', '2022-05-05', '2022-07-11', 3000, 'Paid'],
  ['4', 'Salvatore Boncore', 'sabf231@gmail.com', '2022-02-08', '2022-03-30', 2000, 'Unpaid'],
  ['3', 'Shelba Thews', 'slbt37@gmail.com', '2022-07-06', '2022-07-08', 3000, 'Cancelled'],
  ['1', 'Tessi Eneas', 'tass23@gmail.com', '2022-05-01', '2022-06-02', 1000, 'Paid'],
].map(([id, name, email, date, dueDate, quantity, status]) => ({
  id: String(id),
  status: status as InvoiceValues['status'],
  date: String(date),
  dueDate: String(dueDate),
  sender: { ...invoiceAddresses[1] },
  recipient: {
    ...invoiceAddresses[0],
    id: `recipient-${id}`,
    name: String(name),
    email: String(email),
  },
  items: [{ name: 'Invoice services', description: '', quantity: Number(quantity), price: 1 }],
  discount: 0,
  tax: 0,
  notes: '',
  currency: 'USD',
}));
