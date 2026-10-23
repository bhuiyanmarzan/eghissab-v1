import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Languages, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/primitives';
import { translateString } from '../../lib/localization';
export function LanguageSelector() {
  const { i18n } = useTranslation();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={translateString('Change language')}
          title={translateString('Language')}
        >
          <Languages className="size-[18px]" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-[100] min-w-40 rounded-lg border border-border bg-surface p-1 shadow-lg"
        >
          {[
            ['en', 'English'],
            ['bn', 'বাংলা'],
          ].map(([language, label]) => (
            <DropdownMenu.Item
              key={language}
              onSelect={() => void i18n.changeLanguage(language)}
              className="flex cursor-pointer items-center gap-3 rounded px-3 py-2 text-sm text-ink outline-none focus:bg-primary-soft"
            >
              <span lang={language}>{label}</span>
              {i18n.resolvedLanguage === language && (
                <Check className="ms-auto size-4 text-primary" />
              )}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
