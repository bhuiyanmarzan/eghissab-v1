import { useTranslation } from 'react-i18next';
import { Badge } from '../ui/primitives';
import { Logo } from '../layout/Logo';
import {
  invoiceMoney,
  invoiceTotals,
  itemAmount,
  type InvoiceAddress,
  type InvoiceValues,
} from '../../lib/invoice';
import { formatDate, isBangla, translateNode } from '../../lib/localization';

function Address({ title, address }: { title: string; address: InvoiceAddress | null }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold">{translateNode(title)}</h3>
      {address && (
        <div className="text-sm leading-6">
          <p className="font-medium">{address.name}</p>
          <p className="whitespace-pre-line text-muted">{address.address}</p>
          <p className="text-muted">{address.phone}</p>
          <p className="break-all text-muted">{address.email}</p>
        </div>
      )}
    </div>
  );
}
export function InvoiceDocument({ invoice }: { invoice: InvoiceValues }) {
  useTranslation();
  const money = (value: number) =>
    invoiceMoney(value, invoice.currency, isBangla() ? 'bn-BD' : 'en-US');
  const totals = invoiceTotals(invoice);
  const date = (value: string) =>
    formatDate(new Date(`${value}T12:00:00`), {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  return (
    <div className="invoice-document">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Logo />
        <div className="text-end">
          <h2 className="text-xl font-semibold">
            {translateNode('Invoice')} #{invoice.id}
          </h2>
          <div className="mt-2">
            <Badge
              tone={
                invoice.status === 'Paid'
                  ? 'green'
                  : invoice.status === 'Cancelled'
                    ? 'red'
                    : 'amber'
              }
            >
              {invoice.status}
            </Badge>
          </div>
        </div>
      </div>
      <div className="my-6 grid gap-6 border-y border-border py-6 sm:grid-cols-3">
        <Address title="From:" address={invoice.sender} />
        <Address title="To:" address={invoice.recipient} />
        <div className="text-sm">
          <p className="text-muted">{translateNode('Date')}</p>
          <p className="mt-1 font-medium">{date(invoice.date)}</p>
          <p className="mt-4 text-muted">{translateNode('Due Date')}</p>
          <p className="mt-1 font-medium">{date(invoice.dueDate)}</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              {['#', 'Name', 'Description', 'Qty', 'Price', 'Amount'].map((label) => (
                <th key={label}>{translateNode(label)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, index) => (
              <tr key={index}>
                <td>{translateNode(index + 1)}</td>
                <td>{item.name}</td>
                <td>{item.description}</td>
                <td>{translateNode(item.quantity)}</td>
                <td className="whitespace-nowrap">{money(item.price)}</td>
                <td className="whitespace-nowrap">{money(itemAmount(item))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="ms-auto mt-6 max-w-sm space-y-3 text-sm">
        {[
          ['Sub Total:', totals.subtotal],
          ['Discount:', totals.discount],
          ['Tax:', totals.tax],
          ['Grand Total:', totals.total],
        ].map(([label, value], index) => (
          <div
            key={String(label)}
            className={`flex justify-between gap-3 ${index === 3 ? 'border-t border-border pt-3 font-semibold' : 'text-muted'}`}
          >
            <dt>
              {translateNode(label)}
              {index === 1 ? ` (${invoice.discount}%)` : index === 2 ? ` (${invoice.tax}%)` : ''}
            </dt>
            <dd>{money(Number(value))}</dd>
          </div>
        ))}
      </dl>
      {invoice.notes && (
        <div className="mt-8 border-t border-border pt-5">
          <h3 className="text-sm font-semibold">{translateNode('Notes')}</h3>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted">
            {invoice.notes}
          </p>
        </div>
      )}
    </div>
  );
}
