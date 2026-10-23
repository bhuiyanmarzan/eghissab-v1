import { useTranslation } from 'react-i18next';
import { translateNode } from '../../lib/localization';
import { cn } from '../../lib/utils';

export function Logo({ compact = false, inverse = false }: { compact?: boolean; inverse?: boolean }) {
  useTranslation();
  return <div className="flex h-10 items-center gap-2.5">
    <span className="relative grid size-7 rotate-45 place-items-center rounded-[4px] border-[3px] border-primary"><span className={cn('size-2.5 rounded-[2px]', inverse ? 'bg-white' : 'bg-primary')} /></span>
    {!compact && <span className={cn('text-xl font-bold tracking-normal', inverse ? 'text-white' : 'text-ink')}>{translateNode("Mantis")}</span>}
  </div>;
}
