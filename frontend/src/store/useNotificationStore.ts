import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type NotificationFilter = 'all' | 'unread' | 'mentions';
export type Notification = {
  id: string;
  name: string;
  description: string;
  time: string;
  category?: string;
  avatar?: string;
  unread: boolean;
  mention?: boolean;
  kind?: 'request' | 'file' | 'reply';
  requestStatus?: 'pending' | 'accepted' | 'declined';
  replies?: string[];
};
export const initialNotifications: Notification[] = [
  { id: 'cristina', name: 'Cristina Danny', description: 'mentioned you in Mantis.', time: '12 min ago', category: 'Project', avatar: 'cristina', unread: false, mention: true },
  { id: 'aida', name: 'Aida Burg', description: 'joined to 🔥 Final Presentation', time: '2h ago', category: 'Social Media Plan', avatar: 'aida', unread: true },
  { id: 'jenny', name: 'Jenny Willson', description: 'is requesting to Upgrade Plan', time: '5h ago', category: 'Pricing Plan', unread: false, kind: 'request', requestStatus: 'pending' },
  { id: 'robert', name: 'Robert Fox', description: 'upload a file', time: '1d ago', avatar: 'robert', unread: true, kind: 'file' },
  { id: 'emily', name: 'Emily', description: 'sent you reply', time: '1d ago', avatar: 'emily', unread: false, kind: 'reply', replies: [] },
  { id: 'annete', name: 'Annete Black', description: 'completed Create new component', time: '2d ago', unread: false },
  { id: 'ian', name: 'Ian Dooley', description: 'invited to you join Meeting', time: '4d ago', avatar: 'ian', unread: false },
  { id: 'cat', name: 'Cat central', description: 'There was a failure to your setup', time: '4d ago', unread: false },
];

type NotificationState = {
  notifications: Notification[];
  markRead: (id: string) => void;
  markAllRead: () => void;
  resolveRequest: (id: string, status: 'accepted' | 'declined') => void;
  saveReply: (id: string, reply: string) => void;
};
export function filterNotifications(notifications: Notification[], filter: NotificationFilter) {
  return notifications.filter(item => filter === 'unread' ? item.unread : filter === 'mentions' ? item.mention : true);
}
// The reference dashboard uses a sample feed. Keep demo actions local until a notification API is connected.
export const useNotificationStore = create<NotificationState>()(persist((set) => ({
  notifications: initialNotifications.map(item => ({ ...item })),
  markRead: id => set(state => ({ notifications: state.notifications.map(item => item.id === id ? { ...item, unread: false } : item) })),
  markAllRead: () => set(state => ({ notifications: state.notifications.map(item => ({ ...item, unread: false })) })),
  resolveRequest: (id, status) => set(state => ({ notifications: state.notifications.map(item => item.id === id && item.kind === 'request' && item.requestStatus === 'pending' ? { ...item, requestStatus: status, unread: false } : item) })),
  saveReply: (id, reply) => {
    const text = reply.trim().slice(0, 2000);
    if (!text) return;
    set(state => ({ notifications: state.notifications.map(item => item.id === id && item.kind === 'reply' ? { ...item, unread: false, replies: [...(item.replies ?? []), text] } : item) }));
  },
}), { name: 'mantis-notifications' }));
