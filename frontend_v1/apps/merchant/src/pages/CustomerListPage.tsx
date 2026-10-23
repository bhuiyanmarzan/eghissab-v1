import { Fragment, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
} from '@tanstack/react-table';
import * as Dialog from '@radix-ui/react-dialog';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Eye,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { Avatar, Badge, Button, Card, Input, Select, Skeleton } from '../components/ui/primitives';
import { TableCheckbox } from '../components/react-table/TableControls';
import { CustomerForm } from '../components/customer/CustomerForm';
import { CustomerDetails } from '../components/customer/CustomerDetails';
import { getCustomerRecords, saveCustomer, setCustomerDeleted } from '../api/customers';
import { customerCsv, type CustomerRecord, type CustomerValues } from '../lib/customer';
import { translateNode as t, translateString as ts } from '../lib/localization';
import { useTenantStore } from '../store/useTenantStore';

export function CustomerListPage() {
  const tenant = useTenantStore((s) => s.selectedTenantId);
  return <ConnectedCustomerList key={tenant} tenant={tenant} />;
}
export function ConnectedCustomerList({ tenant }: { tenant: string }) {
  useTranslation();
  const client = useQueryClient();
  const key = ['customer-records', tenant];
  const query = useQuery({
    queryKey: key,
    queryFn: () => getCustomerRecords(tenant),
    retry: 1,
    staleTime: 30000,
  });
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [status, setStatus] = useState('');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'id', desc: true }]);
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState<CustomerRecord | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<CustomerRecord | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const cache = (row: CustomerRecord) => {
    client.setQueryData<CustomerRecord[]>(key, (current) => {
      const rows = current ?? [];
      return rows.some((r) => r.id === row.id)
        ? rows.map((r) => (r.id === row.id ? row : r))
        : [...rows, row];
    });
    void client.invalidateQueries({ queryKey: key });
  };
  const save = useMutation({
    mutationFn: ({ values, id }: { values: CustomerValues; id?: string }) =>
      saveCustomer(tenant, values, id),
    onSuccess: cache,
  });
  const remove = useMutation({
    mutationFn: ({ id, deleted }: { id: string; deleted: boolean }) =>
      setCustomerDeleted(id, deleted),
    onSuccess: cache,
  });
  const onSave = async (values: CustomerValues, id?: string) => {
    try {
      await save.mutateAsync({ values, id });
      setError('');
      setFeedback(id ? 'Customer updated.' : 'Customer added.');
      return true;
    } catch {
      setError('Unable to save customer. Check the connection and try again.');
      return false;
    }
  };
  const onDelete = async (row: CustomerRecord, deleted = true) => {
    try {
      await remove.mutateAsync({ id: row.id, deleted });
      setSelection((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
      setError('');
      setFeedback(
        deleted
          ? 'Customer deleted. You can restore it from Deleted customers.'
          : 'Customer restored.',
      );
      setDeleting(null);
      if (form?.id === row.id) setForm(undefined);
      return true;
    } catch {
      setError('Unable to save customer. Check the connection and try again.');
      return false;
    }
  };
  const active = useMemo(() => query.data?.filter((r) => !r.deleted) ?? [], [query.data]);
  const data = useMemo(
    () => active.filter((r) => !status || r.status === status),
    [active, status],
  );
  const deleted = query.data?.filter((r) => r.deleted) ?? [];
  const columns = useMemo<ColumnDef<CustomerRecord>[]>(
    () => [
      {
        id: 'select',
        enableSorting: false,
        enableGlobalFilter: false,
        header: ({ table }) => (
          <TableCheckbox
            aria-label={ts('Select all customers')}
            checked={table.getIsAllRowsSelected()}
            mixed={table.getIsSomeRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <TableCheckbox
            aria-label={ts('Select customer') + ' ' + row.original.id}
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
          />
        ),
      },
      {
        accessorKey: 'id',
        header: '#',
        sortingFn: (a, b) =>
          a.original.id.localeCompare(b.original.id, undefined, { numeric: true }),
      },
      {
        accessorKey: 'name',
        header: 'User info',
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            {row.original.avatar ? (
              <img
                src={row.original.avatar}
                alt={row.original.name}
                className="size-10 rounded-full object-cover"
              />
            ) : (
              <Avatar name={row.original.name} />
            )}
            <div>
              <p className="font-medium">{row.original.name}</p>
              <p className="text-xs text-muted">{row.original.email}</p>
            </div>
          </div>
        ),
      },
      { accessorKey: 'email', header: 'Email' },
      { accessorKey: 'phone', header: 'Contact' },
      { accessorKey: 'age', header: 'Age' },
      { accessorKey: 'country', header: 'Country' },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge
            tone={
              row.original.status === 'Complete'
                ? 'green'
                : row.original.status === 'Pending'
                  ? 'blue'
                  : 'red'
            }
          >
            {t(row.original.status)}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        enableGlobalFilter: false,
        cell: ({ row }) => (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label={ts('View customer') + ' ' + row.original.id}
              title={ts('View')}
              aria-expanded={!!expanded[row.id]}
              aria-controls={'customer-detail-' + row.id}
              onClick={() => setExpanded((current) => ({ ...current, [row.id]: !current[row.id] }))}
            >
              {expanded[row.id] ? <X className="size-4 text-danger" /> : <Eye className="size-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={ts('Edit customer') + ' ' + row.original.id}
              title={ts('Edit')}
              onClick={() => setForm(row.original)}
            >
              <Pencil className="size-4 text-primary" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={ts('Delete customer') + ' ' + row.original.id}
              title={ts('Delete')}
              onClick={() => setDeleting(row.original)}
            >
              <Trash2 className="size-4 text-danger" />
            </Button>
          </div>
        ),
      },
    ],
    [expanded],
  );
  const table = useReactTable({
    data,
    columns,
    getRowId: (r) => r.id,
    enableSortingRemoval: false,
    state: {
      globalFilter: filter,
      sorting,
      rowSelection: selection,
      columnVisibility: { email: false },
    },
    onSortingChange: setSorting,
    onRowSelectionChange: setSelection,
    onGlobalFilterChange: setFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
    globalFilterFn: (row, _id, value) =>
      [
        row.original.id,
        row.original.name,
        row.original.email,
        row.original.phone,
        row.original.age,
        row.original.country,
        row.original.status,
      ].some((v) =>
        String(v).toLocaleLowerCase().includes(String(value).toLocaleLowerCase().trim()),
      ),
  });
  const { pageIndex, pageSize } = table.getState().pagination;
  const pages = Math.max(1, table.getPageCount());
  const start = Math.min(Math.max(pageIndex - 2, 0), Math.max(0, pages - 5));
  const exportRows = table.getFilteredSelectedRowModel().rows.length
    ? table.getFilteredSelectedRowModel().rows
    : table.getSortedRowModel().rows;
  if (query.isLoading)
    return (
      <div aria-label={ts('Loading customers')}>
        <Skeleton className="h-96" />
      </div>
    );
  if (query.isError && !query.data)
    return (
      <Card className="p-6">
        <p role="alert">{t('Unable to load customers. Check the connection and try again.')}</p>
        <Button className="mt-4" onClick={() => void query.refetch()}>
          {t('Retry')}
        </Button>
      </Card>
    );
  return (
    <div className="space-y-4">
      {(error || feedback || query.isError) && (
        <div
          role={error || query.isError ? 'alert' : 'status'}
          className={
            'flex justify-between gap-3 rounded p-3 text-sm ' +
            (error || query.isError ? 'bg-red-50 text-danger' : 'bg-primary-soft text-primary')
          }
        >
          <p>{t(error || (query.isError ? 'Unable to refresh customers.' : feedback))}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setError('');
              setFeedback('');
              if (query.isError) void query.refetch();
            }}
          >
            {t(query.isError ? 'Retry' : 'Dismiss')}
          </Button>
        </div>
      )}
      {deleted.length > 0 && (
        <Button variant="outline" size="sm" onClick={() => setShowDeleted(true)}>
          {t('Deleted customers')} ({t(deleted.length)})
        </Button>
      )}
      <Card>
        <div className="flex flex-wrap items-center gap-3 p-5">
          <div className="relative me-auto w-full sm:w-60">
            <Search className="absolute start-3 top-3 size-4 text-muted" />
            <Input
              value={filter}
              aria-label={ts('Search customers')}
              onChange={(e) => {
                setFilter(e.target.value);
                table.setPageIndex(0);
              }}
              placeholder={ts(`Search ${active.length} records...`)}
              className="ps-9"
            />
          </div>
          <Select
            aria-label={ts('Status Filter')}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              table.setPageIndex(0);
            }}
          >
            <option value="">{t('All Status')}</option>
            {['Complete', 'Pending', 'Canceled'].map((s) => (
              <option key={s} value={s}>
                {t(s)}
              </option>
            ))}
          </Select>
          <Select
            aria-label={ts('Sort customers')}
            value={sorting[0]?.id ?? ''}
            onChange={(e) => setSorting([{ id: e.target.value, desc: e.target.value === 'id' }])}
          >
            {[
              ['id', '#'],
              ['name', 'User info'],
              ['phone', 'Contact'],
              ['age', 'Age'],
              ['country', 'Country'],
              ['status', 'Status'],
            ].map(([id, label]) => (
              <option key={id} value={id}>
                {t('Sort by')} ({t(label)})
              </option>
            ))}
          </Select>
          <Button onClick={() => setForm(null)}>
            <Plus className="size-4" />
            {t('Add Customer')}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={ts('CSV Export')}
            title={ts('CSV Export')}
            disabled={!exportRows.length}
            onClick={() => {
              const url = URL.createObjectURL(
                new Blob([customerCsv(exportRows.map((r) => r.original))], {
                  type: 'text/csv;charset=utf-8',
                }),
              );
              const a = document.createElement('a');
              a.href = url;
              a.download = 'customers.csv';
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            <Download className="size-5 text-muted" />
          </Button>
        </div>
        {Object.values(selection).some(Boolean) && (
          <div className="flex items-center justify-between bg-primary-soft px-5 py-2 text-sm text-primary">
            <span>
              {t(Object.values(selection).filter(Boolean).length)} {t('row(s) selected')}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setSelection({})}>
              {t('Clear selection')}
            </Button>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="customer-table w-full" aria-label={ts('Customers')}>
            <thead>
              {table.getHeaderGroups().map((group) => (
                <tr key={group.id}>
                  {group.headers.map((header) => (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={
                        header.column.getIsSorted() === 'asc'
                          ? 'ascending'
                          : header.column.getIsSorted() === 'desc'
                            ? 'descending'
                            : undefined
                      }
                    >
                      {header.column.getCanSort() ? (
                        <button
                          className="flex items-center gap-2"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {t(flexRender(header.column.columnDef.header, header.getContext()))}
                          {header.column.getIsSorted() === 'asc' ? (
                            <ArrowUp className="size-3" />
                          ) : header.column.getIsSorted() === 'desc' ? (
                            <ArrowDown className="size-3" />
                          ) : (
                            <ArrowUpDown className="size-3 text-muted" />
                          )}
                        </button>
                      ) : (
                        t(flexRender(header.column.columnDef.header, header.getContext()))
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <Fragment key={row.id}>
                  <tr className={row.getIsSelected() ? 'customer-selected' : ''}>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                  {expanded[row.id] && (
                    <tr id={'customer-detail-' + row.id}>
                      <td colSpan={8} className="customer-detail">
                        <CustomerDetails row={row.original} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {!table.getRowModel().rows.length && (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-muted">
                    {t('No customers found')}
                    {(filter || status) && (
                      <Button
                        className="ms-3"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setFilter('');
                          setStatus('');
                        }}
                      >
                        {t('Clear filters')}
                      </Button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border p-5 text-sm">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              {t('Row per page')}
              <Select
                aria-label={ts('Row per page')}
                value={pageSize}
                onChange={(e) =>
                  table.setPagination({ pageIndex: 0, pageSize: Number(e.target.value) })
                }
              >
                {[5, 10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {t(n)}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex items-center gap-2">
              {t('Go to')}
              <Input
                aria-label={ts('Go to page')}
                type="number"
                min={1}
                max={pages}
                value={Math.min(pageIndex + 1, pages)}
                className="w-16"
                onChange={(e) => {
                  const value = Number(e.target.value);
                  if (Number.isInteger(value) && value >= 1 && value <= pages)
                    table.setPageIndex(value - 1);
                }}
              />
            </label>
          </div>
          <nav aria-label={ts('Customer pagination')} className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label={ts('Go to first page')}
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.firstPage()}
            >
              <ChevronsLeft className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={ts('Go to previous page')}
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              <ChevronLeft className="size-4" />
            </Button>
            {Array.from({ length: Math.min(5, pages) }, (_, i) => i + start).map((p) => (
              <Button
                key={p}
                variant={pageIndex === p ? 'default' : 'ghost'}
                size="icon"
                aria-label={ts('Page') + ' ' + (p + 1)}
                aria-current={pageIndex === p ? 'page' : undefined}
                onClick={() => table.setPageIndex(p)}
              >
                {t(p + 1)}
              </Button>
            ))}
            {start + 5 < pages && (
              <>
                <span className="self-center">…</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={ts('Page') + ' ' + pages}
                  onClick={() => table.lastPage()}
                >
                  {t(pages)}
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              aria-label={ts('Go to next page')}
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={ts('Go to last page')}
              disabled={!table.getCanNextPage()}
              onClick={() => table.lastPage()}
            >
              <ChevronsRight className="size-4" />
            </Button>
          </nav>
        </div>
      </Card>
      {form !== undefined && (
        <CustomerForm
          key={form?.id ?? 'new'}
          row={form ?? undefined}
          onClose={() => setForm(undefined)}
          onSave={onSave}
          onDelete={setDeleting}
        />
      )}
      {deleting && (
        <Dialog.Root
          open
          onOpenChange={(open) => {
            if (!open && !remove.isPending) setDeleting(null);
          }}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-[95] bg-black/40" />
            <Dialog.Content
              aria-describedby="customer-delete-description"
              className="fixed left-1/2 top-1/2 z-[100] w-[440px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface p-6 text-center text-ink shadow-xl"
            >
              <Trash2 className="mx-auto mb-5 size-14 rounded-full bg-red-50 p-3 text-danger" />
              <Dialog.Title className="text-xl font-semibold">
                {t('Are you sure you want to delete?')}
              </Dialog.Title>
              <Dialog.Description
                id="customer-delete-description"
                className="mt-3 text-sm text-muted"
              >
                {deleting.name} — #{deleting.id}
                <br />
                {t('You can restore this customer from Deleted customers.')}
              </Dialog.Description>
              {error && (
                <p role="alert" className="mt-3 text-sm text-danger">
                  {t(error)}
                </p>
              )}
              <div className="mt-6 flex justify-center gap-3">
                <Button
                  variant="outline"
                  disabled={remove.isPending}
                  onClick={() => setDeleting(null)}
                >
                  {t('Cancel')}
                </Button>
                <Button
                  variant="danger"
                  disabled={remove.isPending}
                  onClick={() => void onDelete(deleting)}
                >
                  {t(remove.isPending ? 'Saving...' : 'Delete')}
                </Button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
      <Dialog.Root open={showDeleted} onOpenChange={setShowDeleted}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/40" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed left-1/2 top-1/2 z-[90] max-h-[80dvh] w-[560px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-lg bg-surface p-6 text-ink"
          >
            <div className="mb-5 flex items-center justify-between">
              <Dialog.Title className="text-xl font-semibold">
                {t('Deleted customers')}
              </Dialog.Title>
              <Dialog.Close asChild>
                <Button variant="ghost" size="icon" aria-label={ts('Close dialog')}>
                  <X className="size-4" />
                </Button>
              </Dialog.Close>
            </div>
            {deleted.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between gap-4 border-b border-border py-3"
              >
                <span>{row.name}</span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={remove.isPending}
                  onClick={() => void onDelete(row, false)}
                >
                  {t('Restore')}
                </Button>
              </div>
            ))}
            {!deleted.length && <p>{t('No deleted customers')}</p>}
            {error && <p role="alert">{t(error)}</p>}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
