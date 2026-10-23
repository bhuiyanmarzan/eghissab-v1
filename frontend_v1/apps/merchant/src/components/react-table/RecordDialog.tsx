import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input, Select } from '../ui/primitives';
import { tableRowSchema, type ReactTableRow, type TableRowValues } from '../../lib/reactTable';
import { translateNode, translateString } from '../../lib/localization';
import { X } from 'lucide-react';
export function RecordDialog({
  row,
  mode,
  onClose,
  onCreate,
  onDelete,
}: {
  row: ReactTableRow | null;
  mode: 'view' | 'create' | 'delete';
  onClose: () => void;
  onCreate: (values: TableRowValues) => Promise<boolean>;
  onDelete: (row: ReactTableRow) => Promise<boolean>;
}) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TableRowValues>({
    resolver: zodResolver(tableRowSchema),
    defaultValues: {
      name: '',
      email: '',
      age: 18,
      role: 'Developer',
      visits: 0,
      status: 'Single',
      progress: 0,
      phone: '',
      country: '',
      address: '',
    },
  });
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/40" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-[90] max-h-[90dvh] w-[560px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-surface p-6 text-ink shadow-xl"
        >
          <div className="mb-5 flex justify-between gap-3">
            <Dialog.Title className="text-xl font-semibold">
              {translateNode(
                mode === 'create'
                  ? 'Add Record'
                  : mode === 'delete'
                    ? 'Delete record?'
                    : 'Record Details',
              )}
            </Dialog.Title>
            <Button
              variant="ghost"
              size="icon"
              disabled={saving}
              aria-label={translateString('Close dialog')}
              onClick={onClose}
            >
              <X className="size-4" />
            </Button>
          </div>
          {mode === 'create' ? (
            <form
              noValidate
              onSubmit={(e) => {
                e.stopPropagation();
                void handleSubmit(async (values) => {
                  setSaving(true);
                  const ok = await onCreate(values);
                  setSaving(false);
                  if (ok) onClose();
                  else setError('Unable to save changes. Try again.');
                })(e);
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                {(
                  [
                    'name',
                    'email',
                    'age',
                    'role',
                    'visits',
                    'progress',
                    'phone',
                    'country',
                  ] as const
                ).map((field) => (
                  <label key={field} className="text-sm">
                    <span className="mb-1 block">
                      {translateNode(
                        {
                          name: 'Name',
                          email: 'Email',
                          age: 'Age',
                          role: 'Role',
                          visits: 'Visits',
                          progress: 'Profile Progress',
                          phone: 'Contact',
                          country: 'Country',
                        }[field],
                      )}
                    </span>
                    <Input
                      {...register(
                        field,
                        ['age', 'visits', 'progress'].includes(field)
                          ? { valueAsNumber: true }
                          : {},
                      )}
                      type={
                        ['age', 'visits', 'progress'].includes(field)
                          ? 'number'
                          : field === 'email'
                            ? 'email'
                            : 'text'
                      }
                      aria-invalid={Boolean(errors[field])}
                    />
                    {errors[field] && (
                      <span role="alert" className="text-xs text-danger">
                        {translateNode(errors[field]?.message)}
                      </span>
                    )}
                  </label>
                ))}
                <label className="text-sm">
                  <span className="mb-1 block">{translateNode('Status')}</span>
                  <Select {...register('status')} className="w-full">
                    {['Single', 'Relationship', 'Complicated'].map((status) => (
                      <option key={status} value={status}>
                        {translateNode(status)}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block">{translateNode('Address')}</span>
                  <Input {...register('address')} />
                </label>
              </div>
              {error && (
                <p role="alert" className="mt-3 text-sm text-danger">
                  {translateNode(error)}
                </p>
              )}
              <div className="mt-6 flex justify-end gap-3">
                <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
                  {translateNode('Cancel')}
                </Button>
                <Button type="submit" disabled={saving}>
                  {translateNode(saving ? 'Saving...' : 'Save')}
                </Button>
              </div>
            </form>
          ) : mode === 'delete' ? (
            <>
              <p className="text-sm">
                {row?.name} — {row?.email}
              </p>
              <p className="mt-3 text-sm text-muted">
                {translateNode('Deleted records can be restored.')}
              </p>
              {error && (
                <p role="alert" className="mt-3 text-sm text-danger">
                  {translateNode(error)}
                </p>
              )}
              <div className="mt-6 flex justify-end gap-3">
                <Button variant="outline" disabled={saving} onClick={onClose}>
                  {translateNode('Cancel')}
                </Button>
                <Button
                  variant="danger"
                  disabled={saving}
                  onClick={async () => {
                    if (!row) return;
                    setSaving(true);
                    const ok = await onDelete(row);
                    setSaving(false);
                    if (ok) onClose();
                    else setError('Unable to save changes. Try again.');
                  }}
                >
                  {translateNode('Delete')}
                </Button>
              </div>
            </>
          ) : (
            <dl className="grid gap-4 sm:grid-cols-2">
              {row &&
                (
                  [
                    'name',
                    'email',
                    'age',
                    'role',
                    'visits',
                    'status',
                    'progress',
                    'phone',
                    'country',
                    'address',
                  ] as const
                ).map((field) => (
                  <div key={field}>
                    <dt className="text-xs capitalize text-muted">
                      {translateNode(
                        {
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
                        }[field],
                      )}
                    </dt>
                    <dd className="mt-1 break-words text-sm">
                      {field === 'status'
                        ? translateNode(row[field])
                        : typeof row[field] === 'number'
                          ? translateNode(row[field])
                          : row[field]}
                    </dd>
                  </div>
                ))}
            </dl>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
