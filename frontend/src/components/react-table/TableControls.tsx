import { useEffect, useRef, type InputHTMLAttributes } from 'react';
import type { Table } from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download } from 'lucide-react';
import { Button, Input, Select } from '../ui/primitives';
import { translateNode, translateString } from '../../lib/localization';
import { tableCsv, type ReactTableRow, type TableRowValues } from '../../lib/reactTable';
export function TableCheckbox({
  mixed,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { mixed?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(mixed);
  }, [mixed]);
  return <input ref={ref} type="checkbox" className="size-4 accent-primary" {...props} />;
}
export function ExportTable({
  rows,
  fields,
  title,
}: {
  rows: ReactTableRow[];
  fields: (keyof TableRowValues | 'id')[];
  title: string;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={translateString('CSV Export') + ' — ' + translateString(title)}
      title={translateString('CSV Export')}
      disabled={!rows.length || !fields.length}
      onClick={() => {
        const url = URL.createObjectURL(
          new Blob([tableCsv(rows, fields)], { type: 'text/csv;charset=utf-8' }),
        );
        const link = document.createElement('a');
        link.href = url;
        link.download = title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.csv';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}
    >
      <Download className="size-5 text-muted" />
    </Button>
  );
}
export function TablePagination({ table, title }: { table: Table<ReactTableRow>; title: string }) {
  const { pageIndex, pageSize } = table.getState().pagination;
  const count = Math.max(1, table.getPageCount());
  const start = Math.min(Math.max(pageIndex - 2, 0), Math.max(0, count - 5));
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border px-5 py-4 text-sm">
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2">
          {translateNode('Row per page')}
          <Select
            aria-label={translateString('Row per page') + ' — ' + translateString(title)}
            value={pageSize}
            onChange={(e) =>
              table.setPagination({ pageIndex: 0, pageSize: Number(e.target.value) })
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
            aria-label={translateString('Go to page') + ' — ' + translateString(title)}
            type="number"
            min={1}
            max={count}
            value={pageIndex + 1}
            className="w-16"
            onChange={(e) => {
              const next = Number(e.target.value);
              if (Number.isInteger(next) && next >= 1 && next <= count)
                table.setPageIndex(next - 1);
            }}
          />
        </label>
      </div>
      <nav
        aria-label={translateString('Pagination') + ' — ' + translateString(title)}
        className="flex gap-1"
      >
        <Button
          size="icon"
          variant="ghost"
          disabled={!table.getCanPreviousPage()}
          aria-label={translateString('Go to first page')}
          onClick={() => table.firstPage()}
        >
          <ChevronsLeft className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          disabled={!table.getCanPreviousPage()}
          aria-label={translateString('Go to previous page')}
          onClick={() => table.previousPage()}
        >
          <ChevronLeft className="size-4" />
        </Button>
        {Array.from({ length: Math.min(5, count) }, (_, i) => i + start).map((page) => (
          <Button
            key={page}
            size="icon"
            variant={page === pageIndex ? 'default' : 'ghost'}
            aria-current={page === pageIndex ? 'page' : undefined}
            aria-label={translateString('Page') + ` ${page + 1}`}
            onClick={() => table.setPageIndex(page)}
          >
            {translateNode(page + 1)}
          </Button>
        ))}
        <Button
          size="icon"
          variant="ghost"
          disabled={!table.getCanNextPage()}
          aria-label={translateString('Go to next page')}
          onClick={() => table.nextPage()}
        >
          <ChevronRight className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          disabled={!table.getCanNextPage()}
          aria-label={translateString('Go to last page')}
          onClick={() => table.lastPage()}
        >
          <ChevronsRight className="size-4" />
        </Button>
      </nav>
    </div>
  );
}
