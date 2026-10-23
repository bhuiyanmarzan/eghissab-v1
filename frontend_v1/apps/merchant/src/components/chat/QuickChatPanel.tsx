import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check, MessageCircle, Star, X } from 'lucide-react';
import { Avatar, Button } from '../ui/primitives';
import { ChatComposer } from './ChatComposer';
import { ChatAttachmentView } from './ChatAttachmentView';
import {
  filterChats,
  initialConversations,
  useChatStore,
  type ChatFilter,
  type Conversation,
  type ChatMessage,
} from '../../store/useChatStore';
import { useTenantStore } from '../../store/useTenantStore';
import { formatDate, isBangla, translateString } from '../../lib/localization';
import { cn } from '../../lib/utils';
function timeLabel(time: string) {
  const label = translateString(time);
  return isBangla()
    ? label
        .replace(/[0-9]/g, (digit) => '০১২৩৪৫৬৭৮৯'[Number(digit)])
        .replace('AM', translateString('AM'))
        .replace('PM', translateString('PM'))
    : label;
}
function messageText(message: ChatMessage) {
  return message.demo ? translateString(message.text) : message.text;
}
function ContactAvatar({ item }: { item: Conversation }) {
  return (
    <span className="relative shrink-0">
      {item.avatar ? (
        <img
          src={`/notification-avatars/${item.avatar}.png`}
          alt=""
          className="size-10 rounded-full object-cover"
        />
      ) : (
        <Avatar name={item.name} />
      )}
      {item.online && (
        <span className="absolute -end-0.5 -top-0.5 size-2 rounded-full border border-surface bg-success" />
      )}
    </span>
  );
}
function ChatContacts({
  tenant,
  selected,
  onSelect,
}: {
  tenant: string;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  useTranslation();
  const [filter, setFilter] = useState<ChatFilter>('all');
  const items = useChatStore((state) => state.tenants[tenant] ?? initialConversations);
  const markRead = useChatStore((state) => state.markRead);
  const tabs = useRef<HTMLDivElement>(null);
  const values: ChatFilter[] = ['all', 'unread', 'favorites', 'group'];
  const visible = filterChats(items, filter);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-[60px] shrink-0 items-center gap-3 border-b border-border px-[18px] pe-10">
        <h2 className="flex-1 text-base font-semibold">{translateString('Chat')}</h2>
        <button
          type="button"
          onClick={() => markRead(tenant)}
          disabled={!items.some((item) => item.unread)}
          className="text-[11px] text-primary hover:underline disabled:text-muted"
        >
          {translateString('Make all as read')}
        </button>
      </div>
      <div
        ref={tabs}
        role="tablist"
        aria-label={translateString('Chat filters')}
        className="flex shrink-0 gap-2 border-b border-border px-[18px] py-3"
        onKeyDown={(event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const index = values.indexOf(filter);
          const forward =
            event.key === (document.documentElement.dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight');
          const next =
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? 3
                : (index + (forward ? 1 : -1) + 4) % 4;
          setFilter(values[next]);
          tabs.current
            ?.querySelector<HTMLButtonElement>(`[data-chat-filter="${values[next]}"]`)
            ?.focus();
        }}
      >
        {values.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            data-chat-filter={value}
            aria-selected={filter === value}
            tabIndex={filter === value ? 0 : -1}
            onClick={() => setFilter(value)}
            className={cn(
              'rounded border px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              filter === value
                ? 'border-primary bg-primary-soft text-primary'
                : 'border-transparent bg-subtle text-muted',
            )}
          >
            {translateString(value[0].toUpperCase() + value.slice(1))}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        aria-label={translateString(filter[0].toUpperCase() + filter.slice(1))}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        {visible.length ? (
          <ul className="m-0 list-none p-0">
            {visible.map((item) => {
              const message = item.messages.at(-1)!;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    data-conversation={item.id}
                    aria-label={`${translateString('Open conversation')} ${item.name}`}
                    onClick={() => onSelect(item.id)}
                    className={cn(
                      'flex w-full items-center gap-4 border-b border-border px-[18px] py-5 text-start hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
                      selected === item.id && 'bg-primary-soft',
                    )}
                  >
                    <ContactAvatar item={item} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{item.name}</span>
                      <span className="mt-1 flex items-center gap-1 text-[11px] leading-4">
                        {item.unread ? (
                          <span
                            aria-label={translateString('Unread')}
                            className="size-2 shrink-0 rounded-full bg-primary"
                          />
                        ) : (
                          message.outgoing && (
                            <Check aria-hidden="true" className="size-3 shrink-0 text-success" />
                          )
                        )}
                        <span className="truncate">
                          {messageText(message) || translateString('Attachment')}
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 text-[10px] text-muted">
                      {message.timestamp
                        ? timeLabel(
                            formatDate(new Date(message.timestamp), {
                              hour: 'numeric',
                              minute: '2-digit',
                            }),
                          )
                        : timeLabel(item.time)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div
            role="status"
            className="grid place-items-center gap-3 px-5 py-16 text-center text-sm text-muted"
          >
            <MessageCircle className="size-8" />
            {translateString(
              filter === 'unread'
                ? 'No unread conversations.'
                : filter === 'favorites'
                  ? 'No favorite conversations.'
                  : 'No group conversations.',
            )}
          </div>
        )}
      </div>
    </div>
  );
}
function ChatThread({ tenant, item }: { tenant: string; item: Conversation }) {
  useTranslation();
  const log = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);
  const dimensions = useRef({ height: 0, viewport: 0 });
  useEffect(() => {
    followLatest.current = true;
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [item.id, item.messages.length]);
  useEffect(() => {
    if (!log.current || !content.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      const element = log.current;
      if (!element) return;
      dimensions.current = { height: element.scrollHeight, viewport: element.clientHeight };
      if (followLatest.current) element.scrollTop = element.scrollHeight;
    });
    observer.observe(log.current);
    observer.observe(content.current);
    return () => observer.disconnect();
  }, []);
  return (
    <>
      <div
        ref={log}
        role="log"
        aria-label={`${translateString('Messages with')} ${item.name}`}
        aria-live="polite"
        aria-relevant="additions"
        onScroll={(event) => {
          const element = event.currentTarget;
          // Layout changes can emit scroll events before ResizeObserver. Keep the user's
          // follow preference until the new image/viewport dimensions have been measured.
          if (element.scrollHeight === dimensions.current.height && element.clientHeight === dimensions.current.viewport) {
            followLatest.current = element.scrollHeight - element.clientHeight - element.scrollTop < 64;
          }
        }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[18px] py-5"
      >
        <div ref={content} className="space-y-6">
          {item.messages.map((message) => (
            <div
              key={message.id}
              className={cn('flex items-start gap-3', message.outgoing && 'flex-row-reverse')}
            >
              {message.outgoing ? (
                <Avatar name="John Doe" size="sm" />
              ) : (
                <ContactAvatar item={item} />
              )}
              <div className="min-w-0 max-w-[calc(100%-56px)]">
                <div
                  className={cn(
                    'rounded px-3 py-2 text-sm leading-6',
                    message.outgoing ? 'bg-subtle' : 'bg-primary-soft',
                  )}
                >
                  {message.text && (
                    <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                      {messageText(message)}
                    </p>
                  )}
                  {message.attachments?.map((attachment) => (
                    <ChatAttachmentView key={attachment.id} attachment={attachment} />
                  ))}
                </div>
                <p
                  className={cn(
                    'mt-1 flex items-center gap-1 text-[10px] text-muted',
                    message.outgoing && 'justify-end',
                  )}
                >
                  {message.outgoing && (
                    <Check
                      className="size-3 text-success"
                      aria-label={translateString(message.demo ? 'Sent' : 'Saved locally')}
                    />
                  )}
                  {message.timestamp
                    ? formatDate(new Date(message.timestamp), {
                        hour: 'numeric',
                        minute: '2-digit',
                      })
                    : timeLabel(message.time)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <ChatComposer key={`${tenant}:${item.id}`} tenant={tenant} conversationId={item.id} />
    </>
  );
}
export function QuickChatPanel({
  fullPage = false,
  onClose,
}: {
  fullPage?: boolean;
  onClose?: () => void;
}) {
  useTranslation();
  const tenant = useTenantStore((state) => state.selectedTenantId);
  const conversations = useChatStore((state) => state.tenants[tenant] ?? initialConversations);
  const { markRead, toggleFavorite } = useChatStore();
  const [selection, setSelection] = useState<{ tenant: string; id: string | null }>({
    tenant,
    id: fullPage ? 'alene' : null,
  });
  const selected = selection.tenant === tenant ? selection.id : fullPage ? 'alene' : null;
  const root = useRef<HTMLDivElement>(null);
  const item = conversations.find((conversation) => conversation.id === selected);
  useEffect(() => {
    if (selected) {
      markRead(tenant, selected);
      root.current?.querySelector<HTMLButtonElement>('[data-chat-back]')?.focus();
    }
  }, [selected, tenant, markRead]);
  const choose = (id: string | null) => setSelection({ tenant, id });
  return (
    <div
      ref={root}
      className={cn(
        'relative flex h-full min-h-0 min-w-0',
        fullPage && 'lg:grid lg:grid-cols-[320px_1fr]',
      )}
    >
      <div
        className={cn(
          'h-full min-h-0 min-w-0 flex-1',
          item && (fullPage ? 'hidden border-e border-border lg:block' : 'hidden'),
        )}
      >
        <ChatContacts tenant={tenant} selected={selected} onSelect={choose} />
      </div>
      {item && (
        <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex h-[60px] shrink-0 items-center gap-3 border-b border-border px-[18px]">
            <Button
              data-chat-back
              type="button"
              variant="ghost"
              size="icon"
              aria-label={translateString('Back to chats')}
              onClick={() => {
                const previous = selected;
                choose(null);
                requestAnimationFrame(() =>
                  root.current
                    ?.querySelector<HTMLButtonElement>(`[data-conversation="${previous}"]`)
                    ?.focus(),
                );
              }}
            >
              <ArrowLeft className="size-4 rtl:rotate-180" />
            </Button>
            <h2 className="min-w-0 flex-1 truncate text-base font-semibold">{item.name}</h2>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={translateString(
                item.favorite ? 'Remove from favorites' : 'Add to favorites',
              )}
              aria-pressed={item.favorite}
              onClick={() => toggleFavorite(tenant, item.id)}
            >
              <Star className={cn('size-4', item.favorite && 'fill-warning text-warning')} />
            </Button>
            {onClose && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={translateString('Close Quick Chat')}
                onClick={onClose}
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
          <ChatThread key={`${tenant}:${item.id}`} tenant={tenant} item={item} />
        </section>
      )}
      {!item && onClose && (
        <button
          type="button"
          aria-label={translateString('Close Quick Chat')}
          onClick={onClose}
          className="absolute end-2 top-4 rounded p-1 text-muted hover:bg-subtle focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
