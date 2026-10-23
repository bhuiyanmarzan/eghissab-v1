import * as Dialog from '@radix-ui/react-dialog';
import { MessageCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { QuickChatPanel } from '../chat/QuickChatPanel';
import { translateString } from '../../lib/localization';
export function QuickChatMenu() {
  useTranslation();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const content = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          ref={trigger}
          type="button"
          aria-label={translateString('Open Quick Chat')}
          title={translateString('Quick Chat')}
          className="quick-chat-trigger grid size-9 shrink-0 place-items-center rounded-md hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <MessageCircle className="size-[18px]" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/45" />
        <Dialog.Content
          ref={content}
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus();
          }}
          onEscapeKeyDown={(event) => {
            if (content.current?.querySelector('[data-chat-emoji]')) event.preventDefault();
          }}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            content.current?.querySelector<HTMLButtonElement>('[data-chat-filter="all"]')?.focus();
          }}
          className="quick-chat-drawer fixed bottom-0 right-0 top-0 z-[90] flex w-[440px] max-w-full flex-col bg-surface text-ink shadow-xl"
        >
          <Dialog.Title className="sr-only">{translateString('Quick Chat')}</Dialog.Title>
          <QuickChatPanel onClose={() => setOpen(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
