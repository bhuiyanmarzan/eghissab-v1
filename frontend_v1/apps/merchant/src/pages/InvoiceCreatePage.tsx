import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button, Card, CardContent, Input, Select } from '../components/ui/primitives';
import { InvoiceDateField } from '../components/invoice/InvoiceDateField';
import { InvoiceAddressDialog } from '../components/invoice/InvoiceAddressDialog';
import { InvoicePreviewDialog } from '../components/invoice/InvoicePreviewDialog';
import {
  emptyInvoiceItem,
  invoiceCurrencies,
  invoiceMoney,
  invoiceSchema,
  invoiceTotals,
  itemAmount,
  newInvoice,
  type InvoiceValues,
} from '../lib/invoice';
import { isBangla, translateNode, translateString } from '../lib/localization';
import { useInvoiceStore } from '../store/useInvoiceStore';
import { useTenantStore, type TenantId } from '../store/useTenantStore';

function FieldError({ message, id }: { message?: string; id?: string }) {
  return message ? (
    <span id={id} role="alert" className="mt-1 block text-xs text-danger">
      {translateNode(message)}
    </span>
  ) : null;
}

export function InvoiceCreateForm({
  tenant,
  initialInvoice,
  fresh = false,
}: {
  tenant: TenantId;
  initialInvoice?: InvoiceValues;
  fresh?: boolean;
}) {
  useTranslation();
  const [defaults] = useState(() =>
    structuredClone(
      initialInvoice ??
        (fresh ? newInvoice() : (useInvoiceStore.getState().drafts[tenant] ?? newInvoice())),
    ),
  );
  const {
    register,
    control,
    watch,
    getValues,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<InvoiceValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: defaults,
    mode: 'onTouched',
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const values = watch();
  const totals = invoiceTotals(values);
  const valid = invoiceSchema.safeParse(values).success;
  const money = (value: number) =>
    invoiceMoney(value, values.currency, isBangla() ? 'bn-BD' : 'en-US');
  const [addressSide, setAddressSide] = useState<'sender' | 'recipient' | null>(null);
  const [preview, setPreview] = useState<{
    invoice: InvoiceValues;
    sending: boolean;
  } | null>(null);
  const [message, setMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const saveDraft = useInvoiceStore((state) => state.saveDraft);
  const save = (invoice: InvoiceValues, sending = false) => {
    try {
      saveDraft(tenant, invoice);
      setSaveError('');
      setMessage('Invoice saved in this browser.');
      if (sending) setPreview({ invoice: structuredClone(invoice), sending: true });
    } catch {
      setSaveError('Unable to save. Browser storage may be full or unavailable.');
    }
  };
  const clearFeedback = () => {
    setMessage('');
    setSaveError('');
  };
  return (
    <form
      noValidate
      onSubmit={handleSubmit((invoice) => save(invoice))}
      onChange={clearFeedback}
      className="invoice-create-form"
    >
      {(message || saveError) && (
        <p
          role={saveError ? 'alert' : 'status'}
          className={`mb-4 rounded border p-3 text-sm ${saveError ? 'border-danger text-danger' : 'border-primary/20 bg-primary-soft text-primary'}`}
        >
          {translateNode(saveError || message)}
        </p>
      )}
      <Card>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm">
              <span className="mb-2 block text-muted">{translateNode('Invoice Id')}</span>
              <Input value={values.id} disabled className="text-muted opacity-60" />
            </label>
            <label className="text-sm">
              <span className="mb-2 block text-muted">{translateNode('Status')}</span>
              <Select
                {...register('status')}
                className={`w-full ${!values.status ? 'text-muted' : ''}`}
                aria-invalid={Boolean(errors.status)}
                aria-describedby={errors.status ? 'invoice-status-error' : undefined}
              >
                <option value="" disabled>
                  {translateNode('Select status')}
                </option>
                {['Paid', 'Unpaid', 'Cancelled'].map((status) => (
                  <option key={status} value={status}>
                    {translateNode(status)}
                  </option>
                ))}
              </Select>
              <FieldError id="invoice-status-error" message={errors.status?.message} />
            </label>
            <InvoiceDateField
              control={control}
              name="date"
              label="Date"
              error={errors.date?.message}
            />
            <InvoiceDateField
              control={control}
              name="dueDate"
              label="Due Date"
              min={values.date}
              error={errors.dueDate?.message}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {(['sender', 'recipient'] as const).map((side) => (
              <section key={side} className="min-h-[166px] rounded border border-border p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-semibold">
                    {translateNode(side === 'sender' ? 'From:' : 'To:')}
                  </h2>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-muted"
                    aria-label={translateString(
                      side === 'sender' ? 'Change sender address' : 'Add recipient address',
                    )}
                    onClick={() => setAddressSide(side)}
                  >
                    {side === 'sender' ? (
                      <Pencil className="size-3" />
                    ) : (
                      <Plus className="size-3" />
                    )}
                    {translateNode(side === 'sender' ? 'Change' : 'Add')}
                  </Button>
                </div>
                {values[side] && (
                  <div className="text-sm leading-[22px]">
                    <p className="font-semibold">{values[side]?.name}</p>
                    <p className="whitespace-pre-line text-muted">{values[side]?.address}</p>
                    <p className="text-muted">{values[side]?.phone}</p>
                    <p className="break-all text-muted">{values[side]?.email}</p>
                  </div>
                )}
                <FieldError
                  message={
                    side === 'recipient' ? errors.recipient?.message : errors.sender?.message
                  }
                />
              </section>
            ))}
          </div>
          <section aria-labelledby="invoice-detail-heading">
            <h2 id="invoice-detail-heading" className="mb-4 font-semibold">
              {translateNode('Detail')}
            </h2>
            <div className="overflow-x-auto">
              <table className="invoice-create-table w-full min-w-[850px] text-sm">
                <thead className="border-y border-border bg-subtle text-[11px] uppercase">
                  <tr>
                    {['#', 'Name', 'Description', 'Qty', 'Price', 'Amount', 'Action'].map(
                      (label) => (
                        <th
                          key={label}
                          className={`px-3 py-4 text-start font-semibold ${label === 'Amount' ? 'text-end' : ''}`}
                        >
                          {translateNode(label)}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field, index) => (
                    <tr key={field.id} className="border-b border-border">
                      <td className="w-10 px-3 py-3">{translateNode(index + 1)}</td>
                      <td className="w-[20%] px-3 py-3">
                        <Input
                          aria-label={translateString('Item name') + ` ${index + 1}`}
                          placeholder={translateString('Item name')}
                          maxLength={120}
                          {...register(`items.${index}.name`)}
                          aria-invalid={Boolean(errors.items?.[index]?.name)}
                        />
                        <FieldError message={errors.items?.[index]?.name?.message} />
                      </td>
                      <td className="w-[20%] px-3 py-3">
                        <Input
                          aria-label={translateString('Description') + ` ${index + 1}`}
                          placeholder={translateString('Description')}
                          maxLength={500}
                          {...register(`items.${index}.description`)}
                        />
                        <FieldError message={errors.items?.[index]?.description?.message} />
                      </td>
                      <td className="w-[18%] px-3 py-3">
                        <Input
                          aria-label={translateString('Qty') + ` ${index + 1}`}
                          type="number"
                          min={1}
                          max={1000000}
                          step={1}
                          {...register(`items.${index}.quantity`, {
                            valueAsNumber: true,
                          })}
                          aria-invalid={Boolean(errors.items?.[index]?.quantity)}
                        />
                        <FieldError message={errors.items?.[index]?.quantity?.message} />
                      </td>
                      <td className="w-[18%] px-3 py-3">
                        <Input
                          aria-label={translateString('Price') + ` ${index + 1}`}
                          type="number"
                          min={0}
                          max={1000000}
                          step="0.01"
                          {...register(`items.${index}.price`, {
                            valueAsNumber: true,
                          })}
                          aria-invalid={Boolean(errors.items?.[index]?.price)}
                        />
                        <FieldError message={errors.items?.[index]?.price?.message} />
                      </td>
                      <td
                        className="whitespace-nowrap px-3 py-3 text-end"
                        data-testid={`invoice-item-amount-${index}`}
                      >
                        {money(itemAmount(values.items[index] ?? emptyInvoiceItem()))}
                      </td>
                      <td className="px-3 py-3">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-danger"
                          aria-label={translateString('Remove Item') + ` ${index + 1}`}
                          onClick={() => {
                            remove(index);
                            clearFeedback();
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <FieldError message={errors.items?.root?.message ?? errors.items?.message} />
          </section>
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row">
            <Button
              type="button"
              variant="outline"
              className="border-dashed border-primary text-primary"
              onClick={() => {
                append(emptyInvoiceItem());
                clearFeedback();
              }}
            >
              <Plus className="size-4" />
              {translateNode('Add Item')}
            </Button>
            <div className="w-full md:max-w-[360px]">
              <div className="grid grid-cols-2 gap-4">
                {(['discount', 'tax'] as const).map((field) => (
                  <label key={field} className="text-sm">
                    <span className="mb-2 block text-muted">
                      {translateNode(field === 'discount' ? 'Discount(%)' : 'Tax(%)')}
                    </span>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      {...register(field, { valueAsNumber: true })}
                      aria-invalid={Boolean(errors[field])}
                    />
                    <FieldError message={errors[field]?.message} />
                  </label>
                ))}
              </div>
              <dl className="mt-5 space-y-4 text-sm">
                {[
                  ['Sub Total:', totals.subtotal],
                  ['Discount:', totals.discount],
                  ['Tax:', totals.tax],
                  ['Grand Total:', totals.total],
                ].map(([label, value], index) => (
                  <div
                    key={String(label)}
                    className={`flex items-center justify-between gap-3 ${index === 3 ? 'font-semibold' : 'text-muted'}`}
                  >
                    <dt>{translateNode(label)}</dt>
                    <dd
                      data-testid={
                        ['invoice-subtotal', 'invoice-discount', 'invoice-tax', 'invoice-total'][
                          index
                        ]
                      }
                      className={index === 1 ? 'text-success' : 'text-ink'}
                    >
                      {money(Number(value))}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
          <label className="block text-sm">
            <span className="mb-2 block text-muted">{translateNode('Notes')}</span>
            <div className="relative">
              <textarea
                aria-label={translateString('Notes')}
                {...register('notes')}
                placeholder={translateString('Address')}
                maxLength={500}
                className="min-h-[92px] w-full resize-y rounded border border-border bg-surface px-3 py-3 pb-6 text-sm outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
              <span className="pointer-events-none absolute bottom-2 end-3 text-[11px] text-muted">
                {translateNode(values.notes.length)} / {translateNode(500)}
              </span>
            </div>
            <FieldError message={errors.notes?.message} />
          </label>
          <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
            <label className="w-full text-sm sm:w-[250px]">
              <span className="mb-2 block text-muted">{translateNode('Set Currency*')}</span>
              <Select {...register('currency')} className="w-full">
                {invoiceCurrencies.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.flag} {translateString(currency.name)}
                  </option>
                ))}
              </Select>
            </label>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                disabled={!valid}
                variant="outline"
                className="bg-subtle text-muted"
                onClick={() =>
                  setPreview({
                    invoice: structuredClone(getValues()),
                    sending: false,
                  })
                }
              >
                {translateNode('Preview')}
              </Button>
              <Button type="submit" variant="outline">
                {translateNode('Save')}
              </Button>
              <Button type="button" onClick={handleSubmit((invoice) => save(invoice, true))}>
                {translateNode('Create & Send')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      {addressSide && (
        <InvoiceAddressDialog
          tenant={tenant}
          selected={values[addressSide]}
          onClose={() => setAddressSide(null)}
          onSelect={(address) => {
            setValue(addressSide, address, {
              shouldDirty: true,
              shouldValidate: true,
            });
            clearFeedback();
          }}
        />
      )}
      {preview && (
        <InvoicePreviewDialog
          invoice={preview.invoice}
          sending={preview.sending}
          onClose={() => setPreview(null)}
        />
      )}
    </form>
  );
}

export function InvoiceCreatePage({ fresh = false }: { fresh?: boolean }) {
  const tenant = useTenantStore((state) => state.selectedTenantId);
  return <InvoiceCreateForm key={`${tenant}-${fresh}`} tenant={tenant} fresh={fresh} />;
}
