import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuickChatMenu } from './QuickChatMenu';
import { QuickChatPanel } from '../chat/QuickChatPanel';
import { filterChats, initialConversations, useChatStore } from '../../store/useChatStore';
import { useTenantStore } from '../../store/useTenantStore';
import {
  saveChatAttachments,
  readChatAttachment,
  removeChatAttachment,
} from '../../lib/chatAttachments';
import i18n from '../../i18n';
vi.mock('../chat/QuickChatEmojiPicker', () => ({
  default: ({ onSelect }: { onSelect: (emoji: string) => void }) => (
    <button type="button" onClick={() => onSelect('😀')}>
      grinning face
    </button>
  ),
}));
vi.mock('../../lib/chatAttachments', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/chatAttachments')>()),
  saveChatAttachments: vi.fn(),
  readChatAttachment: vi.fn(),
  removeChatAttachment: vi.fn().mockResolvedValue(undefined),
}));
beforeEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage('en');
  useChatStore.setState({ tenants: {}, drafts: {} });
  useTenantStore.setState({ selectedTenantId: 'acme' });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.mocked(saveChatAttachments).mockImplementation(async (files) =>
    files.map((file, index) => ({
      id: `file-${index}`,
      name: file.name,
      type: file.type,
      size: file.size,
    })),
  );
  vi.mocked(readChatAttachment).mockResolvedValue(undefined);
  vi.mocked(removeChatAttachment).mockResolvedValue(undefined);
});
afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await i18n.changeLanguage('en');
});
function setup() {
  render(
    <MemoryRouter>
      <QuickChatMenu />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Open Quick Chat' }));
}
function openAlene() {
  fireEvent.click(screen.getByRole('button', { name: 'Open conversation Alene' }));
}

describe('Quick Chat', () => {
  it('opens the drawer with the reference contacts and all four filters', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Quick Chat' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'All' })).toHaveFocus();
    expect(screen.getAllByRole('button', { name: /^Open conversation / })).toHaveLength(15);
    fireEvent.click(screen.getByRole('tab', { name: 'Unread' }));
    expect(screen.getAllByRole('button', { name: /^Open conversation / })).toHaveLength(4);
    fireEvent.click(screen.getByRole('tab', { name: 'Favorites' }));
    expect(screen.getAllByRole('button', { name: /^Open conversation / })).toHaveLength(4);
    fireEvent.click(screen.getByRole('tab', { name: 'Group' }));
    expect(screen.getAllByRole('button', { name: /^Open conversation / })).toHaveLength(2);
  });
  it('reads a conversation and supports favorites and mark all read', () => {
    setup();
    openAlene();
    expect(useChatStore.getState().tenants.acme[0].unread).toBe(false);
    expect(within(screen.getByRole('log')).getAllByText(/./).length).toBeGreaterThan(10);
    fireEvent.click(screen.getByRole('button', { name: 'Remove from favorites' }));
    expect(useChatStore.getState().tenants.acme[0].favorite).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Back to chats' }));
    fireEvent.click(screen.getByRole('button', { name: 'Make all as read' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Unread' }));
    expect(screen.getByText('No unread conversations.')).toBeInTheDocument();
  });
  it('sends on Enter, rejects blank messages, and preserves newlines and IME composition', () => {
    setup();
    openAlene();
    const input = screen.getByRole('textbox', { name: 'Your Message...' });
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    fireEvent.change(input, { target: { value: 'Review this report' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(input).toHaveValue('Review this report');
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(input).toHaveValue('Review this report');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input).toHaveValue('');
    expect(within(screen.getByRole('log')).getByText('Review this report')).toBeInTheDocument();
    expect(useChatStore.getState().tenants.acme[0].messages).toHaveLength(11);
  });
  it('keeps drafts across contacts and drawer dismissal, and restores saved messages', async () => {
    setup();
    openAlene();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'My private draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Back to chats' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open conversation Keefe' }));
    expect(screen.getByRole('textbox')).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'Close Quick Chat' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open Quick Chat' }));
    openAlene();
    expect(screen.getByRole('textbox')).toHaveValue('My private draft');
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    const saved = localStorage.getItem('mantis-quick-chat')!;
    act(() => {
      useChatStore.setState({ tenants: {}, drafts: {} });
    });
    localStorage.setItem('mantis-quick-chat', saved);
    await act(async () => {
      await useChatStore.persist.rehydrate();
    });
    expect(within(screen.getByRole('log')).getByText('My private draft')).toBeInTheDocument();
  });
  it('isolates chats and drafts between tenants', () => {
    setup();
    openAlene();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Acme only' } });
    act(() => useTenantStore.getState().selectTenant('globex'));
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    openAlene();
    expect(screen.getByRole('textbox')).toHaveValue('');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Globex only' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(useChatStore.getState().tenants.globex[0].messages.at(-1)?.text).toBe('Globex only');
    expect(useChatStore.getState().tenants.acme[0].messages).toHaveLength(10);
  });
  it('inserts emojis and closes the picker before dismissing the drawer', async () => {
    setup();
    openAlene();
    fireEvent.click(screen.getByRole('button', { name: 'Choose emoji' }));
    fireEvent.keyDown(await screen.findByRole('button', { name: 'grinning face' }), {
      key: 'Escape',
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'grinning face' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Choose emoji' }));
    fireEvent.click(await screen.findByRole('button', { name: 'grinning face' }));
    expect(screen.getByRole('textbox')).toHaveValue('😀');
  });
  it('saves and sends attachment-only messages and prevents oversized files', async () => {
    setup();
    openAlene();
    const input = screen.getByLabelText('Select attachments');
    const file = new File(['report'], 'report.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [file] } });
    await screen.findByText('report.txt');
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(useChatStore.getState().tenants.acme[0].messages.at(-1)?.attachments?.[0].name).toBe(
      'report.txt',
    );
    const large = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.txt');
    fireEvent.change(input, { target: { files: [large] } });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Each attachment must be 10 MB or smaller.',
    );
  });
  it('removes pending files and handles storage failures without losing the draft', async () => {
    setup();
    openAlene();
    fireEvent.change(screen.getByLabelText('Select attachments'), {
      target: { files: [new File(['hello'], 'file.txt')] },
    });
    await screen.findByText('file.txt');
    fireEvent.click(screen.getByRole('button', { name: 'Remove attachment file.txt' }));
    expect(screen.queryByText('file.txt')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Keep this draft' } });
    const save = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Your draft is still available.');
    expect(screen.getByRole('textbox')).toHaveValue('Keep this draft');
    expect(useChatStore.getState().tenants.acme[0].messages).toHaveLength(10);
    save.mockRestore();
  });
  it('supports keyboard tabs and restores trigger focus on Escape', async () => {
    setup();
    fireEvent.keyDown(screen.getByRole('tab', { name: 'All' }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Unread' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Open Quick Chat' })).toHaveFocus(),
    );
  });
  it('translates controls and demo messages while preserving user text', async () => {
    setup();
    openAlene();
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Please keep my original words' },
    });
    await act(async () => {
      await i18n.changeLanguage('bn');
    });
    expect(screen.getByRole('textbox', { name: 'আপনার বার্তা...' })).toHaveValue(
      'Please keep my original words',
    );
    expect(screen.getByRole('button', { name: 'বার্তা পাঠান' })).toBeInTheDocument();
    expect(screen.getByText('নতুন নকশার খসড়াটি দেখেছেন?')).toBeInTheDocument();
  });
  it('shares sent messages with the full chat page', () => {
    setup();
    openAlene();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Shared chat history' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    cleanup();
    render(<QuickChatPanel fullPage />);
    expect(within(screen.getByRole('log')).getByText('Shared chat history')).toBeInTheDocument();
  });
  it('handles microphone denial and stops recording when the drawer closes', async () => {
    const stopTrack = vi.fn();
    const media = { getTracks: () => [{ stop: stopTrack }] };
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(new Error('denied'))
      .mockResolvedValue(media);
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia },
      language: 'en-US',
      languages: ['en-US'],
    });
    class Recorder {
      static isTypeSupported() {
        return true;
      }
      state = 'inactive';
      onstop?: () => void;
      start() {
        this.state = 'recording';
      }
      stop() {
        this.state = 'inactive';
        this.onstop?.();
      }
    }
    vi.stubGlobal('MediaRecorder', Recorder);
    setup();
    openAlene();
    fireEvent.click(screen.getByRole('button', { name: 'Record voice message' }));
    await screen.findByText('Microphone access was unavailable. Check your browser permission.');
    fireEvent.click(screen.getByRole('button', { name: 'Record voice message' }));
    await screen.findByRole('button', { name: 'Stop recording' });
    fireEvent.click(screen.getByRole('button', { name: 'Close Quick Chat' }));
    expect(stopTrack).toHaveBeenCalled();
  });
  it('saves a voice recording as a pending attachment for review before sending', async () => {
    const stopTrack = vi.fn();
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }),
      },
    });
    class Recorder {
      static isTypeSupported() {
        return true;
      }
      state = 'inactive';
      mimeType = 'audio/webm';
      onstop?: () => void;
      ondataavailable?: (event: { data: Blob }) => void;
      start() {
        this.state = 'recording';
      }
      stop() {
        this.state = 'inactive';
        this.ondataavailable?.({ data: new Blob(['voice']) });
        this.onstop?.();
      }
    }
    vi.stubGlobal('MediaRecorder', Recorder);
    setup();
    openAlene();
    fireEvent.click(screen.getByRole('button', { name: 'Record voice message' }));
    await screen.findByRole('button', { name: 'Stop recording' });
    fireEvent.click(screen.getByRole('button', { name: 'Stop recording' }));
    await waitFor(() =>
      expect(useChatStore.getState().drafts['acme:alene'].attachments[0]?.type).toBe('audio/webm'),
    );
    expect(useChatStore.getState().tenants.acme[0].messages).toHaveLength(10);
    expect(stopTrack).toHaveBeenCalled();
  });
  it('uses the reference filter memberships', () => {
    expect(filterChats(initialConversations, 'group').map((item) => item.name)).toEqual([
      'Backend Squad',
      'Frontend Team',
    ]);
  });
});
