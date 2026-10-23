import { useEffect, useRef, useState } from 'react';
import { Input, Select } from '../ui/primitives';
import { tableRowSchema, type ReactTableRow, type TableRowValues } from '../../lib/reactTable';
import { translateNode, translateString } from '../../lib/localization';

export function EditableTableCell({
  row,
  field,
  onUpdate,
}: {
  row: ReactTableRow;
  field: keyof TableRowValues;
  onUpdate: (id: string, patch: Partial<TableRowValues>) => Promise<boolean>;
}) {
  const value = row[field];
  const [text, setText] = useState(String(value));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const cancel = useRef(false);
  useEffect(() => {
    setText(String(value));
  }, [value]);
  const save = async () => {
    if (cancel.current) {
      cancel.current = false;
      return;
    }
    if (text === String(value)) return;
    const parsed = tableRowSchema.shape[field].safeParse(
      typeof value === 'number' ? Number(text) : text,
    );
    if (!text.trim() || !parsed.success) {
      setError(parsed.success ? 'Name is required' : parsed.error.issues[0].message);
      return;
    }
    setSaving(true);
    const success = await onUpdate(row.id, { [field]: parsed.data });
    setSaving(false);
    setError(success ? '' : 'Unable to save changes. Try again.');
  };
  const label =
    translateString(
      field === 'name'
        ? 'Name'
        : field === 'email'
          ? 'Email'
          : field === 'age'
            ? 'Age'
            : field === 'visits'
              ? 'Visits'
              : field === 'status'
                ? 'Status'
                : 'Role',
    ) + ` — ${row.id}`;
  const common = {
    value: text,
    disabled: saving,
    'aria-label': label,
    'aria-invalid': Boolean(error),
    onBlur: () => {
      void save();
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
      if (e.key === 'Enter') e.currentTarget.blur();
      if (e.key === 'Escape') {
        cancel.current = true;
        setText(String(value));
        setError('');
        e.currentTarget.blur();
      }
    },
  };
  return (
    <div>
      {field === 'status' ? (
        <Select
          {...common}
          className="w-full"
          onChange={(e) => {
            setText(e.target.value);
            setError('');
          }}
        >
          {['Single', 'Relationship', 'Complicated'].map((status) => (
            <option key={status} value={status}>
              {translateNode(status)}
            </option>
          ))}
        </Select>
      ) : (
        <Input
          {...common}
          type={typeof value === 'number' ? 'number' : field === 'email' ? 'email' : 'text'}
          onChange={(e) => {
            setText(e.target.value);
            setError('');
          }}
          className="min-w-24"
        />
      )}
      {error && (
        <span role="alert" className="mt-1 block text-xs text-danger">
          {translateNode(error)}
        </span>
      )}
    </div>
  );
}
