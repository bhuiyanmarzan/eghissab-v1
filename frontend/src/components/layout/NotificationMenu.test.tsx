import { act, cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { NotificationMenu } from './NotificationMenu';
import { NotificationsPage } from '../../pages/NotificationsPage';
import { initialNotifications, useNotificationStore } from '../../store/useNotificationStore';

beforeEach(() => { useNotificationStore.setState({ notifications: initialNotifications.map(item => ({ ...item, replies: item.replies ? [...item.replies] : undefined })) }); });
afterEach(cleanup);
function setup() {
  render(<MemoryRouter initialEntries={['/dashboard/analytics']}><NotificationMenu /><Routes><Route path="/dashboard/analytics" element={<h1>Dashboard</h1>} /><Route path="/notifications" element={<NotificationsPage />} /></Routes></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Open notifications' }));
  return within(screen.getByRole('dialog'));
}

describe('Notification menu', () => {
  it('matches the reference feed and filters eight items into two unread and one mention', () => {
    const panel = setup();
    expect(panel.getAllByRole('listitem')).toHaveLength(8);
    fireEvent.click(panel.getByRole('tab', { name: 'Unread' }));
    expect(panel.getAllByRole('listitem')).toHaveLength(2);
    expect(panel.getByText('Aida Burg')).toBeInTheDocument();
    fireEvent.click(panel.getByRole('tab', { name: 'Mentions' }));
    expect(panel.getAllByRole('listitem')).toHaveLength(1);
    expect(panel.getByText('Cristina Danny')).toBeInTheDocument();
    fireEvent.keyDown(panel.getByRole('tab', { name: 'Mentions' }), { key: 'Home' });
    expect(panel.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true');
  });
  it('marks a selected item read and clears the badge with mark-all-read', () => {
    const panel = setup();
    fireEvent.click(panel.getByRole('tab', { name: 'Unread' }));
    fireEvent.click(panel.getByRole('button', { name: /Aida Burg/ }));
    expect(panel.getAllByRole('listitem')).toHaveLength(1);
    expect(useNotificationStore.getState().notifications.filter(item => item.unread)).toHaveLength(1);
    fireEvent.click(panel.getByRole('button', { name: 'Make all as read' }));
    expect(panel.queryByRole('listitem')).not.toBeInTheDocument();
    expect(panel.getByText('You’re all caught up. No unread notifications.')).toBeInTheDocument();
    expect(screen.queryByLabelText(/unread notifications/)).not.toBeInTheDocument();
  });
  it.each([['Accept', 'Accepted', 'accepted'], ['Decline', 'Declined', 'declined']])('resolves the demo request through %s', (action, label, status) => {
    const panel = setup();
    fireEvent.click(panel.getByRole('button', { name: action }));
    expect(panel.getByRole('status')).toHaveTextContent(label);
    expect(useNotificationStore.getState().notifications.find(item => item.id === 'jenny')?.requestStatus).toBe(status);
    expect(panel.queryByRole('button', { name: action })).not.toBeInTheDocument();
  });
  it('saves a local reply and rejects blank drafts', () => {
    const panel = setup();
    fireEvent.click(panel.getByRole('button', { name: 'Replay' }));
    expect(panel.getByRole('button', { name: 'Save reply' })).toBeDisabled();
    fireEvent.change(panel.getByRole('textbox', { name: 'Reply to Emily' }), { target: { value: ' Thanks, I will attend. ' } });
    fireEvent.click(panel.getByRole('button', { name: 'Save reply' }));
    expect(panel.getByText('Thanks, I will attend.')).toBeInTheDocument();
    expect(useNotificationStore.getState().notifications.find(item => item.id === 'emily')?.replies).toEqual(['Thanks, I will attend.']);
  });
  it('restores saved read status after rehydration', async () => {
    const panel = setup();
    fireEvent.click(panel.getByRole('button', { name: 'Make all as read' }));
    const saved = localStorage.getItem('mantis-notifications')!;
    act(() => { useNotificationStore.setState({ notifications: initialNotifications }); });
    localStorage.setItem('mantis-notifications', saved);
    await act(async () => { await useNotificationStore.persist.rehydrate(); });
    expect(useNotificationStore.getState().notifications.some(item => item.unread)).toBe(false);
  });
  it('closes on Escape and returns focus to the bell', async () => {
    setup();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open notifications' })).toHaveFocus());
  });
  it('opens the full notification center through View All', () => {
    const panel = setup();
    fireEvent.click(panel.getByRole('link', { name: 'View All Notifications' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'All Notifications' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(8);
  });
});
