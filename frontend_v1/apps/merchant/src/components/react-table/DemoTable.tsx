import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type ExpandedState,
  type GroupingState,
  type RowSelectionState,
  type SortingState,
} from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronRight,
  Columns3,
  Eye,
  GripVertical,
  Layers,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { Avatar, Badge, Button, Card, CardHeader, Input, Select } from '../ui/primitives';
import { translateNode, translateString } from '../../lib/localization';
import {
  orderTableRows,
  reorderIds,
  tableRowSchema,
  virtualWindow,
  type ReactTableRow,
  type TableRowValues,
} from '../../lib/reactTable';
import { useReactTableStore } from '../../store/useReactTableStore';
import { EditableTableCell } from './EditableTableCell';
import { ExportTable, TableCheckbox, TablePagination } from './TableControls';
import { RecordDialog } from './RecordDialog';

export type DemoTableOptions = {
  title: string;
  fields?: string[];
  striped?: boolean;
  footer?: boolean;
  dense?: boolean;
  sorting?: boolean;
  filtering?: boolean;
  grouping?: boolean;
  pagination?: 'top' | 'bottom';
  selection?: 'all' | 'page';
  expansion?: 'tree' | 'details' | 'subtable';
  editing?: 'row' | 'cell';
  drag?: 'rows' | 'columns';
  visibility?: boolean;
  resizing?: boolean;
  sticky?: boolean;
  compact?: boolean;
  umbrella?: boolean;
  virtual?: 'infinite' | 'rows';
};
const labels: Record<string, string> = {
  id: '#',
  avatar: 'Avatar',
  name: 'Name',
  email: 'Email',
  age: 'Age',
  role: 'Role',
  visits: 'Visits',
  status: 'Status',
  progress: 'Profile Progress',
  phone: 'Contact',
  country: 'Country',
  address: 'Address',
  select: '',
  expand: '',
  drag: '',
  actions: 'Actions',
};
const sizes: Record<string, number> = {
  id: 80,
  avatar: 65,
  name: 200,
  email: 240,
  age: 90,
  role: 240,
  visits: 100,
  status: 150,
  progress: 180,
  phone: 190,
  country: 140,
  actions: 130,
  select: 50,
  expand: 50,
  drag: 50,
};
const defaultFields = ['name', 'email', 'age', 'status', 'progress'];
const editableFields = new Set(['name', 'email', 'age', 'role', 'visits', 'status']);
export function DemoTable({
  data,
  options,
  prefKey,
  onUpdate,
  onCreate,
  onDelete,
}: {
  data: ReactTableRow[];
  options: DemoTableOptions;
  prefKey: string;
  onUpdate: (id: string, patch: Partial<TableRowValues>) => Promise<boolean>;
  onCreate: (values: TableRowValues) => Promise<boolean>;
  onDelete: (row: ReactTableRow) => Promise<boolean>;
}) {
  useTranslation();
  const preferences = useReactTableStore((state) => state.preferences[prefKey]);
  const savePreferences = useReactTableStore((state) => state.savePreferences);
  const ordered = useMemo(
    () => orderTableRows(data, preferences?.rowOrder ?? []),
    [data, preferences?.rowOrder],
  );
  const [sorting, setSorting] = useState<SortingState>(
    options.sorting ? [{ id: 'age', desc: false }] : [],
  );
  const [filters, setFilters] = useState<ColumnFiltersState>([]);
  const [search, setSearch] = useState('');
  const [grouping, setGrouping] = useState<GroupingState>(options.grouping ? ['age'] : []);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [dense, setDense] = useState(Boolean(options.dense));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TableRowValues | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState<{
    mode: 'view' | 'create' | 'delete';
    row: ReactTableRow | null;
  } | null>(null);
  const [notice, setNotice] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  const [loaded, setLoaded] = useState(25);
  const scrollRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ kind: 'row' | 'column'; id: string } | null>(null);
  const fieldIds = options.fields ?? defaultFields;
  const moveRow = useCallback(
    (id: string, delta: number) => {
      const latest = useReactTableStore.getState().preferences[prefKey]?.rowOrder ?? [];
      const rows = orderTableRows(data, latest);
      const ids = rows.map((row) => row.id);
      const index = ids.indexOf(id);
      const to = ids[index + delta];
      if (to) {
        savePreferences(prefKey, { rowOrder: reorderIds(ids, id, to) });
        setNotice('Row order updated.');
      }
    },
    [data, prefKey, savePreferences],
  );

  const columns = useMemo<ColumnDef<ReactTableRow>[]>(() => {
    const result: ColumnDef<ReactTableRow>[] = [];
    if (options.selection)
      result.push({
        id: 'select',
        header: ({ table }) => (
          <TableCheckbox
            aria-label={
              translateString(
                options.selection === 'page' ? 'Select page' : 'Select all filtered rows',
              ) +
              ' — ' +
              translateString(options.title)
            }
            checked={
              options.selection === 'page'
                ? table.getIsAllPageRowsSelected()
                : table.getIsAllRowsSelected()
            }
            mixed={
              options.selection === 'page'
                ? table.getIsSomePageRowsSelected()
                : table.getIsSomeRowsSelected()
            }
            onChange={
              options.selection === 'page'
                ? table.getToggleAllPageRowsSelectedHandler()
                : table.getToggleAllRowsSelectedHandler()
            }
          />
        ),
        cell: ({ row }) => (
          <TableCheckbox
            aria-label={translateString('Select row') + ' ' + row.original.id}
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
          />
        ),
        enableSorting: false,
        enableGrouping: false,
        enableHiding: false,
        size: 50,
      });
    if (options.expansion)
      result.push({
        id: 'expand',
        header: '',
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="icon"
            aria-label={
              translateString(row.getIsExpanded() ? 'Collapse row' : 'Expand row') +
              ' ' +
              row.original.id
            }
            aria-expanded={row.getIsExpanded()}
            disabled={!row.getCanExpand()}
            onClick={row.getToggleExpandedHandler()}
          >
            {row.getIsExpanded() ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </Button>
        ),
        enableSorting: false,
        enableGrouping: false,
        enableHiding: false,
        size: 50,
      });
    if (options.drag === 'rows')
      result.push({
        id: 'drag',
        header: '',
        cell: ({ row }) => (
          <button
            type="button"
            draggable
            aria-label={translateString('Move row') + ' ' + row.original.id}
            title={translateString('Drag or use arrow keys to move this row')}
            onDragStart={(e) => {
              drag.current = { kind: 'row', id: row.original.id };
              e.dataTransfer.setData('text/plain', row.original.id);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragEnd={() => {
              drag.current = null;
            }}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
              e.preventDefault();
              moveRow(row.original.id, e.key === 'ArrowUp' ? -1 : 1);
            }}
            className="rounded p-1 text-muted focus-visible:ring-2 focus-visible:ring-primary"
          >
            <GripVertical className="size-4" />
          </button>
        ),
        enableSorting: false,
        enableGrouping: false,
        enableHiding: false,
        size: 50,
      });
    fieldIds.forEach((id) => {
      if (id === 'avatar') {
        result.push({
          id,
          header: 'Avatar',
          cell: ({ row }) => <Avatar name={row.original.name} size="sm" />,
          enableSorting: false,
          enableGrouping: false,
          size: 65,
        });
        return;
      }
      result.push({
        accessorKey: id,
        id,
        header: labels[id],
        size: options.compact
          ? ({ name: 150, email: 175, age: 55, status: 100, progress: 110 }[id] ?? sizes[id] ?? 150)
          : (sizes[id] ?? 150),
        minSize: id === 'age' ? 70 : 90,
        maxSize: 600,
        enableSorting: Boolean(
          options.sorting || options.filtering || options.umbrella || options.virtual,
        ),
        enableGrouping: Boolean(options.grouping),
        filterFn: ['age', 'visits', 'progress'].includes(id)
          ? 'inNumberRange'
          : id === 'status'
            ? 'equalsString'
            : 'includesString',
        aggregationFn:
          id === 'visits' ? 'sum' : ['age', 'progress'].includes(id) ? 'mean' : 'count',
        cell: ({ getValue, row }) =>
          id === 'status' ? (
            <Badge
              tone={
                getValue() === 'Relationship'
                  ? 'green'
                  : getValue() === 'Complicated'
                    ? 'red'
                    : 'cyan'
              }
            >
              {String(getValue())}
            </Badge>
          ) : id === 'progress' ? (
            <div className="flex min-w-32 items-center gap-2">
              <div
                role="progressbar"
                aria-label={translateString('Profile Progress') + ' ' + row.original.name}
                aria-valuenow={Number(getValue())}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-1.5 flex-1 rounded bg-primary-soft"
              >
                <div className="h-full rounded bg-primary" style={{ width: `${getValue()}%` }} />
              </div>
              <span className="text-xs">{translateNode(Number(getValue()))}%</span>
            </div>
          ) : typeof getValue() === 'number' ? (
            translateNode(Number(getValue()))
          ) : (
            String(getValue() ?? '')
          ),
      });
    });
    if (options.editing === 'row' || options.umbrella)
      result.push({
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        enableGrouping: false,
        enableHiding: false,
        size: 130,
        cell: () => null,
      });
    return result;
  }, [fieldIds, options, moveRow]);
  const order =
    preferences?.columnOrder ??
    columns.map((column) => column.id ?? String('accessorKey' in column ? column.accessorKey : ''));
  const table = useReactTable({
    data: ordered,
    columns,
    getRowId: (row) => row.id,
    getSubRows: options.expansion === 'tree' ? (row) => row.children : undefined,
    state: {
      sorting,
      columnFilters: filters,
      globalFilter: search,
      grouping,
      expanded,
      rowSelection: selection,
      pagination,
      columnVisibility: preferences?.visibility ?? {},
      columnOrder: order,
      columnSizing: preferences?.sizes ?? {},
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setFilters,
    onGlobalFilterChange: setSearch,
    onGroupingChange: setGrouping,
    onExpandedChange: setExpanded,
    onRowSelectionChange: setSelection,
    onPaginationChange: setPagination,
    onColumnVisibilityChange: (updater) =>
      savePreferences(prefKey, {
        visibility:
          typeof updater === 'function' ? updater(preferences?.visibility ?? {}) : updater,
      }),
    onColumnOrderChange: (updater) =>
      savePreferences(prefKey, {
        columnOrder: typeof updater === 'function' ? updater(order) : updater,
      }),
    onColumnSizingChange: (updater) =>
      savePreferences(prefKey, {
        sizes: typeof updater === 'function' ? updater(preferences?.sizes ?? {}) : updater,
      }),
    enableColumnResizing: Boolean(options.resizing),
    columnResizeMode: 'onChange',
    enableRowSelection: (row) => !row.getIsGrouped(),
    getRowCanExpand: (row) =>
      options.expansion === 'tree'
        ? Boolean(row.original.children?.length)
        : Boolean(options.expansion) || row.getIsGrouped(),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getPaginationRowModel: options.pagination ? getPaginationRowModel() : undefined,
    autoResetPageIndex: false,
    autoResetExpanded: false,
  });
  const pageCount = Math.max(1, table.getPageCount());
  useEffect(() => {
    if (options.pagination)
      setPagination((current) =>
        current.pageIndex >= pageCount ? { ...current, pageIndex: pageCount - 1 } : current,
      );
  }, [pageCount, options.pagination]);
  const model = table.getRowModel().rows;
  const limit = options.virtual === 'infinite' ? Math.min(loaded, model.length) : model.length;
  const window = options.virtual
    ? virtualWindow(scrollTop, limit)
    : { start: 0, end: model.length, top: 0, bottom: 0 };
  const shown = model.slice(window.start, window.end);
  const selected = table.getSelectedRowModel().flatRows.filter((row) => !row.getIsGrouped());
  const exportRows = selected.length
    ? selected.map((row) => row.original)
    : table.getFilteredRowModel().rows.map((row) => row.original);
  const exportFields = table
    .getVisibleLeafColumns()
    .map((column) => column.id)
    .filter((id) => id === 'id' || id in tableRowSchema.shape) as (keyof TableRowValues | 'id')[];
  const dropRow = (from: string, to: string) => {
    savePreferences(prefKey, {
      rowOrder: reorderIds(
        ordered.map((row) => row.id),
        from,
        to,
      ),
    });
    setNotice('Row order updated.');
  };
  const moveColumn = (id: string, delta: number) => {
    const index = order.indexOf(id);
    const to = order[index + delta];
    if (to) {
      table.setColumnOrder(reorderIds(order, id, to));
      setNotice('Column order updated.');
    }
  };
  const beginEdit = (row: ReactTableRow) => {
    setEditingId(row.id);
    setDraft({ ...row });
    setErrors({});
  };
  const saveRow = async () => {
    if (!draft || !editingId) return;
    const parsed = tableRowSchema.safeParse(draft);
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
        ),
      );
      return;
    }
    setSaving(true);
    const ok = await onUpdate(editingId, parsed.data);
    setSaving(false);
    if (ok) {
      setEditingId(null);
      setDraft(null);
      setNotice('Changes saved.');
    } else setErrors({ save: 'Unable to save changes. Try again.' });
  };
  const editInput = (row: ReactTableRow, id: keyof TableRowValues) => {
    if (options.editing === 'cell')
      return <EditableTableCell row={row} field={id} onUpdate={onUpdate} />;
    if (!draft) return null;
    const common = {
      value: String(draft[id]),
      disabled: saving,
      'aria-label': translateString(labels[id]) + ` — ${row.id}`,
      'aria-invalid': Boolean(errors[id]),
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setDraft({
          ...draft,
          [id]: typeof row[id] === 'number' ? Number(e.target.value) : e.target.value,
        });
        setErrors((current) => ({ ...current, [id]: '' }));
      },
    };
    return (
      <div>
        {id === 'status' ? (
          <Select {...common} className="w-full">
            {['Single', 'Relationship', 'Complicated'].map((status) => (
              <option key={status} value={status}>
                {translateNode(status)}
              </option>
            ))}
          </Select>
        ) : (
          <Input
            {...common}
            type={typeof row[id] === 'number' ? 'number' : id === 'email' ? 'email' : 'text'}
          />
        )}{' '}
        {errors[id] && (
          <span role="alert" className="block text-xs text-danger">
            {translateNode(errors[id])}
          </span>
        )}
      </div>
    );
  };
  const renderDetails = (row: { original: ReactTableRow }) =>
    options.expansion === 'subtable' ? (
      <table
        className="rt-table w-full"
        aria-label={translateString('Related records') + ' ' + row.original.name}
      >
        <thead>
          <tr>
            {['Name', 'Email', 'Age', 'Status'].map((label) => (
              <th key={label}>{translateNode(label)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {row.original.children?.map((child) => (
            <tr key={child.id}>
              <td>{child.name}</td>
              <td>{child.email}</td>
              <td>{translateNode(child.age)}</td>
              <td>{translateNode(child.status)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    ) : (
      <div className="flex flex-wrap gap-5 rounded border border-border bg-surface p-5">
        <Avatar name={row.original.name} size="lg" />
        <div className="min-w-52">
          <h4 className="font-semibold">{row.original.name}</h4>
          <p className="mt-1 text-sm text-muted">{row.original.role}</p>
          <p className="mt-2 text-sm">{row.original.email}</p>
        </div>
        <dl className="grid flex-1 grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted">{translateNode('Contact')}</dt>
            <dd>{row.original.phone}</dd>
          </div>
          <div>
            <dt className="text-muted">{translateNode('Country')}</dt>
            <dd>{row.original.country}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-muted">{translateNode('Address')}</dt>
            <dd>{row.original.address}</dd>
          </div>
        </dl>
      </div>
    );
  return (
    <Card className="overflow-hidden" data-table-example={options.title}>
      <CardHeader
        title={options.title}
        className="min-h-16"
        action={
          <div className="flex items-center gap-3">
            {options.dense && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  role="switch"
                  checked={dense}
                  onChange={(e) => setDense(e.target.checked)}
                />
                {translateNode('Dense')}
              </label>
            )}
            <ExportTable rows={exportRows} fields={exportFields} title={options.title} />
          </div>
        }
      />
      {(options.filtering ||
        options.sorting ||
        options.visibility ||
        options.grouping ||
        options.umbrella ||
        options.resizing) && (
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          {(options.filtering || options.umbrella) && (
            <div className="relative me-auto w-full sm:w-60">
              <Search className="pointer-events-none absolute start-3 top-3 size-4 text-muted" />
              <Input
                aria-label={
                  translateString('Search records') + ' — ' + translateString(options.title)
                }
                placeholder={translateString(`Search ${data.length} records...`)}
                value={search}
                className="ps-9"
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPagination((p) => ({ ...p, pageIndex: 0 }));
                  if (options.virtual) {
                    setScrollTop(0);
                    if (scrollRef.current) scrollRef.current.scrollTop = 0;
                  }
                }}
              />
            </div>
          )}
          {options.umbrella && (
            <Select
              aria-label={translateString('Status Filter')}
              value={String(table.getColumn('status')?.getFilterValue() ?? '')}
              onChange={(e) => {
                table.getColumn('status')?.setFilterValue(e.target.value || undefined);
                setPagination((p) => ({ ...p, pageIndex: 0 }));
              }}
            >
              <option value="">{translateNode('All Status')}</option>
              {['Single', 'Relationship', 'Complicated'].map((status) => (
                <option key={status} value={status}>
                  {translateNode(status)}
                </option>
              ))}
            </Select>
          )}
          {options.sorting && (
            <label className="flex items-center gap-2 text-sm">
              {translateNode('Sort by')}
              <Select
                aria-label={translateString('Sort by') + ' — ' + translateString(options.title)}
                value={sorting[0]?.id ?? ''}
                onChange={(e) =>
                  setSorting(e.target.value ? [{ id: e.target.value, desc: false }] : [])
                }
              >
                <option value="">{translateNode('None')}</option>
                {table
                  .getAllLeafColumns()
                  .filter((column) => column.getCanSort())
                  .map((column) => (
                    <option key={column.id} value={column.id}>
                      {translateNode(labels[column.id])}
                    </option>
                  ))}
              </Select>
            </label>
          )}
          {options.grouping && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setGrouping([]);
                setExpanded({});
              }}
            >
              {translateNode('Clear grouping')}
            </Button>
          )}
          {options.visibility && (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button
                  variant="outline"
                  aria-label={
                    translateString('Show columns') + ' — ' + translateString(options.title)
                  }
                >
                  <Columns3 className="size-4" />
                  {translateNode('Columns')}
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  className="z-[70] min-w-48 rounded border border-border bg-surface p-1 text-ink shadow-lg"
                >
                  <DropdownMenu.CheckboxItem
                    checked={table
                      .getAllLeafColumns()
                      .filter((column) => column.getCanHide())
                      .every((column) => column.getIsVisible())}
                    onCheckedChange={(checked) =>
                      table.setColumnVisibility(
                        Object.fromEntries(
                          table
                            .getAllLeafColumns()
                            .map((column) => [
                              column.id,
                              column.getCanHide() ? Boolean(checked) : true,
                            ]),
                        ),
                      )
                    }
                    onSelect={(e) => e.preventDefault()}
                    className="relative rounded py-2 pe-3 ps-8 text-sm outline-none focus:bg-subtle"
                  >
                    <DropdownMenu.ItemIndicator className="absolute start-2">
                      <Check className="size-4" />
                    </DropdownMenu.ItemIndicator>
                    {translateNode('Toggle all columns')}
                  </DropdownMenu.CheckboxItem>
                  {table
                    .getAllLeafColumns()
                    .filter((column) => column.getCanHide())
                    .map((column) => (
                      <DropdownMenu.CheckboxItem
                        key={column.id}
                        checked={column.getIsVisible()}
                        onCheckedChange={(checked) => column.toggleVisibility(Boolean(checked))}
                        onSelect={(e) => e.preventDefault()}
                        className="relative rounded py-2 pe-3 ps-8 text-sm outline-none focus:bg-subtle"
                      >
                        <DropdownMenu.ItemIndicator className="absolute start-2">
                          <Check className="size-4" />
                        </DropdownMenu.ItemIndicator>
                        {translateNode(labels[column.id])}
                      </DropdownMenu.CheckboxItem>
                    ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          )}
          {options.resizing && (
            <Button variant="outline" size="sm" onClick={() => table.resetColumnSizing()}>
              {translateNode('Reset column widths')}
            </Button>
          )}
          {options.umbrella && (
            <Button onClick={() => setDialog({ mode: 'create', row: null })}>
              <Plus className="size-4" />
              {translateNode('Add Record')}
            </Button>
          )}
        </div>
      )}
      {options.drag && (
        <p className="px-5 py-3 text-xs text-muted">
          {translateNode(
            options.drag === 'rows'
              ? 'Drag a row handle or use arrow keys to reorder rows.'
              : 'Drag a column header or use Alt + arrow keys to reorder columns.',
          )}
        </p>
      )}
      {options.virtual && (
        <p className="px-5 py-3 text-xs text-muted">
          {translateNode(data.length)} {translateNode('sample records')} ·{' '}
          {translateNode(
            options.virtual === 'infinite' ? Math.min(loaded, model.length) : shown.length,
          )}{' '}
          {translateNode(options.virtual === 'infinite' ? 'loaded' : 'rows rendered')}
        </p>
      )}
      {notice && (
        <p role="status" className="border-b border-border px-5 py-2 text-sm text-primary">
          {translateNode(notice)}
        </p>
      )}
      {options.pagination === 'top' && <TablePagination table={table} title={options.title} />}
      {options.selection && (
        <div className="flex items-center justify-between gap-3 bg-primary-soft px-5 py-2 text-sm text-primary">
          <span>
            {translateNode(selected.length)} {translateNode('row(s) selected')}
          </span>
          {selected.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setSelection({})}>
              {translateNode('Clear selection')}
            </Button>
          )}
        </div>
      )}
      <div
        ref={scrollRef}
        className={`rt-scroll overflow-auto ${options.sticky || options.virtual ? 'max-h-[520px]' : ''}`}
        style={options.virtual ? { height: 520 } : undefined}
        onScroll={(e) => {
          if (!options.virtual) return;
          const element = e.currentTarget;
          setScrollTop(element.scrollTop);
          if (
            options.virtual === 'infinite' &&
            element.scrollHeight - element.scrollTop - element.clientHeight < 150
          )
            setLoaded((count) => Math.min(data.length, count + 25));
        }}
      >
        <table
          className={`rt-table ${options.compact ? 'rt-compact' : ''} ${options.striped ? 'rt-striped' : ''} ${dense ? 'rt-dense' : ''} ${options.sticky || options.virtual ? 'rt-sticky' : ''} ${options.virtual ? 'rt-virtual' : ''}`}
          aria-label={translateString(options.title)}
          style={{
            width: table.getTotalSize(),
            minWidth: '100%',
            tableLayout: options.resizing ? 'fixed' : undefined,
          }}
        >
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th
                    key={header.id}
                    scope="col"
                    style={{
                      width: header.getSize(),
                      position:
                        options.sticky && header.column.id === 'name' ? 'sticky' : undefined,
                      left: options.sticky && header.column.id === 'name' ? 0 : undefined,
                      zIndex: options.sticky && header.column.id === 'name' ? 4 : undefined,
                    }}
                    aria-sort={
                      header.column.getCanSort()
                        ? header.column.getIsSorted() === 'asc'
                          ? 'ascending'
                          : header.column.getIsSorted() === 'desc'
                            ? 'descending'
                            : 'none'
                        : undefined
                    }
                    onDragOver={options.drag === 'columns' ? (e) => e.preventDefault() : undefined}
                    onDrop={
                      options.drag === 'columns'
                        ? (e) => {
                            e.preventDefault();
                            if (drag.current?.kind === 'column')
                              table.setColumnOrder(
                                reorderIds(order, drag.current.id, header.column.id),
                              );
                            drag.current = null;
                            setNotice('Column order updated.');
                          }
                        : undefined
                    }
                  >
                    <div className="relative flex items-center gap-2">
                      {options.grouping && header.column.getCanGroup() && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 shrink-0"
                          aria-label={
                            translateString('Group by') +
                            ' ' +
                            translateString(labels[header.column.id])
                          }
                          aria-pressed={header.column.getIsGrouped()}
                          onClick={() => {
                            header.column.toggleGrouping();
                            setExpanded({});
                          }}
                        >
                          <Layers
                            className={`size-3 ${header.column.getIsGrouped() ? 'text-primary' : ''}`}
                          />
                        </Button>
                      )}
                      {options.drag === 'columns' ? (
                        <button
                          type="button"
                          draggable
                          onDragStart={(e) => {
                            drag.current = { kind: 'column', id: header.column.id };
                            e.dataTransfer.setData('text/plain', header.column.id);
                          }}
                          onDragEnd={() => {
                            drag.current = null;
                          }}
                          onKeyDown={(e) => {
                            if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                              e.preventDefault();
                              moveColumn(header.column.id, e.key === 'ArrowLeft' ? -1 : 1);
                            }
                          }}
                          aria-label={
                            translateString('Move column') +
                            ' ' +
                            translateString(labels[header.column.id])
                          }
                          className="flex cursor-grab items-center gap-2 uppercase outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <GripVertical className="size-3" />
                          {translateNode(
                            flexRender(header.column.columnDef.header, header.getContext()),
                          )}
                        </button>
                      ) : header.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="flex items-center gap-2 uppercase outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          {translateNode(
                            flexRender(header.column.columnDef.header, header.getContext()),
                          )}
                          {header.column.getIsSorted() === 'asc' ? (
                            <ArrowUp className="size-3" />
                          ) : header.column.getIsSorted() === 'desc' ? (
                            <ArrowDown className="size-3" />
                          ) : (
                            <ArrowUpDown className="size-3 text-muted" />
                          )}
                        </button>
                      ) : (
                        translateNode(
                          flexRender(header.column.columnDef.header, header.getContext()),
                        )
                      )}
                    </div>
                    {options.filtering && header.column.getCanFilter() && (
                      <div className="mt-3 normal-case">
                        {['age', 'visits', 'progress'].includes(header.column.id) ? (
                          <div className="flex gap-1">
                            {[0, 1].map((index) => (
                              <Input
                                key={index}
                                aria-label={
                                  translateString(index === 0 ? 'Minimum' : 'Maximum') +
                                  ' ' +
                                  translateString(labels[header.column.id])
                                }
                                type="number"
                                className="h-8 w-20 text-xs"
                                placeholder={translateString(index === 0 ? 'Min' : 'Max')}
                                value={
                                  (
                                    header.column.getFilterValue() as
                                      [number | undefined, number | undefined] | undefined
                                  )?.[index] ?? ''
                                }
                                onChange={(e) => {
                                  const range = [
                                    ...((header.column.getFilterValue() as [
                                      number | undefined,
                                      number | undefined,
                                    ]) ?? [undefined, undefined]),
                                  ];
                                  range[index] =
                                    e.target.value === '' ? undefined : Number(e.target.value);
                                  header.column.setFilterValue(range);
                                  setPagination((p) => ({ ...p, pageIndex: 0 }));
                                }}
                              />
                            ))}
                          </div>
                        ) : header.column.id === 'status' ? (
                          <Select
                            aria-label={translateString('Filter Status')}
                            className="h-8 w-full text-xs"
                            value={String(header.column.getFilterValue() ?? '')}
                            onChange={(e) =>
                              header.column.setFilterValue(e.target.value || undefined)
                            }
                          >
                            <option value="">{translateNode('All')}</option>
                            {['Single', 'Relationship', 'Complicated'].map((status) => (
                              <option key={status} value={status}>
                                {translateNode(status)}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <Input
                            className="h-8 text-xs"
                            aria-label={
                              translateString('Search') +
                              ' ' +
                              translateString(labels[header.column.id])
                            }
                            placeholder={
                              translateString('Search') +
                              ' ' +
                              translateString(labels[header.column.id])
                            }
                            value={String(header.column.getFilterValue() ?? '')}
                            onChange={(e) => {
                              header.column.setFilterValue(e.target.value);
                              setPagination((p) => ({ ...p, pageIndex: 0 }));
                            }}
                          />
                        )}
                      </div>
                    )}
                    {options.resizing && header.column.getCanResize() && (
                      <div
                        role="separator"
                        aria-orientation="vertical"
                        aria-label={
                          translateString('Resize') +
                          ' ' +
                          translateString(labels[header.column.id])
                        }
                        aria-valuenow={header.getSize()}
                        aria-valuemin={header.column.columnDef.minSize ?? 90}
                        aria-valuemax={600}
                        tabIndex={0}
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        onDoubleClick={() => header.column.resetSize()}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                            e.preventDefault();
                            table.setColumnSizing((current) => ({
                              ...current,
                              [header.column.id]: Math.min(
                                600,
                                Math.max(
                                  header.column.columnDef.minSize ?? 90,
                                  header.getSize() + (e.key === 'ArrowRight' ? 10 : -10),
                                ),
                              ),
                            }));
                          }
                        }}
                        className="rt-resizer"
                      />
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {options.virtual && window.top > 0 && (
              <tr aria-hidden="true" className="rt-spacer">
                <td
                  colSpan={Math.max(1, table.getVisibleLeafColumns().length)}
                  style={{ height: window.top, padding: 0, border: 0 }}
                />
              </tr>
            )}
            {table.getVisibleLeafColumns().length === 0 ? (
              <tr>
                <td>{translateNode('No columns selected')}</td>
              </tr>
            ) : (
              shown.map((row) => (
                <Fragment key={row.id}>
                  <tr
                    data-row-id={row.original.id}
                    className={`${row.getIsSelected() ? 'rt-selected' : ''} ${row.getIsGrouped() ? 'rt-grouped' : ''}`}
                    onDragOver={options.drag === 'rows' ? (e) => e.preventDefault() : undefined}
                    onDrop={
                      options.drag === 'rows'
                        ? (e) => {
                            e.preventDefault();
                            const from =
                              drag.current?.kind === 'row'
                                ? drag.current.id
                                : e.dataTransfer.getData('text/plain');
                            dropRow(from, row.original.id);
                            drag.current = null;
                          }
                        : undefined
                    }
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        style={{
                          width: cell.column.getSize(),
                          position:
                            options.sticky && cell.column.id === 'name' ? 'sticky' : undefined,
                          left: options.sticky && cell.column.id === 'name' ? 0 : undefined,
                          zIndex: options.sticky && cell.column.id === 'name' ? 1 : undefined,
                          paddingInlineStart:
                            cell.column.id === 'name' && row.depth > 0
                              ? 24 + row.depth * 20
                              : undefined,
                        }}
                      >
                        {cell.getIsGrouped() ? (
                          <button
                            type="button"
                            className="flex items-center gap-2 font-semibold"
                            aria-label={
                              translateString(
                                row.getIsExpanded() ? 'Collapse group' : 'Expand group',
                              ) +
                              ' ' +
                              String(cell.getValue())
                            }
                            aria-expanded={row.getIsExpanded()}
                            onClick={row.getToggleExpandedHandler()}
                          >
                            {row.getIsExpanded() ? (
                              <ChevronDown className="size-4" />
                            ) : (
                              <ChevronRight className="size-4" />
                            )}
                            {translateNode(String(cell.getValue()))} (
                            {translateNode(row.subRows.length)})
                          </button>
                        ) : options.grouping && cell.getIsAggregated() ? (
                          <span>
                            {translateNode(
                              typeof cell.getValue() === 'number'
                                ? Math.round(Number(cell.getValue()) * 10) / 10
                                : String(cell.getValue() ?? ''),
                            )}
                          </span>
                        ) : options.grouping && cell.getIsPlaceholder() ? null : cell.column.id ===
                          'actions' ? (
                          editingId === row.original.id ? (
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                aria-label={translateString('Save row') + ' ' + row.original.id}
                                disabled={saving}
                                onClick={() => {
                                  void saveRow();
                                }}
                              >
                                <Save className="size-4 text-success" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                aria-label={
                                  translateString('Cancel editing') + ' ' + row.original.id
                                }
                                disabled={saving}
                                onClick={() => {
                                  setEditingId(null);
                                  setDraft(null);
                                  setErrors({});
                                }}
                              >
                                <X className="size-4 text-danger" />
                              </Button>
                              {errors.save && (
                                <span role="alert" className="text-xs text-danger">
                                  {translateNode(errors.save)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex gap-1">
                              {options.umbrella && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={
                                    translateString('View record') + ' ' + row.original.id
                                  }
                                  onClick={() => setDialog({ mode: 'view', row: row.original })}
                                >
                                  <Eye className="size-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={translateString('Edit row') + ' ' + row.original.id}
                                disabled={Boolean(editingId) && editingId !== row.original.id}
                                onClick={() => beginEdit(row.original)}
                              >
                                <Pencil className="size-4 text-primary" />
                              </Button>
                              {options.umbrella && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={
                                    translateString('Delete record') + ' ' + row.original.id
                                  }
                                  onClick={() => setDialog({ mode: 'delete', row: row.original })}
                                >
                                  <Trash2 className="size-4 text-danger" />
                                </Button>
                              )}
                            </div>
                          )
                        ) : (options.editing === 'cell' || editingId === row.original.id) &&
                          editableFields.has(cell.column.id) ? (
                          editInput(row.original, cell.column.id as keyof TableRowValues)
                        ) : (
                          translateNode(flexRender(cell.column.columnDef.cell, cell.getContext()))
                        )}
                      </td>
                    ))}
                  </tr>
                  {row.getIsExpanded() &&
                    options.expansion &&
                    options.expansion !== 'tree' &&
                    !row.getIsGrouped() && (
                      <tr className="rt-detail">
                        <td colSpan={table.getVisibleLeafColumns().length}>{renderDetails(row)}</td>
                      </tr>
                    )}
                </Fragment>
              ))
            )}
            {!model.length && table.getVisibleLeafColumns().length > 0 && (
              <tr>
                <td
                  colSpan={table.getVisibleLeafColumns().length}
                  className="py-12 text-center text-muted"
                >
                  <Search className="mx-auto mb-3 size-8 text-muted" />
                  {translateNode('No records found')}
                </td>
              </tr>
            )}
            {options.virtual && window.bottom > 0 && (
              <tr aria-hidden="true" className="rt-spacer">
                <td
                  colSpan={table.getVisibleLeafColumns().length}
                  style={{ height: window.bottom, padding: 0, border: 0 }}
                />
              </tr>
            )}
          </tbody>
          {options.footer && (
            <tfoot>
              {table.getFooterGroups().map((group) => (
                <tr key={group.id}>
                  {group.headers.map((header) => (
                    <th key={header.id}>{translateNode(labels[header.column.id])}</th>
                  ))}
                </tr>
              ))}
            </tfoot>
          )}
        </table>
      </div>
      {options.pagination === 'bottom' && <TablePagination table={table} title={options.title} />}
      {options.selection && (
        <details className="border-t border-border p-4">
          <summary className="cursor-pointer text-sm font-medium">
            {translateNode('Selected records')} ({translateNode(selected.length)})
          </summary>
          <ul className="mt-3 space-y-1 text-sm text-muted">
            {selected.map((row) => (
              <li key={row.id}>
                {row.original.name} — {row.original.email}
              </li>
            ))}
          </ul>
        </details>
      )}
      {dialog && (
        <RecordDialog
          row={dialog.row}
          mode={dialog.mode}
          onClose={() => setDialog(null)}
          onCreate={onCreate}
          onDelete={onDelete}
        />
      )}
    </Card>
  );
}
