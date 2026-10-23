import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import * as Dialog from '@radix-ui/react-dialog';
import { Ellipsis, Printer, X } from 'lucide-react';
import { getOrders, type Order } from '../../api/client';
import { Button, Card, Skeleton } from '../ui/primitives';
import { downloadOrders } from '../../lib/orderExport';
import { translateNode as t, translateString as ts } from '../../lib/localization';
function OrdersTable({
  rows,
  selected,
  onSelect,
}: {
  rows: Order[];
  selected?: string[];
  onSelect?: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table
        className="default-orders-table w-full"
        aria-label={ts(onSelect ? 'Recent Orders' : 'Order print preview')}
      >
        <thead>
          <tr>
            {['Tracking no.', 'Product name', 'Total order', 'Status', 'Total amount'].map(
              (label) => (
                <th key={label} scope="col">
                  {t(label)}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              tabIndex={onSelect ? 0 : undefined}
              aria-selected={onSelect ? selected?.includes(row.id) : undefined}
              className={selected?.includes(row.id) ? 'default-order-selected' : ''}
              onClick={() => onSelect?.(row.id)}
              onKeyDown={(e) => {
                if (onSelect && (e.key === ' ' || e.key === 'Enter')) {
                  e.preventDefault();
                  onSelect(row.id);
                }
              }}
            >
              <td>
                {onSelect && (
                  <input
                    type="checkbox"
                    className="sr-only"
                    tabIndex={-1}
                    aria-label={ts('Select order') + ' ' + row.id}
                    checked={selected?.includes(row.id) ?? false}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => onSelect(row.id)}
                  />
                )}{' '}
                {row.id}
              </td>
              <td>{row.product}</td>
              <td>{t(row.quantity)}</td>
              <td>
                <span className="inline-flex items-center gap-2">
                  <i
                    className={
                      'size-2 rounded-full ' +
                      (row.status === 'Approved'
                        ? 'bg-success'
                        : row.status === 'Pending'
                          ? 'bg-warning'
                          : 'bg-danger')
                    }
                  />
                  {t(row.status)}
                </span>
              </td>
              <td className="text-end">{t('$' + row.amount.toLocaleString('en-US'))}</td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={5} className="text-center text-muted">
                {t('No recent orders')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
export function RecentOrders() {
  const query = useQuery({ queryKey: ['orders'], queryFn: getOrders, retry: 1 });
  const [selected, setSelected] = useState<string[]>([]);
  const [print, setPrint] = useState(false);
  const rows = query.data ?? [];
  const selectedRows = rows.filter((r) => selected.includes(r.id));
  const exportRows = selectedRows.length ? selectedRows : rows;
  return (
    <section>
      <div className="mb-3 flex h-9 items-center justify-between">
        <h2 className="text-base font-semibold">{t('Recent Orders')}</h2>
        <Dropdown.Root>
          <Dropdown.Trigger asChild>
            <Button variant="ghost" size="icon" aria-label={ts('Recent Orders actions')}>
              <Ellipsis className="size-4" />
            </Button>
          </Dropdown.Trigger>
          <Dropdown.Portal>
            <Dropdown.Content
              align="end"
              className="z-50 min-w-44 rounded-md border border-border bg-surface p-1 text-sm text-ink shadow-lg"
            >
              {(['csv', 'xlsx', 'print'] as const).map((format) => (
                <Dropdown.Item
                  key={format}
                  disabled={!exportRows.length}
                  onSelect={() => {
                    if (format === 'print') setPrint(true);
                    else downloadOrders(exportRows, format);
                  }}
                  className="cursor-pointer rounded px-3 py-2 outline-none data-[highlighted]:bg-subtle data-[disabled]:opacity-40"
                >
                  {t(
                    format === 'csv'
                      ? 'Export as CSV'
                      : format === 'xlsx'
                        ? 'Export as Excel'
                        : 'Print Table',
                  )}
                </Dropdown.Item>
              ))}
            </Dropdown.Content>
          </Dropdown.Portal>
        </Dropdown.Root>
      </div>
      <Card>
        {query.isLoading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-7" />
            ))}
          </div>
        ) : query.isError && !query.data ? (
          <div className="p-5">
            <p role="alert" className="text-sm text-danger">
              {t('Unable to load recent orders.')}
            </p>
            <Button
              className="mt-3"
              variant="outline"
              size="sm"
              onClick={() => void query.refetch()}
            >
              {t('Retry')}
            </Button>
          </div>
        ) : (
          <>
            <OrdersTable
              rows={rows}
              selected={selected}
              onSelect={(id) =>
                setSelected((current) =>
                  current.includes(id) ? current.filter((v) => v !== id) : [...current, id],
                )
              }
            />
            {selectedRows.length > 0 && (
              <div className="flex justify-between gap-3 border-t border-border px-4 py-2 text-xs text-primary">
                <span>
                  {t(selectedRows.length)} {t('order(s) selected')}
                </span>
                <button onClick={() => setSelected([])}>{t('Clear selection')}</button>
              </div>
            )}
          </>
        )}
      </Card>
      <Dialog.Root open={print} onOpenChange={setPrint}>
        <Dialog.Portal>
          <Dialog.Overlay className="default-print-overlay fixed inset-0 z-[80] bg-black/40" />
          <Dialog.Content
            aria-describedby={undefined}
            className="default-order-print fixed left-1/2 top-1/2 z-[90] max-h-[90dvh] w-[900px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-lg bg-surface p-6 text-ink shadow-xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <Dialog.Title className="text-xl font-semibold">{t('Recent Orders')}</Dialog.Title>
              <div className="default-print-controls flex gap-2">
                <Button onClick={() => window.print()}>
                  <Printer className="size-4" />
                  {t('Print')}
                </Button>
                <Dialog.Close asChild>
                  <Button variant="ghost" size="icon" aria-label={ts('Close dialog')}>
                    <X className="size-4" />
                  </Button>
                </Dialog.Close>
              </div>
            </div>
            <OrdersTable rows={exportRows} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
