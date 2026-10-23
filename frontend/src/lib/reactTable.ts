import { z } from 'zod';
export const tableRowSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120, 'Use at most 120 characters'),
  email: z.email('Enter a valid email'),
  age: z
    .number()
    .int('Age must be a whole number')
    .min(18, 'Age must be at least 18')
    .max(100, 'Age must be at most 100'),
  role: z.string().trim().min(1, 'Role is required').max(120, 'Use at most 120 characters'),
  visits: z.number().int('Visits must be a whole number').min(0, 'Visits cannot be negative'),
  status: z.enum(['Single', 'Relationship', 'Complicated']),
  progress: z
    .number()
    .min(0, 'Enter a percentage from 0 to 100')
    .max(100, 'Enter a percentage from 0 to 100'),
  phone: z.string(),
  country: z.string(),
  address: z.string(),
});
export type TableRowValues = z.infer<typeof tableRowSchema>;
export type ReactTableRow = TableRowValues & {
  id: string;
  tenantId: string;
  deleted: boolean;
  children?: ReactTableRow[];
};
export const reactTableFeatures = [
  'basic',
  'dense',
  'sorting',
  'filtering',
  'grouping',
  'pagination',
  'row-selection',
  'expanding',
  'editable',
  'drag-drop',
  'column-visibility',
  'column-resizing',
  'sticky-table',
  'umbrella',
  'empty',
  'virtualized',
] as const;
export type ReactTableFeature = (typeof reactTableFeatures)[number];
export const reactTableTitles: Record<ReactTableFeature, string> = {
  basic: 'Basic',
  dense: 'Dense',
  sorting: 'Sorting',
  filtering: 'Filtering',
  grouping: 'Grouping',
  pagination: 'Pagination',
  'row-selection': 'Row Selection',
  expanding: 'Expanding',
  editable: 'Editable',
  'drag-drop': 'Drag & Drop',
  'column-visibility': 'Column Visibility',
  'column-resizing': 'Column Resizing',
  'sticky-table': 'Sticky',
  umbrella: 'Umbrella',
  empty: 'Empty',
  virtualized: 'Virtualized',
};
export function reorderIds(ids: string[], from: string, to: string) {
  const source = ids.indexOf(from);
  const destination = ids.indexOf(to);
  if (source < 0 || destination < 0 || source === destination) return ids;
  const next = [...ids];
  next.splice(source, 1);
  next.splice(destination, 0, from);
  return next;
}
export function orderTableRows(rows: ReactTableRow[], order: string[]) {
  const rank = new Map(order.map((id, index) => [id, index]));
  return [...rows].sort(
    (a, b) => (rank.get(a.id) ?? order.length) - (rank.get(b.id) ?? order.length),
  );
}
export function tableCsv(rows: ReactTableRow[], fields: (keyof TableRowValues | 'id')[]) {
  const quote = (value: string | number) => {
    const text = String(value);
    return `"${(/^[\s]*[=+\-@]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`;
  };
  return (
    '\uFEFF' +
    [
      fields.map((field) => quote(field)),
      ...rows.map((row) => fields.map((field) => quote(row[field]))),
    ]
      .map((row) => row.join(','))
      .join('\r\n')
  );
}
export function virtualWindow(scrollTop: number, count: number, height = 520, rowHeight = 52) {
  const start = Math.min(
    Math.max(0, Math.floor(Math.max(0, scrollTop - 62) / rowHeight) - 4),
    Math.max(0, count - 1),
  );
  const end = Math.min(count, start + Math.ceil(height / rowHeight) + 8);
  return {
    start: Math.min(start, Math.max(0, count - 1)),
    end,
    top: start * rowHeight,
    bottom: Math.max(0, (count - end) * rowHeight),
  };
}
