import { useTranslation } from 'react-i18next';
import { translateNode, translateString } from '../../lib/localization';
import { useRef, useState } from 'react';
import { Bell, Figma } from 'lucide-react';
import { Button } from '../ui/primitives';
import { cn } from '../../lib/utils';
import { filterNotifications, useNotificationStore, type Notification, type NotificationFilter } from '../../store/useNotificationStore';

export function NotificationTabs({ filter, onChange }: { filter: NotificationFilter; onChange: (filter: NotificationFilter) => void }) {
  useTranslation();
  const count = useNotificationStore(state => state.notifications.length);
  const root = useRef<HTMLDivElement>(null);
  const values: NotificationFilter[] = ['all', 'unread', 'mentions'];
  return <div ref={root} role="tablist" aria-label={translateString("Notification filters")} className="flex gap-2 border-b border-border px-5 py-3" onKeyDown={event => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = values.indexOf(filter);
    const rtl = document.documentElement.dir === 'rtl';
    const forward = event.key === (rtl ? 'ArrowLeft' : 'ArrowRight');
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (forward ? 1 : -1) + 3) % 3;
    onChange(values[next]);
    root.current?.querySelector<HTMLButtonElement>(`[data-filter="${values[next]}"]`)?.focus();
  }}>
    {values.map(value => <button key={value} type="button" role="tab" data-filter={value} aria-label={translateString(value[0].toUpperCase() + value.slice(1))} aria-selected={filter === value} tabIndex={filter === value ? 0 : -1} onClick={() => onChange(value)} className={cn('flex items-center gap-2 rounded border px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', filter === value ? 'border-primary bg-primary-soft text-primary' : 'border-transparent bg-subtle text-muted hover:text-ink')}>
      {translateNode(value[0].toUpperCase() + value.slice(1))}{value === 'all' && <span aria-hidden="true" className={cn('grid size-5 place-items-center rounded-full text-[11px]', filter === value ? 'bg-primary text-white' : 'bg-ink text-surface')}>{translateNode(count)}</span>}
    </button>)}
  </div>;
}

function NotificationItem({ item }: { item: Notification }) {
  useTranslation();
  const { markRead, resolveRequest, saveReply } = useNotificationStore();
  const [replyOpen, setReplyOpen] = useState(false);
  const [draft, setDraft] = useState('');
  return <li className="border-b border-border last:border-0">
    <button type="button" onClick={() => markRead(item.id)} aria-label={`${item.name} ${translateString(item.description)}${item.unread ? ', ' + translateString('Unread') : ''}`} className="flex w-full items-start gap-4 px-[18px] py-5 text-start hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary">
      {item.avatar ? <img src={`/notification-avatars/${item.avatar}.png`} alt={translateString(item.name)} className="size-10 shrink-0 rounded-full object-cover" /> : <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-sm text-primary">{item.name[0]}</span>}
      <span className="min-w-0 flex-1"><span className="block text-sm leading-5"><strong className="font-semibold">{item.name}</strong> {translateNode(item.description)}</span><span className="mt-1 block text-xs text-muted">{translateNode(item.time)}{item.category && <> {translateNode("· ")}{translateNode(item.category)}</>}</span></span>
      {item.unread && <span aria-hidden="true" className="mt-4 size-1.5 shrink-0 rounded-full bg-primary" />}
    </button>
    {item.kind === 'request' && <div className="-mt-2 flex gap-2 pb-5 pe-[18px] ps-[74px]">
      {item.requestStatus === 'pending' ? <><Button size="sm" onClick={() => resolveRequest(item.id, 'accepted')}>{translateNode("Accept")}</Button><Button size="sm" variant="outline" onClick={() => resolveRequest(item.id, 'declined')}>{translateNode("Decline")}</Button></> : <span role="status" className="rounded bg-primary-soft px-3 py-1 text-xs text-primary">{translateNode(item.requestStatus === 'accepted' ? 'Accepted' : 'Declined')}</span>}
    </div>}
    {item.kind === 'file' && <div className="-mt-1 flex items-center gap-2 pb-5 pe-[18px] ps-[74px] text-xs"><span className="rounded border border-border bg-subtle p-1"><Figma aria-hidden="true" className="size-3 text-primary" /></span><span className="break-all">{translateNode("mantis_dashboard.fig ")}<span className="text-muted">{translateNode("26mb")}</span></span></div>}
    {item.kind === 'reply' && <div className="-mt-1 space-y-3 pb-5 pe-[18px] ps-[74px]">
      <div className="flex items-start gap-3 rounded border border-border bg-subtle p-3"><p className="min-w-0 flex-1 text-xs leading-5">{translateNode("We have scheduled a meeting for next week.")}</p><Button size="sm" className="h-6 shrink-0 px-2 text-[11px]" onClick={() => setReplyOpen(true)}>{translateNode("Replay")}</Button></div>
      {item.replies?.map((reply, index) => <div key={index} className="rounded bg-primary-soft p-3"><p className="break-words text-xs leading-5">{reply}</p><p className="mt-1 text-[10px] text-muted">{translateNode("Your reply · Saved locally")}</p></div>)}
      {replyOpen && <form className="space-y-2" onSubmit={event => { event.preventDefault(); if (!draft.trim()) return; saveReply(item.id, draft); setDraft(''); setReplyOpen(false); }}>
        <label className="block text-xs font-medium" htmlFor={`reply-${item.id}`}>{translateNode("Reply to ")}{item.name}</label><textarea autoFocus id={`reply-${item.id}`} value={draft} onChange={event => setDraft(event.target.value)} maxLength={2000} rows={3} className="w-full rounded border border-border bg-surface p-2 text-sm outline-none focus:border-primary" />
        <div className="flex gap-2"><Button size="sm" type="submit" disabled={!draft.trim()}>{translateNode("Save reply")}</Button><Button size="sm" type="button" variant="ghost" onClick={() => setReplyOpen(false)}>{translateNode("Cancel")}</Button></div>
      </form>}
    </div>}
  </li>;
}

export function NotificationFeed({ filter }: { filter: NotificationFilter }) {
  useTranslation();
  const notifications = useNotificationStore(state => state.notifications);
  const visible = filterNotifications(notifications, filter);
  return <div role="tabpanel" aria-label={translateString(`${filter[0].toUpperCase() + filter.slice(1)} notifications`)}>
    {visible.length ? <ul className="m-0 list-none p-0">{visible.map(item => <NotificationItem key={item.id} item={item} />)}</ul> : <div className="grid place-items-center gap-3 px-5 py-16 text-center text-muted"><Bell className="size-8" /><p className="text-sm">{translateNode(filter === 'unread' ? 'You’re all caught up. No unread notifications.' : filter === 'mentions' ? 'No mentions yet.' : 'No notifications yet.')}</p></div>}
  </div>;
}
