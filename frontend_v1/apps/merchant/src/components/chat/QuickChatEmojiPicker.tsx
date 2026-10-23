import EmojiPicker, { EmojiStyle, Theme } from 'emoji-picker-react';
import bn from 'emoji-picker-react/dist/data/emojis-bn';
import { useTranslation } from 'react-i18next';
import { isBangla, translateString } from '../../lib/localization';
import { useResolvedTheme } from '../../store/useResolvedTheme';
export default function QuickChatEmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  useTranslation();
  const mode = useResolvedTheme();
  return (
    <EmojiPicker
      width="100%"
      height={350}
      theme={mode === 'dark' ? Theme.DARK : Theme.LIGHT}
      emojiStyle={EmojiStyle.NATIVE}
      emojiData={isBangla() ? bn : undefined}
      searchPlaceholder={translateString('Search emojis')}
      searchClearButtonLabel={translateString('Clear')}
      previewConfig={{ showPreview: false }}
      onEmojiClick={(data) => onSelect(data.emoji)}
    />
  );
}
