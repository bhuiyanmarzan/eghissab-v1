import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Dialog from '@radix-ui/react-dialog';
import { Button, Card, CardContent, Skeleton } from '../components/ui/primitives';
import { DemoTable, type DemoTableOptions } from '../components/react-table/DemoTable';
import { createReactTableRow, getReactTableRows, updateReactTableRow } from '../api/reactTable';
import { translateNode } from '../lib/localization';
import type { ReactTableFeature, ReactTableRow, TableRowValues } from '../lib/reactTable';
import { useTenantStore } from '../store/useTenantStore';

const full = ['name', 'email', 'age', 'role', 'visits', 'status', 'progress'];
const editing = ['name', 'email', 'age', 'visits', 'status', 'progress'];
const definitions: Record<ReactTableFeature, DemoTableOptions[]> = {
  basic: [
    { title: 'Basic Table', compact: true },
    { title: 'Striped Table', striped: true, compact: true },
    { title: 'Footer', fields: full, footer: true },
  ],
  dense: [{ title: 'Dense Table', fields: full, dense: true }],
  sorting: [{ title: 'Sorting', fields: full, sorting: true }],
  filtering: [
    {
      title: 'Filtering',
      fields: ['name', 'email', 'role', 'age', 'visits', 'status', 'progress'],
      filtering: true,
    },
  ],
  grouping: [{ title: 'Grouping', fields: editing, grouping: true }],
  pagination: [
    { title: 'Pagination at Top', pagination: 'top' },
    { title: 'Pagination at Bottom', pagination: 'bottom' },
  ],
  'row-selection': [
    { title: 'Row Selection', selection: 'all', pagination: 'bottom' },
    { title: 'Row Selection (Pagination Control)', selection: 'page', pagination: 'bottom' },
  ],
  expanding: [
    { title: 'Expanding Table', expansion: 'tree' },
    { title: 'Expanding User Details', expansion: 'details' },
    { title: 'Expanding Sub Table', expansion: 'subtable' },
  ],
  editable: [
    { title: 'Editable Row', fields: editing, editing: 'row' },
    { title: 'Editable Cell', fields: editing, editing: 'cell' },
  ],
  'drag-drop': [
    { title: 'Row Drag & Drop (Ordering)', fields: full, drag: 'rows' },
    { title: 'Column Drag & Drop (Ordering)', fields: full, drag: 'columns' },
  ],
  'column-visibility': [
    { title: 'Column Visibility', fields: ['avatar', ...editing], visibility: true },
  ],
  'column-resizing': [
    {
      title: 'Column Resizing',
      fields: [
        'id',
        'name',
        'email',
        'age',
        'role',
        'phone',
        'country',
        'visits',
        'status',
        'progress',
      ],
      resizing: true,
    },
  ],
  'sticky-table': [{ title: 'Sticky Header', fields: full, sticky: true }],
  umbrella: [
    {
      title: 'Umbrella',
      fields: ['avatar', 'name', 'email', 'age', 'visits', 'status'],
      umbrella: true,
      sorting: true,
      visibility: true,
      selection: 'all',
      expansion: 'details',
      pagination: 'bottom',
    },
  ],
  empty: [{ title: 'Empty Table', fields: full, filtering: true }],
  virtualized: [
    { title: 'Virtualized Infinite Scroll', fields: full, virtual: 'infinite' },
    { title: 'Virtualized Rows', fields: full, virtual: 'rows' },
  ],
};
export function ReactTableExamples({
  feature,
  rows,
  tenant,
  onUpdate,
  onCreate,
  onDelete,
}: {
  feature: ReactTableFeature;
  rows: ReactTableRow[];
  tenant: string;
  onUpdate: (id: string, patch: Partial<TableRowValues>) => Promise<boolean>;
  onCreate: (values: TableRowValues) => Promise<boolean>;
  onDelete: (row: ReactTableRow) => Promise<boolean>;
}) {
  useTranslation();
  const virtual = useMemo(
    () =>
      feature === 'virtualized' && rows.length
        ? Array.from({ length: 10000 }, (_, index) => {
            const row = rows[index % rows.length];
            return {
              ...row,
              id: `${row.id}-virtual-${index}`,
              name:
                row.name + (index >= rows.length ? ` ${Math.floor(index / rows.length) + 1}` : ''),
              children: undefined,
            };
          })
        : [],
    [feature, rows],
  );
  return (
    <div className={feature === 'basic' ? 'grid gap-6 xl:grid-cols-2' : 'space-y-6'}>
      {definitions[feature].map((options, index) => {
        const data =
          feature === 'empty'
            ? []
            : feature === 'virtualized'
              ? virtual
              : feature === 'basic'
                ? rows.slice(index * 10, index * 10 + 10)
                : ['grouping', 'pagination', 'row-selection', 'umbrella'].includes(feature)
                  ? rows
                  : ['sticky-table', 'column-resizing'].includes(feature)
                    ? rows.slice(0, 15)
                    : rows.slice(0, 10);
        const key = `${tenant}:${feature}:${options.title}`;
        return (
          <div
            key={key}
            className={feature === 'basic' && index === 2 ? 'xl:col-span-2' : undefined}
          >
            <DemoTable
              data={data}
              options={options}
              prefKey={key}
              onUpdate={onUpdate}
              onCreate={onCreate}
              onDelete={onDelete}
            />
          </div>
        );
      })}
    </div>
  );
}
function ConnectedTables({ feature, tenant }: { feature: ReactTableFeature; tenant: string }) {
  useTranslation();
  const client = useQueryClient();
  const key = ['react-table-rows', tenant];
  const query = useQuery({
    queryKey: key,
    queryFn: () => getReactTableRows(tenant),
    staleTime: 30000,
    retry: 1,
  });
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const cache = (row: ReactTableRow) => {
    client.setQueryData<ReactTableRow[]>(key, (current) => {
      const previous = current ?? [];
      return previous.some((item) => item.id === row.id)
        ? previous.map((item) => (item.id === row.id ? row : item))
        : [...previous, row];
    });
    void client.invalidateQueries({ queryKey: key });
  };
  const update = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<TableRowValues> & { deleted?: boolean };
    }) => updateReactTableRow(id, patch),
    onSuccess: cache,
  });
  const create = useMutation({ mutationFn: createReactTableRow, onSuccess: cache });
  const onUpdate = async (id: string, patch: Partial<TableRowValues> & { deleted?: boolean }) => {
    try {
      await update.mutateAsync({ id, patch });
      setError('');
      setFeedback(
        patch.deleted
          ? 'Record deleted.'
          : patch.deleted === false
            ? 'Record restored.'
            : 'Changes saved.',
      );
      return true;
    } catch {
      setError('Unable to save changes. Check the connection and try again.');
      return false;
    }
  };
  const onCreate = async (values: TableRowValues) => {
    try {
      await create.mutateAsync({
        ...values,
        id: crypto.randomUUID(),
        tenantId: tenant,
        deleted: false,
      });
      setError('');
      setFeedback('Record added.');
      return true;
    } catch {
      setError('Unable to save changes. Check the connection and try again.');
      return false;
    }
  };
  const raw = query.data;
  const rows = useMemo(() => raw?.filter((row) => !row.deleted) ?? [], [raw]);
  const deleted = raw?.filter((row) => row.deleted) ?? [];
  if (query.isLoading)
    return (
      <div aria-label="Loading table data" className="space-y-4">
        <Skeleton className="h-16" />
        <Skeleton className="h-96" />
      </div>
    );
  if (query.isError && !raw)
    return (
      <Card>
        <CardContent>
          <p role="alert" className="text-sm text-danger">
            {translateNode('Unable to load table data. Check the connection and try again.')}
          </p>
          <Button
            className="mt-4"
            onClick={() => {
              void query.refetch();
            }}
          >
            {translateNode('Retry')}
          </Button>
        </CardContent>
      </Card>
    );
  return (
    <div className="space-y-4">
      {(error || feedback || query.isError) && (
        <div
          role={error || query.isError ? 'alert' : 'status'}
          className={`flex items-center justify-between gap-3 rounded px-4 py-3 text-sm ${error || query.isError ? 'bg-red-50 text-danger' : 'bg-primary-soft text-primary'}`}
        >
          <p>
            {translateNode(error || (query.isError ? 'Unable to refresh table data.' : feedback))}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFeedback('');
              setError('');
              if (query.isError) void query.refetch();
            }}
          >
            {translateNode(query.isError ? 'Retry' : 'Dismiss')}
          </Button>
        </div>
      )}
      {feature === 'umbrella' && deleted.length > 0 && (
        <Button variant="outline" size="sm" onClick={() => setShowDeleted(true)}>
          {translateNode('Deleted records')} ({translateNode(deleted.length)})
        </Button>
      )}
      <ReactTableExamples
        feature={feature}
        tenant={tenant}
        rows={rows}
        onUpdate={onUpdate}
        onCreate={onCreate}
        onDelete={(row) => onUpdate(row.id, { deleted: true })}
      />
      <Dialog.Root open={showDeleted} onOpenChange={setShowDeleted}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/40" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed left-1/2 top-1/2 z-[90] max-h-[80dvh] w-[500px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg bg-surface p-6 text-ink shadow-xl"
          >
            <Dialog.Title className="text-lg font-semibold">
              {translateNode('Deleted records')}
            </Dialog.Title>
            <div className="my-4 space-y-3">
              {deleted.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-3 rounded border border-border p-3"
                >
                  <span className="text-sm">{row.name}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={update.isPending}
                    onClick={() => {
                      void onUpdate(row.id, { deleted: false });
                    }}
                  >
                    {translateNode('Restore')}
                  </Button>
                </div>
              ))}
              {!deleted.length && (
                <p className="text-sm text-muted">{translateNode('No deleted records')}</p>
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
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
export function ReactTablePage({ feature }: { feature: ReactTableFeature }) {
  const tenant = useTenantStore((state) => state.selectedTenantId);
  return <ConnectedTables key={`${tenant}:${feature}`} tenant={tenant} feature={feature} />;
}
