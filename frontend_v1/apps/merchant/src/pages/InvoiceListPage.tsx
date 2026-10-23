import { useEffect, useMemo, useRef, useState, type InputHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
} from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Eye,
  FileCheck2,
  Info,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { Avatar, Badge, Button, Card, Input, Select } from '../components/ui/primitives';
import { formatDate, isBangla, translateNode, translateString } from '../lib/localization';
import type { InvoiceValues } from '../lib/invoice';
import { invoiceBalance, invoiceCsv, invoiceOverdue, invoiceQuantity } from '../lib/invoiceList';
import { invoiceRecords, useInvoiceStore } from '../store/useInvoiceStore';
import { useTenantStore, type TenantId } from '../store/useTenantStore';

function Checkbox({
  mixed,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { mixed?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(mixed);
  }, [mixed]);
  return (
    <input ref={ref} type="checkbox" className="size-4 cursor-pointer accent-primary" {...props} />
  );
}
function Balances({ invoices, className = '' }: { invoices: InvoiceValues[]; className?: string }) {
  return (
    <span className={className}>
      {invoiceBalance(invoices).map(([currency, amount]) => (
        <span className="block" key={currency}>
          {new Intl.NumberFormat(isBangla() ? 'bn-BD' : 'en-US', {
            style: 'currency',
            currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
          }).format(Number(amount))}
        </span>
      ))}
    </span>
  );
}
function InvoiceList({ tenant }: { tenant: TenantId }) {
  useTranslation();
  const records = useInvoiceStore((state) => state.records[tenant]);
  const draft = useInvoiceStore((state) => state.drafts[tenant]);
  const deleted = useInvoiceStore((state) => state.deleted[tenant]);
  const deleteInvoice = useInvoiceStore((state) => state.deleteInvoice);
  const restoreInvoice = useInvoiceStore((state) => state.restoreInvoice);
  const data = useMemo(
    () => invoiceRecords({ records: { [tenant]: records }, drafts: { [tenant]: draft } }, tenant),
    [tenant, records, draft],
  );
  const [status, setStatus] = useState('All');
  const [search, setSearch] = useState('');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'user', desc: false }]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [deleting, setDeleting] = useState<InvoiceValues | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const columns = useMemo<ColumnDef<InvoiceValues>[]>(
    () => [
      {
        id: 'select',
        enableSorting: false,
        enableGlobalFilter: false,
        header: ({ table }) => (
          <Checkbox
            aria-label={translateString('Select all invoices on this page')}
            checked={table.getIsAllPageRowsSelected()}
            mixed={table.getIsSomePageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label={translateString('Select invoice') + ` ${row.original.id}`}
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
          />
        ),
      },
      {
        accessorKey: 'id',
        header: 'Invoice Id',
        sortingFn: (a, b) =>
          a.original.id.localeCompare(b.original.id, undefined, { numeric: true }),
      },
      {
        id: 'user',
        accessorFn: (invoice) =>
          `${invoice.recipient?.name ?? ''} ${invoice.recipient?.email ?? ''}`,
        header: 'User Info',
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <Avatar name={row.original.recipient?.name ?? 'Customer'} size="sm" />
            <div>
              <p className="font-semibold">{row.original.recipient?.name ?? ''}</p>
              <p className="text-xs text-muted">{row.original.recipient?.email ?? ''}</p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'date',
        header: 'Create Date',
        cell: ({ getValue }) =>
          formatDate(new Date(`${getValue<string>()}T12:00:00`), {
            month: 'numeric',
            day: 'numeric',
            year: 'numeric',
          }),
      },
      {
        accessorKey: 'dueDate',
        header: 'Due Date',
        cell: ({ getValue }) =>
          formatDate(new Date(`${getValue<string>()}T12:00:00`), {
            month: 'numeric',
            day: 'numeric',
            year: 'numeric',
          }),
      },
      {
        id: 'quantity',
        accessorFn: invoiceQuantity,
        header: 'Quantity',
        cell: ({ getValue }) => translateNode(getValue<number>()),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        filterFn: 'equalsString',
        cell: ({ getValue }) => {
          const status = getValue<InvoiceValues['status']>();
          return (
            <Badge tone={status === 'Paid' ? 'green' : status === 'Cancelled' ? 'red' : 'cyan'}>
              {status}
            </Badge>
          );
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        enableGlobalFilter: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="icon" title={translateString('View')}>
              <Link
                aria-label={translateString('View invoice') + ` ${row.original.id}`}
                to={`/apps/invoice/details/${encodeURIComponent(row.original.id)}`}
              >
                <Eye className="size-4 text-muted" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="icon" title={translateString('Edit')}>
              <Link
                aria-label={translateString('Edit invoice') + ` ${row.original.id}`}
                to={`/apps/invoice/edit/${encodeURIComponent(row.original.id)}`}
              >
                <Pencil className="size-4 text-primary" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title={translateString('Delete')}
              aria-label={translateString('Delete invoice') + ` ${row.original.id}`}
              onClick={() => {
                setDeleting(row.original);
                setError('');
              }}
            >
              <Trash2 className="size-4 text-danger" />
            </Button>
          </div>
        ),
      },
    ],
    [],
  );
  const table = useReactTable({
    data,
    columns,
    getRowId: (invoice) => invoice.id,
    state: {
      globalFilter: search,
      sorting,
      rowSelection,
      pagination,
      columnFilters: status === 'All' ? [] : [{ id: 'status', value: status }],
    },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    globalFilterFn: (row, columnId, value) => {
      const invoice = row.original;
      const dateText = (date: string) =>
        formatDate(new Date(`${date}T12:00:00`), {
          month: 'numeric',
          day: 'numeric',
          year: 'numeric',
        });
      return (
        columnId === 'id' &&
        [
          invoice.id,
          invoice.recipient?.name,
          invoice.recipient?.email,
          invoice.date,
          invoice.dueDate,
          dateText(invoice.date),
          dateText(invoice.dueDate),
          invoiceQuantity(invoice),
          invoice.status,
        ]
          .join(' ')
          .toLowerCase()
          .includes(String(value).trim().toLowerCase())
      );
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: false,
  });
  const pageCount = Math.max(1, table.getPageCount());
  useEffect(() => {
    setPagination((current) =>
      current.pageIndex >= pageCount ? { ...current, pageIndex: pageCount - 1 } : current,
    );
  }, [pageCount]);
  const today = new Date();
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const paid = data.filter((invoice) => invoice.status === 'Paid');
  const unpaid = data.filter((invoice) => invoice.status === 'Unpaid');
  const overdue = data.filter((invoice) => invoiceOverdue(invoice, date));
  const current = unpaid.filter((invoice) => !invoiceOverdue(invoice, date));
  const collected =
    paid.length + unpaid.length
      ? Math.round((paid.length / (paid.length + unpaid.length)) * 100)
      : 0;
  const selected = table.getFilteredSelectedRowModel().rows;
  const exportRows = selected.length ? selected : table.getSortedRowModel().rows;
  const exportCsv = () => {
    const url = URL.createObjectURL(
      new Blob([invoiceCsv(exportRows.map((row) => row.original))], {
        type: 'text/csv;charset=utf-8',
      }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = selected.length ? 'selected-invoices.csv' : 'invoices.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const confirmDelete = () => {
    if (!deleting) return;
    try {
      deleteInvoice(tenant, deleting.id);
      setRowSelection((current) => {
        const next = { ...current };
        delete next[deleting.id];
        return next;
      });
      setDeleting(null);
      setMessage('Invoice deleted. You can restore it from Deleted invoices.');
    } catch {
      setError('Unable to save. Browser storage may be full or unavailable.');
    }
  };
  const restore = (id: string) => {
    try {
      restoreInvoice(tenant, id);
      setMessage('Invoice restored.');
      setError('');
    } catch {
      setError('Unable to save. Browser storage may be full or unavailable.');
    }
  };
  const pageStart = Math.min(Math.max(pagination.pageIndex - 2, 0), Math.max(pageCount - 5, 0));
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1.55fr]">
        {[
          { name: 'Paid', invoices: paid, color: '#52c41a' },
          { name: 'Unpaid', invoices: unpaid, color: '#faad14' },
          { name: 'Overdue', invoices: overdue, color: '#ff4d4f' },
        ].map((metric, index) => (
          <Card key={metric.name} className="relative overflow-hidden p-5">
            <div className="flex justify-between gap-2 text-sm">
              <h2 className="font-semibold">{translateNode(metric.name)}</h2>
              <span
                title={translateString('Share of invoice count')}
                className="flex items-center gap-1 text-muted"
              >
                {index === 0 ? (
                  <ArrowUp className="size-3" style={{ color: metric.color }} />
                ) : (
                  <ArrowDown className="size-3" style={{ color: metric.color }} />
                )}{' '}
                {translateNode(
                  data.length ? Math.round((metric.invoices.length / data.length) * 1000) / 10 : 0,
                )}
                %
              </span>
            </div>
            <Balances
              invoices={metric.invoices}
              className="relative z-10 mt-5 block text-xl font-semibold"
            />
            <p className="relative z-10 mt-2 text-sm">
              <strong>{translateNode(metric.invoices.length)}</strong>{' '}
              <span className="text-muted">{translateNode('invoices')}</span>
            </p>
            <svg
              aria-hidden="true"
              viewBox="0 0 120 90"
              className="pointer-events-none absolute bottom-4 end-4 h-20 w-[45%] opacity-60"
            >
              <path
                d="M2 68 C10 65 10 6 18 8 S30 82 38 80 S49 35 58 39 S66 56 76 51 S90 22 96 42 S106 80 118 84"
                fill="none"
                stroke={metric.color}
                strokeWidth="1.5"
              />
            </svg>
          </Card>
        ))}
        <section className="rounded-lg bg-gradient-to-r from-primary-strong to-primary p-4 text-white">
          <div className="flex items-start gap-3">
            <span className="rounded bg-white/10 p-2">
              <FileCheck2 className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm">
                {translateNode('Total Receivables')}
                <Info
                  className="size-3"
                  aria-label={translateString('Invoices are stored in this browser.')}
                >
                  <title>{translateString('Invoices are stored in this browser.')}</title>
                </Info>
              </div>
              <div className="mt-1 flex flex-wrap justify-between gap-2 text-xs text-white/75">
                <span>
                  {translateNode('Current')}{' '}
                  <Balances invoices={current} className="inline-block font-semibold" />
                </span>
                <span>
                  {translateNode('Overdue')}{' '}
                  <Balances invoices={overdue} className="inline-block font-semibold" />
                </span>
              </div>
            </div>
          </div>
          <Balances invoices={unpaid} className="mt-3 block text-xl font-semibold" />
          <div className="mt-3 flex items-center gap-2">
            <div
              className="h-1.5 flex-1 overflow-hidden rounded bg-white/40"
              role="progressbar"
              aria-label={translateString('Paid share of active invoices')}
              aria-valuenow={collected}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full rounded bg-warning" style={{ width: `${collected}%` }} />
            </div>
            <span className="text-xs">{translateNode(collected)}%</span>
          </div>
        </section>
      </div>
      {message && (
        <p role="status" className="rounded bg-primary-soft px-4 py-3 text-sm text-primary">
          {translateNode(message)}
        </p>
      )}
      <Card>
        <div className="px-5 pt-4">
          <div
            role="tablist"
            aria-label={translateString('Invoice status')}
            className="flex overflow-x-auto border-b border-border"
          >
            {['All', 'Paid', 'Unpaid', 'Cancelled'].map((name, index) => (
              <button
                type="button"
                key={name}
                id={`invoice-tab-${name}`}
                role="tab"
                aria-selected={status === name}
                aria-controls="invoice-list-panel"
                tabIndex={status === name ? 0 : -1}
                onKeyDown={(event) => {
                  const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
                  if (!keys.includes(event.key)) return;
                  event.preventDefault();
                  const all = ['All', 'Paid', 'Unpaid', 'Cancelled'];
                  const next =
                    event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? 3
                        : (index + (event.key === 'ArrowRight' ? 1 : -1) + 4) % 4;
                  setStatus(all[next]);
                  setPagination((p) => ({ ...p, pageIndex: 0 }));
                  setRowSelection({});
                  document.getElementById(`invoice-tab-${all[next]}`)?.focus();
                }}
                onClick={() => {
                  setStatus(name);
                  setPagination((p) => ({ ...p, pageIndex: 0 }));
                  setRowSelection({});
                }}
                className={`flex shrink-0 items-center gap-2 border-b-2 px-5 py-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${status === name ? 'border-primary text-primary' : 'border-transparent hover:bg-subtle'}`}
              >
                {translateNode(name)}
                <Badge
                  tone={
                    name === 'Paid'
                      ? 'green'
                      : name === 'Unpaid'
                        ? 'amber'
                        : name === 'Cancelled'
                          ? 'red'
                          : 'blue'
                  }
                >
                  {data.filter((invoice) => name === 'All' || invoice.status === name).length}
                </Badge>
              </button>
            ))}
          </div>
        </div>
        <div id="invoice-list-panel" role="tabpanel" aria-labelledby={`invoice-tab-${status}`}>
          <div className="flex flex-wrap items-center gap-3 px-5 py-5">
            <div className="relative me-auto w-full sm:w-[218px]">
              <Search className="pointer-events-none absolute start-3 top-3 size-4 text-muted" />
              <Input
                aria-label={translateString('Search invoices')}
                placeholder={translateString(`Search ${data.length} records...`)}
                className="ps-10"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPagination((p) => ({ ...p, pageIndex: 0 }));
                  setRowSelection({});
                }}
              />
            </div>
            {Boolean(deleted?.length) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowDeleted(true);
                  setError('');
                }}
              >
                {translateNode('Deleted invoices')} ({translateNode(deleted?.length)})
              </Button>
            )}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button
                  variant="outline"
                  aria-label={translateString('Sort invoices')}
                  className="min-w-[190px] justify-between text-xs"
                >
                  {translateNode('Sort by')} (
                  {sorting.length
                    ? sorting
                        .map((sort) =>
                          translateString(
                            String(
                              columns.find(
                                (column) =>
                                  column.id === sort.id ||
                                  ('accessorKey' in column && column.accessorKey === sort.id),
                              )?.header ?? sort.id,
                            ),
                          ),
                        )
                        .join(', ')
                    : translateString('None')}
                  )<ChevronDown className="size-4 text-muted" />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  className="z-[70] min-w-[190px] rounded border border-border bg-surface p-1 text-ink shadow-lg"
                >
                  {columns
                    .filter((column) => column.enableSorting !== false)
                    .map((column) => {
                      const id =
                        column.id ?? ('accessorKey' in column ? String(column.accessorKey) : '');
                      return (
                        <DropdownMenu.CheckboxItem
                          key={id}
                          checked={sorting.some((sort) => sort.id === id)}
                          onCheckedChange={(checked) =>
                            setSorting((current) =>
                              checked
                                ? [...current, { id, desc: false }]
                                : current.filter((sort) => sort.id !== id),
                            )
                          }
                          onSelect={(event) => event.preventDefault()}
                          className="relative flex cursor-pointer items-center gap-2 rounded py-2 pe-3 ps-8 text-sm outline-none focus:bg-subtle"
                        >
                          <DropdownMenu.ItemIndicator className="absolute start-2">
                            <Check className="size-4" />
                          </DropdownMenu.ItemIndicator>
                          {translateNode(String(column.header))}
                        </DropdownMenu.CheckboxItem>
                      );
                    })}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            <Button asChild>
              <Link to="/apps/invoice/create?new=1">
                <Plus className="size-4" />
                {translateNode('Add Invoice')}
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={translateString('CSV Export')}
              title={translateString(selected.length ? 'Export selected invoices' : 'CSV Export')}
              onClick={exportCsv}
              disabled={!exportRows.length}
            >
              <Download className="size-5 text-muted" />
            </Button>
          </div>
          {selected.length > 0 && (
            <div className="flex items-center justify-between gap-3 bg-primary-soft px-5 py-2 text-sm text-primary">
              <span>
                {translateNode(selected.length)} {translateNode('invoices selected')}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setRowSelection({})}>
                {translateNode('Clear selection')}
              </Button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table
              className="invoice-list-table data-table min-w-[1000px]"
              aria-label={translateString('Invoices')}
            >
              <thead>
                {table.getHeaderGroups().map((group) => (
                  <tr key={group.id}>
                    {group.headers.map((header) => (
                      <th
                        key={header.id}
                        aria-sort={
                          header.column.getCanSort()
                            ? header.column.getIsSorted() === 'asc'
                              ? 'ascending'
                              : header.column.getIsSorted() === 'desc'
                                ? 'descending'
                                : 'none'
                            : undefined
                        }
                        className={header.id === 'select' ? 'w-12' : ''}
                      >
                        {header.column.getCanSort() ? (
                          <button
                            type="button"
                            className="flex items-center gap-2 text-start uppercase outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {translateNode(
                              flexRender(header.column.columnDef.header, header.getContext()),
                            )}
                            {header.column.getIsSorted() === 'asc' ? (
                              <ArrowUp className="size-3 text-muted" />
                            ) : header.column.getIsSorted() === 'desc' ? (
                              <ArrowDown className="size-3 text-muted" />
                            ) : (
                              <ArrowUpDown className="size-3 text-muted" />
                            )}
                          </button>
                        ) : (
                          translateNode(
                            flexRender(header.column.columnDef.header, header.getContext()),
                          )
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className={row.getIsSelected() ? 'bg-primary-soft' : ''}>
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={
                          cell.column.id === 'id' || cell.column.id === 'quantity'
                            ? 'text-center'
                            : 'whitespace-nowrap'
                        }
                      >
                        {translateNode(flexRender(cell.column.columnDef.cell, cell.getContext()))}
                      </td>
                    ))}
                  </tr>
                ))}
                {!table.getRowModel().rows.length && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted">
                      {translateNode('No invoices found')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border px-5 py-4 text-sm">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2">
                {translateNode('Row per page')}
                <Select
                  aria-label={translateString('Row per page')}
                  value={pagination.pageSize}
                  onChange={(event) =>
                    setPagination({ pageIndex: 0, pageSize: Number(event.target.value) })
                  }
                >
                  {[5, 10, 25, 50, 100].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="flex items-center gap-2">
                {translateNode('Go to')}
                <Input
                  aria-label={translateString('Go to page')}
                  type="number"
                  className="w-16"
                  min={1}
                  max={pageCount}
                  value={pagination.pageIndex + 1}
                  onChange={(event) => {
                    const page = Number(event.target.value);
                    if (Number.isInteger(page) && page >= 1 && page <= pageCount)
                      table.setPageIndex(page - 1);
                  }}
                />
              </label>
            </div>
            <nav
              aria-label={translateString('Invoice pagination')}
              className="flex items-center gap-1"
            >
              <Button
                variant="ghost"
                size="icon"
                disabled={!table.getCanPreviousPage()}
                aria-label={translateString('Go to first page')}
                onClick={() => table.firstPage()}
              >
                <ChevronsLeft className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={!table.getCanPreviousPage()}
                aria-label={translateString('Go to previous page')}
                onClick={() => table.previousPage()}
              >
                <ChevronLeft className="size-4" />
              </Button>
              {Array.from({ length: Math.min(5, pageCount) }, (_, i) => pageStart + i).map(
                (page) => (
                  <Button
                    key={page}
                    variant={pagination.pageIndex === page ? 'default' : 'ghost'}
                    size="icon"
                    aria-label={translateString('Page') + ` ${page + 1}`}
                    aria-current={pagination.pageIndex === page ? 'page' : undefined}
                    onClick={() => table.setPageIndex(page)}
                  >
                    {translateNode(page + 1)}
                  </Button>
                ),
              )}
              <Button
                variant="ghost"
                size="icon"
                disabled={!table.getCanNextPage()}
                aria-label={translateString('Go to next page')}
                onClick={() => table.nextPage()}
              >
                <ChevronRight className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={!table.getCanNextPage()}
                aria-label={translateString('Go to last page')}
                onClick={() => table.lastPage()}
              >
                <ChevronsRight className="size-4" />
              </Button>
            </nav>
          </div>
        </div>
      </Card>
      <Dialog.Root
        open={Boolean(deleting) || showDeleted}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
            setShowDeleted(false);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/40" />
          <Dialog.Content
            aria-describedby="invoice-deletion-description"
            className="fixed left-1/2 top-1/2 z-[90] w-[450px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-6 text-ink shadow-xl"
          >
            {deleting ? (
              <>
                <span className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-red-50 text-danger">
                  <Trash2 className="size-7" />
                </span>
                <Dialog.Title className="text-center text-xl font-semibold">
                  {translateNode('Are you sure you want to delete?')}
                </Dialog.Title>
                <Dialog.Description
                  id="invoice-deletion-description"
                  className="mt-3 text-center text-sm text-muted"
                >
                  {translateNode('Invoice')} #{deleting.id} — {deleting.recipient?.name}
                  <br />
                  {translateNode('You can restore this invoice from Deleted invoices.')}
                </Dialog.Description>
                {error && (
                  <p role="alert" className="mt-3 text-sm text-danger">
                    {translateNode(error)}
                  </p>
                )}
                <div className="mt-6 flex justify-end gap-3">
                  <Dialog.Close asChild>
                    <Button variant="outline">{translateNode('Cancel')}</Button>
                  </Dialog.Close>
                  <Button variant="danger" onClick={confirmDelete}>
                    {translateNode('Delete')}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Dialog.Title className="text-lg font-semibold">
                  {translateNode('Deleted invoices')}
                </Dialog.Title>
                <Dialog.Description
                  id="invoice-deletion-description"
                  className="mt-2 text-sm text-muted"
                >
                  {translateNode('Restore an invoice to return it to the list.')}
                </Dialog.Description>
                <div className="my-4 max-h-[50dvh] space-y-2 overflow-y-auto">
                  {deleted?.map((invoice) => (
                    <div
                      className="flex items-center justify-between gap-3 rounded border border-border p-3 text-sm"
                      key={invoice.id}
                    >
                      <span>
                        #{invoice.id} {invoice.recipient?.name}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => restore(invoice.id)}
                        aria-label={translateString('Restore invoice') + ` ${invoice.id}`}
                      >
                        {translateNode('Restore')}
                      </Button>
                    </div>
                  ))}
                  {!deleted?.length && (
                    <p className="text-sm text-muted">{translateNode('No deleted invoices')}</p>
                  )}
                </div>
                {error && (
                  <p role="alert" className="mb-3 text-sm text-danger">
                    {translateNode(error)}
                  </p>
                )}
                <Dialog.Close asChild>
                  <Button variant="outline" className="w-full">
                    {translateNode('Close')}
                  </Button>
                </Dialog.Close>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
export function InvoiceListPage() {
  const tenant = useTenantStore((state) => state.selectedTenantId);
  return <InvoiceList key={tenant} tenant={tenant} />;
}
