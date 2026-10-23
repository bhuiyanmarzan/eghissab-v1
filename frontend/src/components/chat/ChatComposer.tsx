import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImagePlus, Mic, Paperclip, Send, Smile, Square, X } from 'lucide-react';
import { Button } from '../ui/primitives';
import {
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_SIZE,
  removeChatAttachment,
  saveChatAttachments,
} from '../../lib/chatAttachments';
import { draftKey, emptyDraft, useChatStore } from '../../store/useChatStore';
import { localizeNumber, translateString } from '../../lib/localization';
const EmojiPicker = lazy(() => import('./QuickChatEmojiPicker'));

export function ChatComposer({
  tenant,
  conversationId,
}: {
  tenant: string;
  conversationId: string;
}) {
  useTranslation();
  const key = draftKey(tenant, conversationId);
  const draft = useChatStore((state) => state.drafts[key] ?? emptyDraft);
  const { updateDraft, sendMessage } = useChatStore();
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const input = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const emojiRoot = useRef<HTMLDivElement>(null);
  const emojiButton = useRef<HTMLButtonElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const active = useRef(true);
  const canceled = useRef(false);
  const stop = () => {
    if (recorder.current?.state === 'recording') recorder.current.stop();
    stream.current?.getTracks().forEach((track) => track.stop());
    setRecording(false);
  };
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      canceled.current = true;
      if (recorder.current?.state === 'recording') recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);
  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    const limit = window.setTimeout(() => {
      if (recorder.current?.state === 'recording') recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
      setRecording(false);
    }, 60000);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(limit);
    };
  }, [recording]);
  useEffect(() => {
    if (!emojiOpen) return;
    const outside = (event: PointerEvent) => {
      if (
        !emojiRoot.current?.contains(event.target as Node) &&
        !emojiButton.current?.contains(event.target as Node)
      )
        setEmojiOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [emojiOpen]);
  async function attach(files: File[]) {
    if (!files.length) return;
    setError('');
    const current = useChatStore.getState().drafts[key] ?? emptyDraft;
    if (files.length + current.attachments.length > MAX_ATTACHMENTS) {
      setError('You can attach up to 5 files per message.');
      return;
    }
    if (files.some((file) => file.size > MAX_ATTACHMENT_SIZE)) {
      setError('Each attachment must be 10 MB or smaller.');
      return;
    }
    setBusy(true);
    try {
      const attachments = await saveChatAttachments(files);
      const latest = useChatStore.getState().drafts[key] ?? emptyDraft;
      updateDraft(tenant, conversationId, { attachments: [...latest.attachments, ...attachments] });
    } catch {
      if (active.current) setError('Could not save the attachment. Please try again.');
    } finally {
      if (active.current) setBusy(false);
    }
  }
  async function record() {
    if (recording) {
      stop();
      return;
    }
    setError('');
    if (!navigator.mediaDevices?.getUserMedia || !globalThis.MediaRecorder) {
      setError('Voice recording is not supported in this browser.');
      return;
    }
    if (draft.attachments.length >= MAX_ATTACHMENTS) {
      setError('You can attach up to 5 files per message.');
      return;
    }
    setBusy(true);
    canceled.current = false;
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!active.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      const mimeType = ['audio/webm', 'audio/ogg', 'audio/mp4'].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const recordingDevice = new MediaRecorder(media, mimeType ? { mimeType } : undefined);
      recorder.current = recordingDevice;
      const chunks: Blob[] = [];
      recordingDevice.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recordingDevice.onstop = () => {
        media.getTracks().forEach((track) => track.stop());
        if (!active.current || canceled.current) return;
        setRecording(false);
        const type = recordingDevice.mimeType || mimeType || 'audio/webm';
        const extension = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
        const blob = new Blob(chunks, { type });
        if (blob.size)
          void attach([new File([blob], `voice-${Date.now()}.${extension}`, { type })]);
      };
      recordingDevice.onerror = () => {
        canceled.current = true;
        stop();
        setError('Could not record audio. Please try again.');
      };
      setSeconds(0);
      recordingDevice.start();
      setRecording(true);
    } catch {
      stream.current?.getTracks().forEach((track) => track.stop());
      if (active.current)
        setError('Microphone access was unavailable. Check your browser permission.');
    } finally {
      if (active.current) setBusy(false);
    }
  }
  function send() {
    if (busy || recording) return;
    try {
      if (sendMessage(tenant, conversationId)) {
        setError('');
        setEmojiOpen(false);
        input.current?.focus();
      }
    } catch {
      setError('Could not save your message. Your draft is still available.');
    }
  }
  return (
    <form
      className="relative shrink-0 border-t border-border bg-surface"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && emojiOpen) {
          event.preventDefault();
          event.stopPropagation();
          setEmojiOpen(false);
          emojiButton.current?.focus();
        }
      }}
    >
      {error && (
        <p role="alert" className="px-4 pt-3 text-xs text-danger">
          {translateString(error)}
        </p>
      )}
      {draft.attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pt-3">
          {draft.attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex max-w-full items-center gap-1 rounded border border-border bg-subtle px-2 py-1 text-xs"
            >
              <span className="max-w-48 truncate">{attachment.name}</span>
              <button
                type="button"
                disabled={busy || recording}
                aria-label={`${translateString('Remove attachment')} ${attachment.name}`}
                onClick={() => {
                  updateDraft(tenant, conversationId, {
                    attachments: draft.attachments.filter((item) => item.id !== attachment.id),
                  });
                  void removeChatAttachment(attachment.id).catch(() => undefined);
                }}
                className="rounded p-1 hover:bg-surface focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <textarea
        ref={input}
        aria-label={translateString('Your Message...')}
        placeholder={translateString('Your Message...')}
        maxLength={4000}
        rows={2}
        value={draft.text}
        onChange={(event) => updateDraft(tenant, conversationId, { text: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            send();
          }
        }}
        className="block w-full resize-none bg-transparent px-[18px] py-4 text-sm outline-none placeholder:text-muted"
      />
      <div className="flex items-center gap-1 px-3 pb-3">
        <button
          ref={emojiButton}
          className="grid size-9 place-items-center rounded-md hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
          type="button"
          aria-label={translateString('Choose emoji')}
          aria-expanded={emojiOpen}
          onClick={() => setEmojiOpen(!emojiOpen)}
          disabled={busy || recording}
        >
          <Smile className="size-[18px]" />
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={translateString('Attach files')}
          onClick={() => fileInput.current?.click()}
          disabled={busy || recording}
        >
          <Paperclip className="size-[18px]" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={translateString('Attach images')}
          onClick={() => imageInput.current?.click()}
          disabled={busy || recording}
        >
          <ImagePlus className="size-[18px]" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={translateString(recording ? 'Stop recording' : 'Record voice message')}
          onClick={() => void record()}
          disabled={busy}
        >
          {recording ? (
            <Square className="size-[18px] fill-current text-danger" />
          ) : (
            <Mic className="size-[18px]" />
          )}
        </Button>
        {recording && (
          <span role="status" className="text-xs text-danger">
            {localizeNumber(seconds)}
            {translateString('s')}
          </span>
        )}
        <Button
          type="submit"
          variant="ghost"
          size="icon"
          className="ms-auto text-primary"
          aria-label={translateString('Send message')}
          disabled={busy || recording || (!draft.text.trim() && !draft.attachments.length)}
        >
          <Send className="size-[18px]" />
        </Button>
      </div>
      <p role="status" className="px-[18px] pb-2 text-[10px] text-muted">
        {translateString(
          busy
            ? 'Saving...'
            : recording
              ? 'Recording voice message'
              : 'Messages are saved on this device.',
        )}
      </p>
      <input
        ref={fileInput}
        type="file"
        multiple
        aria-label={translateString('Select attachments')}
        className="hidden"
        onChange={(event) => {
          void attach(Array.from(event.target.files ?? []));
          event.target.value = '';
        }}
      />
      <input
        ref={imageInput}
        type="file"
        multiple
        accept="image/*"
        aria-label={translateString('Select images')}
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = '';
          if (files.some((file) => !file.type.startsWith('image/'))) {
            setError('Choose an image file.');
            return;
          }
          void attach(files);
        }}
      />
      {emojiOpen && (
        <div
          data-chat-emoji
          ref={emojiRoot}
          className="absolute bottom-full start-2 end-2 z-10 max-h-[min(360px,55dvh)] overflow-auto rounded-lg border border-border shadow-xl"
        >
          <Suspense
            fallback={
              <p className="bg-surface p-4 text-sm">{translateString('Loading emojis...')}</p>
            }
          >
            <EmojiPicker
              onSelect={(emoji) => {
                const field = input.current;
                const start = field?.selectionStart ?? draft.text.length;
                const end = field?.selectionEnd ?? start;
                const text = draft.text.slice(0, start) + emoji + draft.text.slice(end);
                updateDraft(tenant, conversationId, { text: text.slice(0, 4000) });
                setEmojiOpen(false);
                requestAnimationFrame(() => {
                  field?.focus();
                  field?.setSelectionRange(start + emoji.length, start + emoji.length);
                });
              }}
            />
          </Suspense>
        </div>
      )}
    </form>
  );
}
