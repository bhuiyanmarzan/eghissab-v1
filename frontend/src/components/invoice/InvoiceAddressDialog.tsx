import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Dialog from '@radix-ui/react-dialog';
import { Plus, Search, X } from 'lucide-react';
import { Button, Input } from '../ui/primitives';
import { addressSchema, invoiceAddresses, type InvoiceAddress } from '../../lib/invoice';
import { translateNode, translateString } from '../../lib/localization';
import { useInvoiceStore } from '../../store/useInvoiceStore';
import type { TenantId } from '../../store/useTenantStore';

export function InvoiceAddressDialog({
  tenant,
  selected,
  onSelect,
  onClose,
}: {
  tenant: TenantId;
  selected: InvoiceAddress | null;
  onSelect: (address: InvoiceAddress) => void;
  onClose: () => void;
}) {
  useTranslation();
  const [search, setSearch] = useState('');
  const [choice, setChoice] = useState<InvoiceAddress | null>(selected);
  const [adding, setAdding] = useState(false);
  const [saveError, setSaveError] = useState('');
  const custom = useInvoiceStore((state) => state.addresses[tenant]);
  const addAddress = useInvoiceStore((state) => state.addAddress);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<InvoiceAddress>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      id: crypto.randomUUID(),
      name: '',
      address: '',
      phone: '',
      email: '',
    },
  });
  const addresses = [...invoiceAddresses, ...(custom ?? [])].filter((address) =>
    `${address.name} ${address.address} ${address.email}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  const saveAddress = (address: InvoiceAddress) => {
    try {
      addAddress(tenant, address);
      onSelect(address);
      onClose();
    } catch {
      setSaveError('Unable to save. Browser storage may be full or unavailable.');
    }
  };
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/40" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-[90] flex max-h-[90dvh] w-[512px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-md bg-surface text-ink shadow-xl"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-5">
            <Dialog.Title className="font-semibold">
              {translateNode(adding ? 'Add New Address' : 'Select Address')}
            </Dialog.Title>
            {!adding && (
              <Button variant="ghost" className="text-primary" onClick={() => setAdding(true)}>
                <Plus className="size-4" />
                {translateNode('Add New')}
              </Button>
            )}
            <Dialog.Close asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={translateString('Close address dialog')}
              >
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </div>
          {adding ? (
            <form
              onSubmit={(event) => {
                event.stopPropagation();
                void handleSubmit(saveAddress)(event);
              }}
              className="overflow-y-auto p-5"
              noValidate
            >
              <div className="space-y-4">
                {(['name', 'address', 'phone', 'email'] as const).map((field) => (
                  <label key={field} className="block text-sm">
                    <span className="mb-2 block">
                      {translateNode(
                        {
                          name: 'Name',
                          address: 'Address',
                          phone: 'Phone',
                          email: 'Email address',
                        }[field],
                      )}
                    </span>
                    <Input
                      type={field === 'email' ? 'email' : 'text'}
                      autoComplete={
                        field === 'name'
                          ? 'name'
                          : field === 'email'
                            ? 'email'
                            : field === 'phone'
                              ? 'tel'
                              : 'street-address'
                      }
                      {...register(field)}
                      aria-invalid={Boolean(errors[field])}
                    />
                    {errors[field] && (
                      <span role="alert" className="mt-1 block text-xs text-danger">
                        {translateNode(errors[field]?.message)}
                      </span>
                    )}
                  </label>
                ))}
              </div>
              {saveError && (
                <p role="alert" className="mt-3 text-sm text-danger">
                  {translateNode(saveError)}
                </p>
              )}
              <div className="mt-6 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
                  {translateNode('Back')}
                </Button>
                <Button type="submit">{translateNode('Add Address')}</Button>
              </div>
            </form>
          ) : (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                <div className="relative mb-4">
                  <Search className="pointer-events-none absolute start-3 top-3 size-4 text-muted" />
                  <Input
                    aria-label={translateString('Search addresses')}
                    placeholder={translateString('Search')}
                    className="ps-9"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
                <div className="space-y-3" role="group" aria-label={translateString('Addresses')}>
                  {addresses.map((address) => (
                    <button
                      key={address.id}
                      type="button"
                      aria-pressed={choice?.id === address.id}
                      onClick={() => setChoice(address)}
                      className={`w-full rounded border p-3 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${choice?.id === address.id ? 'border-primary bg-primary-soft' : 'border-border hover:bg-subtle'}`}
                    >
                      <span className="block text-sm font-medium">{address.name}</span>
                      <span className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs leading-5 text-muted">
                        <span>{address.address}</span>
                        <span>{address.phone}</span>
                        <span>{address.email}</span>
                      </span>
                    </button>
                  ))}
                </div>
                {!addresses.length && (
                  <p className="py-6 text-center text-sm text-muted">
                    {translateNode('No addresses found')}
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
                <Dialog.Close asChild>
                  <Button variant="ghost" className="text-danger">
                    {translateNode('Cancel')}
                  </Button>
                </Dialog.Close>
                <Button
                  disabled={!choice}
                  onClick={() => {
                    if (choice) {
                      onSelect(choice);
                      onClose();
                    }
                  }}
                >
                  {translateNode('Add')}
                </Button>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
