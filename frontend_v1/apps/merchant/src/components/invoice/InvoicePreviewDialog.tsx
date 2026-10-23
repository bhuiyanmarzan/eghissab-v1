import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import { Mail, Printer, X } from 'lucide-react';
import { Button } from '../ui/primitives';
import { invoiceEmail, type InvoiceValues } from '../../lib/invoice';
import { translateNode, translateString } from '../../lib/localization';
import { InvoiceDocument } from './InvoiceDocument';

export function InvoicePreviewDialog({
  invoice,
  sending,
  onClose,
}: {
  invoice: InvoiceValues;
  sending: boolean;
  onClose: () => void;
}) {
  useTranslation();
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="invoice-preview-overlay fixed inset-0 z-[80] bg-black/40" />
        <Dialog.Content
          aria-describedby={sending ? 'invoice-send-description' : undefined}
          className="invoice-create-preview fixed left-1/2 top-1/2 z-[90] flex max-h-[90dvh] w-[900px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-border bg-surface text-ink shadow-xl"
        >
          <div className="invoice-preview-controls flex items-center justify-between gap-2 border-b border-border px-5 py-4">
            <Dialog.Title className="text-lg font-semibold">
              {translateNode(sending ? 'Invoice ready to send' : 'Invoice Preview')}
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={translateString('Close invoice preview')}
              >
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </div>
          <div className="invoice-preview-content min-h-0 overflow-y-auto p-6 sm:p-8">
            {sending && (
              <p
                id="invoice-send-description"
                className="invoice-preview-controls mb-6 rounded bg-primary-soft p-3 text-sm text-primary"
              >
                {translateNode(
                  'Saved in this browser. Open the email draft to send it using your email app.',
                )}
              </p>
            )}
            <InvoiceDocument invoice={invoice} />
          </div>
          <div className="invoice-preview-controls flex flex-wrap justify-end gap-3 border-t border-border px-5 py-4">
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="size-4" />
              {translateNode('Print')}
            </Button>
            {sending && (
              <Button asChild>
                <a href={invoiceEmail(invoice)}>
                  <Mail className="size-4" />
                  {translateNode('Open email draft')}
                </a>
              </Button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
