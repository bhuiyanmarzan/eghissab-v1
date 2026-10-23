import { useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Camera, Trash2, X } from 'lucide-react';
import { Avatar, Button, Input, Select } from '../ui/primitives';
import {
  customerDefaults,
  customerSchema,
  skillOptions,
  type CustomerRecord,
  type CustomerValues,
} from '../../lib/customer';
import { translateNode as t, translateString as ts } from '../../lib/localization';
export function CustomerForm({
  row,
  onClose,
  onSave,
  onDelete,
}: {
  row?: CustomerRecord;
  onClose: () => void;
  onSave: (values: CustomerValues, id?: string) => Promise<boolean>;
  onDelete: (row: CustomerRecord) => void;
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CustomerValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: customerDefaults(row),
  });
  const [error, setError] = useState('');
  const [skill, setSkill] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const avatar = watch('avatar');
  const skills = watch('skills');
  const addSkill = (value: string) => {
    const clean = value.trim();
    if (clean && clean.length <= 60 && !skills.includes(clean) && skills.length < 20)
      setValue('skills', [...skills, clean], { shouldValidate: true });
    setSkill('');
  };
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !isSubmitting && !uploading) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/40" />
        <Dialog.Content
          aria-describedby={undefined}
          className="customer-dialog fixed left-1/2 top-1/2 z-[90] max-h-[90dvh] w-[800px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-lg border border-border bg-surface text-ink shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-border px-6 py-5">
            <Dialog.Title className="text-xl font-semibold">
              {t(row ? 'Edit Customer' : 'New Customer')}
            </Dialog.Title>
            <Button
              variant="ghost"
              size="icon"
              aria-label={ts('Close dialog')}
              disabled={isSubmitting || uploading}
              onClick={onClose}
            >
              <X className="size-4" />
            </Button>
          </div>
          <form
            noValidate
            onSubmit={handleSubmit(async (values) => {
              setError('');
              if (await onSave(values, row?.id)) onClose();
              else setError('Unable to save customer. Try again.');
            })}
          >
            <fieldset
              disabled={isSubmitting || uploading}
              className="grid gap-6 p-6 md:grid-cols-[140px_1fr]"
            >
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  {avatar ? (
                    <img
                      src={avatar}
                      alt={ts('Customer avatar')}
                      className="size-24 rounded-full object-cover"
                    />
                  ) : (
                    <Avatar
                      name={`${watch('firstName')} ${watch('lastName')}`.trim() || 'Customer'}
                      size="lg"
                    />
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="absolute -bottom-2 -end-2 rounded-full"
                    aria-label={ts('Upload avatar')}
                    onClick={() => fileRef.current?.click()}
                  >
                    <Camera className="size-4" />
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                >
                  {t('Upload')}
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  aria-label={ts('Upload avatar file')}
                  className="sr-only"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (
                      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
                      file.size > 2 * 1024 * 1024
                    ) {
                      setError('Choose a PNG, JPEG or WebP image up to 2 MB.');
                      e.target.value = '';
                      return;
                    }
                    setUploading(true);
                    setError('');
                    try {
                      const result = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(String(reader.result));
                        reader.onerror = () => reject(new Error('read'));
                        reader.readAsDataURL(file);
                      });
                      setValue('avatar', result);
                    } catch {
                      setError('Unable to read image. Try another file.');
                    } finally {
                      setUploading(false);
                      e.target.value = '';
                    }
                  }}
                />
                {avatar && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setValue('avatar', '')}
                  >
                    {t('Remove image')}
                  </Button>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {(['firstName', 'lastName', 'email', 'age', 'fatherName', 'role'] as const).map(
                  (field) => (
                    <label key={field} className="text-sm">
                      <span className="mb-2 block">
                        {t(
                          {
                            firstName: 'First Name',
                            lastName: 'Last Name',
                            email: 'Email',
                            age: 'Age',
                            fatherName: 'Father Name',
                            role: 'Customer Role',
                          }[field],
                        )}
                      </span>
                      <Input
                        {...register(field, field === 'age' ? { valueAsNumber: true } : {})}
                        type={field === 'age' ? 'number' : field === 'email' ? 'email' : 'text'}
                        aria-label={ts(
                          {
                            firstName: 'First Name',
                            lastName: 'Last Name',
                            email: 'Email',
                            age: 'Age',
                            fatherName: 'Father Name',
                            role: 'Customer Role',
                            phone: 'Contact',
                            country: 'Country',
                          }[field],
                        )}
                        aria-invalid={!!errors[field]}
                        min={field === 'age' ? 18 : undefined}
                        max={field === 'age' ? 100 : undefined}
                      />
                      {errors[field] && (
                        <span role="alert" className="text-xs text-danger">
                          {t(errors[field]?.message)}
                        </span>
                      )}
                    </label>
                  ),
                )}
                <fieldset className="text-sm">
                  <legend className="mb-2">{t('Gender')}</legend>
                  <div className="flex h-10 items-center gap-5">
                    {(['Female', 'Male'] as const).map((g) => (
                      <label key={g} className="flex items-center gap-2">
                        <input
                          type="radio"
                          {...register('gender')}
                          value={g}
                          className="accent-primary"
                        />
                        {t(g)}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="text-sm">
                  <span className="mb-2 block">{t('Status')}</span>
                  <Select {...register('status')} className="w-full">
                    <option value="Canceled">{t('Rejected')}</option>
                    <option value="Complete">{t('Verified')}</option>
                    <option value="Pending">{t('Pending')}</option>
                  </Select>
                </label>
                {(['phone', 'country'] as const).map((field) => (
                  <label key={field} className="text-sm">
                    <span className="mb-2 block">
                      {t(field === 'phone' ? 'Contact' : 'Country')}
                    </span>
                    <Input
                      {...register(field)}
                      type={field === 'phone' ? 'tel' : 'text'}
                      aria-label={ts(
                        {
                          firstName: 'First Name',
                          lastName: 'Last Name',
                          email: 'Email',
                          age: 'Age',
                          fatherName: 'Father Name',
                          role: 'Customer Role',
                          phone: 'Contact',
                          country: 'Country',
                        }[field],
                      )}
                      aria-invalid={!!errors[field]}
                    />
                    {errors[field] && (
                      <span role="alert" className="text-xs text-danger">
                        {t(errors[field]?.message)}
                      </span>
                    )}
                  </label>
                ))}
                {(['location', 'about'] as const).map((field) => (
                  <label key={field} className="text-sm sm:col-span-2">
                    <span className="mb-2 block">
                      {t(field === 'location' ? 'Location' : 'About Customer')}
                    </span>
                    <textarea
                      {...register(field)}
                      rows={3}
                      className="w-full rounded-md border border-border bg-surface p-3 outline-none focus:border-primary"
                    />
                    {errors[field] && (
                      <span role="alert" className="text-xs text-danger">
                        {t(errors[field]?.message)}
                      </span>
                    )}
                  </label>
                ))}
                <div className="sm:col-span-2">
                  <label htmlFor="customer-skills" className="mb-2 block text-sm">
                    {t('Skills')}
                  </label>
                  <div className="rounded-md border border-border p-2">
                    <div className="flex flex-wrap gap-2">
                      {skills.map((s) => (
                        <span
                          key={s}
                          className="flex items-center gap-1 rounded bg-subtle px-2 py-1 text-xs"
                        >
                          {s}
                          <button
                            type="button"
                            aria-label={ts('Remove skill') + ' ' + s}
                            onClick={() =>
                              setValue(
                                'skills',
                                skills.filter((v) => v !== s),
                              )
                            }
                          >
                            <X className="size-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Input
                        id="customer-skills"
                        list="customer-skill-options"
                        value={skill}
                        onChange={(e) => setSkill(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addSkill(skill);
                          }
                        }}
                      />
                      <Button type="button" variant="outline" onClick={() => addSkill(skill)}>
                        {t('Add skill')}
                      </Button>
                    </div>
                    <datalist id="customer-skill-options">
                      {skillOptions
                        .filter((s) => !skills.includes(s))
                        .map((s) => (
                          <option key={s} value={s} />
                        ))}
                    </datalist>
                  </div>
                </div>
                {(['contactPublic', 'availableToHire'] as const).map((field) => (
                  <label
                    key={field}
                    className="flex items-center justify-between gap-4 sm:col-span-2"
                  >
                    <span>
                      <span className="block text-sm font-medium">
                        {t(
                          field === 'contactPublic'
                            ? 'Make Contact Info Public'
                            : 'Available to hire',
                        )}
                      </span>
                      <span className="block text-xs text-muted">
                        {t(
                          field === 'contactPublic'
                            ? 'Means that anyone viewing your profile will be able to see your contacts details'
                            : 'Toggling this will let your teammates know that you are available for acquiring new projects',
                        )}
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      role="switch"
                      {...register(field)}
                      aria-label={ts(
                        field === 'contactPublic'
                          ? 'Make Contact Info Public'
                          : 'Available to hire',
                      )}
                      className="customer-switch"
                    />
                  </label>
                ))}
              </div>
            </fieldset>
            {error && (
              <p role="alert" className="px-6 pb-4 text-sm text-danger">
                {t(error)}
              </p>
            )}
            <div className="flex items-center justify-end gap-3 border-t border-border p-5">
              {row && (
                <Button
                  type="button"
                  variant="ghost"
                  className="me-auto text-danger"
                  aria-label={ts('Delete Customer')}
                  disabled={isSubmitting || uploading}
                  onClick={() => onDelete(row)}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting || uploading}
                onClick={onClose}
              >
                {t('Cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting || uploading}>
                {t(isSubmitting ? 'Saving...' : row ? 'Edit' : 'Add')}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
