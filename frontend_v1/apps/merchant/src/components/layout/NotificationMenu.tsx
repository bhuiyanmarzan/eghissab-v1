import { useTranslation } from 'react-i18next';
import { translateNode, translateString } from '../../lib/localization';
import * as Dialog from '@radix-ui/react-dialog';
import { Bell, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useNotificationStore, type NotificationFilter } from '../../store/useNotificationStore';
import { NotificationFeed, NotificationTabs } from './NotificationFeed';

export function NotificationMenu() {
  useTranslation();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const notifications = useNotificationStore(state => state.notifications);
  const markAllRead = useNotificationStore(state => state.markAllRead);
  const unread = notifications.filter(item => item.unread).length;
  const location = useLocation();
  useEffect(() => { setOpen(false); }, [location.pathname]);
  return <Dialog.Root open={open} onOpenChange={setOpen}>
    <Dialog.Trigger asChild><button type="button" aria-label={translateString("Open notifications")} title={translateString("Notifications")} className="relative grid size-9 shrink-0 place-items-center rounded-md hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <Bell className="size-[18px]" />{unread > 0 && <span aria-label={translateString(`${unread} unread notifications`)} className="absolute end-1 top-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] leading-4 text-white">{translateNode(unread)}</span>}
    </button></Dialog.Trigger>
    <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[80] bg-black/45" /><Dialog.Content aria-describedby={undefined} className="notification-drawer fixed bottom-0 right-0 top-0 z-[90] flex w-[440px] max-w-full flex-col bg-surface text-ink shadow-xl">
      <div className="flex h-[60px] shrink-0 items-center gap-3 border-b border-border px-[18px]"><Dialog.Title className="flex-1 text-base font-semibold">{translateNode("Notification")}</Dialog.Title><button type="button" onClick={markAllRead} disabled={!unread} className="text-[11px] text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-default disabled:text-muted">{translateNode("Make all as read")}</button><Dialog.Close aria-label={translateString("Close notifications")} className="rounded p-1 text-muted hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><X className="size-4" /></Dialog.Close></div>
      <NotificationTabs filter={filter} onChange={setFilter} />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain"><NotificationFeed filter={filter} /></div>
      <Link to="/notifications" onClick={() => setOpen(false)} className="block shrink-0 border-t border-border px-5 py-4 text-center text-sm text-primary hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary">{translateNode("View All Notifications")}</Link>
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>;
}
