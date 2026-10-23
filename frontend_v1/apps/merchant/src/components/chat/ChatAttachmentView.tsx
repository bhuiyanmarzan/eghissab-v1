import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, FileText } from 'lucide-react';
import { readChatAttachment } from '../../lib/chatAttachments';
import { translateString, localizeNumber } from '../../lib/localization';
import type { ChatAttachment } from '../../store/useChatStore';

export function ChatAttachmentView({ attachment }: { attachment: ChatAttachment }) {
  useTranslation();
  const [source, setSource] = useState<string>();
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    let active = true;
    let url: string | undefined;
    readChatAttachment(attachment.id)
      .then((blob) => {
        if (!active) return;
        if (blob) {
          url = URL.createObjectURL(blob);
          setSource(url);
        } else setUnavailable(true);
      })
      .catch(() => {
        if (active) setUnavailable(true);
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [attachment.id]);
  return (
    <div className="mt-2 max-w-full rounded border border-border bg-surface p-2 text-ink">
      {source && attachment.type.startsWith('image/') && (
        <a href={source} download={attachment.name}>
          <img
            src={source}
            alt={attachment.name}
            className="mb-2 max-h-48 w-full rounded object-contain"
          />
        </a>
      )}
      {source && attachment.type.startsWith('audio/') && (
        <audio
          controls
          preload="metadata"
          src={source}
          aria-label={attachment.name}
          className="mb-2 w-full max-w-full"
        />
      )}
      <div className="flex items-center gap-2 text-xs">
        <FileText className="size-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 break-all">
          {attachment.name}
          <small className="block text-muted">
            {localizeNumber(Math.ceil(attachment.size / 1024))} {translateString('KB')}
          </small>
        </span>
        {source && (
          <a
            href={source}
            download={attachment.name}
            aria-label={`${translateString('Download')} ${attachment.name}`}
            className="rounded p-1 text-primary focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Download className="size-4" />
          </a>
        )}
      </div>
      {!source && (
        <p role="status" className="mt-1 text-xs text-muted">
          {translateString(unavailable ? 'Attachment unavailable' : 'Loading attachment...')}
        </p>
      )}
    </div>
  );
}
