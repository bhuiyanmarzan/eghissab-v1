import { useTranslation } from 'react-i18next';
import { translateNode, translateString } from '../lib/localization';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, SortingState, useReactTable } from '@tanstack/react-table';
import { ArrowUpDown, Download, Eye, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Customer, getCustomers } from '../api/client';
import { Avatar, Badge, Button, Card, Input, Select, Skeleton } from '../components/ui/primitives';

export function TablePage({ customerMode = false }: { customerMode?: boolean }) {
  useTranslation();
  const { data = [], isLoading } = useQuery({ queryKey: ['customers'], queryFn: getCustomers });
  const [filter, setFilter] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const columns = useMemo<ColumnDef<Customer>[]>(() => [
    { id: 'select', header: () => <input type="checkbox" aria-label={translateString("Select all")} />, cell: () => <input type="checkbox" aria-label={translateString("Select row")} /> },
    { accessorKey: 'name', header: 'User info', cell: ({ row }) => <div className="flex items-center gap-3"><Avatar name={row.original.name} /><div><p className="font-medium">{row.original.name}</p><p className="text-xs text-muted">{row.original.email}</p></div></div> },
    { accessorKey: 'phone', header: 'Contact' }, { accessorKey: 'age', header: 'Age' }, { accessorKey: 'country', header: 'Country' },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => { const status = getValue<Customer['status']>(); return <Badge tone={status === 'Complete' ? 'green' : status === 'Pending' ? 'blue' : 'red'}>{translateNode(status)}</Badge>; } },
    { id: 'actions', header: 'Actions', cell: () => <div className="flex gap-1"><Button variant="ghost" size="icon" title={translateString("View")}><Eye className="size-4"/></Button><Button variant="ghost" size="icon" title={translateString("Edit")}><Pencil className="size-4 text-primary"/></Button><Button variant="ghost" size="icon" title={translateString("Delete")}><Trash2 className="size-4 text-danger"/></Button></div> },
  ], []);
  const table = useReactTable({ data, columns, state: { globalFilter: filter, sorting }, onGlobalFilterChange: setFilter, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(), initialState: { pagination: { pageSize: customerMode ? 10 : 8 } } });
  return <Card>
    <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
      <div className="relative me-auto min-w-60"><Search className="absolute start-3 top-3 size-4 text-muted"/><Input value={filter} onChange={(e)=>setFilter(e.target.value)} placeholder={translateString(`Search ${data.length} records...`)} className="ps-9"/></div>
      <Select aria-label={translateString("Status")}><option value="All Status">{translateNode("All Status")}</option><option value="Complete">{translateNode("Complete")}</option><option value="Pending">{translateNode("Pending")}</option></Select>
      <Select aria-label={translateString("Sort")}><option value="Sort by (#)">{translateNode("Sort by (#)")}</option><option value="Name">{translateNode("Name")}</option><option value="Age">{translateNode("Age")}</option></Select>
      <Button><Plus className="size-4"/> {translateNode("Add Customer")}</Button><Button variant="ghost" size="icon" title={translateString("Download")}><Download className="size-4"/></Button>
    </div>
    <div className="overflow-x-auto"><table className="data-table"><thead>{table.getHeaderGroups().map((group)=><tr key={group.id}>{group.headers.map((header)=><th key={header.id}><button className="flex items-center gap-1" onClick={header.column.getToggleSortingHandler()}>{translateNode(flexRender(header.column.columnDef.header, header.getContext()))}{header.column.getCanSort()&&<ArrowUpDown className="size-3 text-muted"/>}</button></th>)}</tr>)}</thead><tbody>{isLoading ? Array.from({length:8}).map((_,i)=><tr key={i}><td colSpan={7}><Skeleton className="h-8"/></td></tr>) : table.getRowModel().rows.map((row)=><tr key={row.id}>{row.getVisibleCells().map((cell)=><td key={cell.id}>{translateNode(flexRender(cell.column.columnDef.cell, cell.getContext()))}</td>)}</tr>)}</tbody></table></div>
    <div className="flex items-center justify-between border-t border-border p-4 text-sm"><span className="text-muted">{translateNode("Page ")}{translateNode(table.getState().pagination.pageIndex + 1)} {translateNode("of ")}{translateNode(table.getPageCount())}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={!table.getCanPreviousPage()} onClick={()=>table.previousPage()}>{translateNode("Previous")}</Button><Button variant="outline" size="sm" disabled={!table.getCanNextPage()} onClick={()=>table.nextPage()}>{translateNode("Next")}</Button></div></div>
  </Card>;
}
