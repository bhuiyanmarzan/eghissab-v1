import { useTranslation } from 'react-i18next';
import { translateNode } from '../lib/localization';
import { useState } from 'react';
import { NotificationFeed, NotificationTabs } from '../components/layout/NotificationFeed';
import { useNotificationStore, type NotificationFilter } from '../store/useNotificationStore';

export function NotificationsPage() {
  useTranslation();
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const { notifications, markAllRead } = useNotificationStore();
  const unread = notifications.filter(item => item.unread).length;
  return <section className="mx-auto max-w-3xl overflow-hidden rounded-lg border border-border bg-surface shadow-card">
    <div className="flex items-center justify-between gap-3 border-b border-border p-5"><h2 className="font-semibold">{translateNode("All Notifications")}</h2><button type="button" onClick={markAllRead} disabled={!unread} className="text-xs text-primary hover:underline disabled:text-muted">{translateNode("Make all as read")}</button></div>
    <NotificationTabs filter={filter} onChange={setFilter} /><NotificationFeed filter={filter} />
  </section>;
}
