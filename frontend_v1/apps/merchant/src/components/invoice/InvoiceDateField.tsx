import { useRef } from 'react';
import { Controller, type Control } from 'react-hook-form';
import { CalendarDays } from 'lucide-react';
import { Button, Input } from '../ui/primitives';
import { translateNode, translateString } from '../../lib/localization';
import type { InvoiceValues } from '../../lib/invoice';

const displayDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split('-').reverse().join('/') : value;
const inputDate = (value: string) =>
  /^\d{2}\/\d{2}\/\d{4}$/.test(value) ? value.split('/').reverse().join('-') : value;

export function InvoiceDateField({
  control,
  name,
  label,
  min,
  error,
}: {
  control: Control<InvoiceValues>;
  name: 'date' | 'dueDate';
  label: string;
  min?: string;
  error?: string;
}) {
  const picker = useRef<HTMLInputElement>(null);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="text-sm">
          <label className="block">
            <span className="mb-2 block text-muted">{translateNode(label)}</span>
            <div className="relative">
              <Input
                {...field}
                name={field.name}
                aria-label={translateString(label)}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? `${name}-error` : undefined}
                inputMode="numeric"
                placeholder="DD/MM/YYYY"
                value={displayDate(field.value)}
                onChange={(event) => field.onChange(inputDate(event.target.value))}
                onBlur={field.onBlur}
                className="pe-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={translateString(
                  name === 'date' ? 'Choose invoice date' : 'Choose due date',
                )}
                className="absolute end-0.5 top-0.5 text-muted"
                onClick={() => {
                  const input = picker.current;
                  if (input?.showPicker) input.showPicker();
                  else input?.click();
                }}
              >
                <CalendarDays className="size-4" />
              </Button>
            </div>
          </label>
          <input
            ref={picker}
            type="date"
            tabIndex={-1}
            aria-hidden="true"
            className="pointer-events-none absolute size-0 opacity-0"
            min={min}
            value={/^\d{4}-\d{2}-\d{2}$/.test(field.value) ? field.value : ''}
            onChange={(event) => {
              field.onChange(event.target.value);
              field.onBlur();
            }}
          />
          {error && (
            <span id={`${name}-error`} role="alert" className="mt-1 block text-xs text-danger">
              {translateNode(error)}
            </span>
          )}
        </div>
      )}
    />
  );
}
