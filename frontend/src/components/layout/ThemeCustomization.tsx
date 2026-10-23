import { useTranslation } from 'react-i18next';
import { translateNode, translateString } from '../../lib/localization';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowLeftRight, Check, ChevronDown, Columns3, LayoutDashboard, Paintbrush, Palette, Settings, Type, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useAppStore, type FontFamily, type ThemeLayout, type ThemeMode } from '../../store/useAppStore';
import { colorSchemes } from '../../lib/theme';
import { cn } from '../../lib/utils';

function Section({ title, description, icon, children }: { title: string; description: string; icon: ReactNode; children: ReactNode }) {
  useTranslation();
  return <details open className="theme-section border-b border-border">
    <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary">
      <span className="grid size-10 shrink-0 place-items-center rounded bg-primary-soft text-primary">{icon}</span>
      <span className="flex-1"><strong className="block text-sm font-semibold">{translateNode(title)}</strong><span className="mt-1 block text-xs text-muted">{translateNode(description)}</span></span><ChevronDown className="section-chevron size-4 text-primary" />
    </summary><fieldset className="px-4 pb-5"><legend className="sr-only">{translateNode(title)}</legend><div className="grid grid-cols-3 gap-3">{translateNode(children)}</div></fieldset>
  </details>;
}
function Preview({ variant, color }: { variant: string; color?: string }) {
  useTranslation();
  if (variant === 'font') return <span aria-hidden="true" className="text-2xl font-semibold">{translateNode("Aa")}</span>;
  return <svg aria-hidden="true" viewBox="0 0 80 70" className="theme-preview h-16 w-full" style={{ color: color ?? (variant === 'dark' ? '#303030' : '#bfc3ca') }}>
    <rect x="3" y="3" width="74" height="64" rx="3" fill={variant === 'dark' ? '#151515' : '#fff'} stroke="currentColor" />
    <rect x="4" y="4" width="72" height="7" fill="currentColor" />
    <circle cx="8" cy="7" r="1" fill="white" /><circle cx="12" cy="7" r="1" fill="white" />
    <rect x={variant === 'rtl' ? 60 : 4} y="12" width={variant === 'mini' ? 8 : variant === 'horizontal' ? 72 : 16} height={variant === 'horizontal' ? 8 : 53} fill="currentColor" opacity=".65" />
    <rect x={variant === 'container' ? 30 : 24} y={variant === 'horizontal' ? 25 : 16} width={variant === 'container' ? 35 : variant === 'rtl' ? 30 : 48} height="5" fill="currentColor" opacity=".7" />
    <rect x={variant === 'container' ? 30 : 24} y="57" width={variant === 'container' ? 35 : 48} height="4" fill="currentColor" opacity=".55" />
    {variant === 'system' && <path d="M40 4H76V66H40Z" fill="#151515" opacity=".85" />}
  </svg>;
}
function Choice({ group, value, label, selected, onChange, variant, color, font }: { group: string; value: string; label: string; selected: boolean; onChange: () => void; variant: string; color?: string; font?: string }) {
  useTranslation();
  return <label className={cn('theme-choice relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border p-2 text-center transition-colors', selected ? 'border-primary bg-primary-soft' : 'border-transparent bg-subtle hover:border-border')} style={font ? { fontFamily: `"${font}", sans-serif` } : undefined}>
    <input className="peer sr-only" type="radio" name={group} value={value} aria-label={translateString(label)} checked={selected} onChange={onChange} />
    <span className="pointer-events-none absolute inset-0 rounded-md peer-focus-visible:ring-2 peer-focus-visible:ring-primary" />
    <Preview variant={variant} color={color} /><span className="text-[11px]">{translateNode(label)}</span>{selected && <Check aria-hidden="true" className="absolute end-1 top-1 size-3 text-primary" />}
  </label>;
}
export function ThemeCustomization() {
  useTranslation();
  const { theme, layout, direction, colorScheme, layoutWidth, fontFamily, setThemeSettings, resetThemeSettings } = useAppStore();
  return <Dialog.Root><Dialog.Trigger asChild><button type="button" aria-label={translateString("Theme Customization")} title={translateString("Theme Customization")} className="grid size-9 shrink-0 place-items-center rounded-md hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Settings className="size-[18px]" /></button></Dialog.Trigger>
    <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[80] bg-black/45" /><Dialog.Content aria-describedby={undefined} className="theme-drawer fixed bottom-0 right-0 top-0 z-[90] flex w-[340px] max-w-full flex-col bg-surface text-ink shadow-xl">
      <div className="flex h-[70px] shrink-0 items-center justify-between bg-primary px-5 text-white"><Dialog.Title className="text-base font-semibold">{translateNode("Theme Customization")}</Dialog.Title><Dialog.Close aria-label={translateString("Close Theme Customization")} className="rounded-full p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><X className="size-5" /></Dialog.Close></div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <Section title={translateString("Theme Layout")} description={translateString("Choose your layout")} icon={<LayoutDashboard className="size-5" />}>
          {([['default', 'Default'], ['horizontal', 'Horizontal'], ['mini', 'Mini Drawer']] as const).map(([value, label]) => <Choice key={value} group="theme-layout" value={value} label={translateString(label)} variant={value} selected={layout === value} onChange={() => setThemeSettings({ layout: value as ThemeLayout })} />)}
        </Section>
        <Section title={translateString("Menu Direction")} description={translateString("Choose RTL or LTR menu direction")} icon={<ArrowLeftRight className="size-5" />}>
          {(['ltr', 'rtl'] as const).map((value) => <Choice key={value} group="menu-direction" value={value} label={translateString(value.toUpperCase())} variant={value} selected={direction === value} onChange={() => setThemeSettings({ direction: value })} />)}
        </Section>
        <Section title={translateString("Theme Mode")} description={translateString("Choose light, dark or system mode")} icon={<Paintbrush className="size-5" />}>
          {(['light', 'dark', 'system'] as const).map((value) => <Choice key={value} group="theme-mode" value={value} label={translateString(value[0].toUpperCase() + value.slice(1))} variant={value} selected={theme === value} onChange={() => setThemeSettings({ theme: value as ThemeMode })} />)}
        </Section>
        <Section title={translateString("Color Scheme")} description={translateString("Choose your primary theme color")} icon={<Palette className="size-5" />}>
          {colorSchemes.map((scheme, index) => <Choice key={scheme.label} group="color-scheme" value={String(index)} label={translateString(scheme.label)} variant="color" color={scheme.primary} selected={colorScheme === index} onChange={() => setThemeSettings({ colorScheme: index })} />)}
        </Section>
        <Section title={translateString("Layout Width")} description={translateString("Choose fluid or container layout")} icon={<Columns3 className="size-5" />}>
          {(['fluid', 'container'] as const).map((value) => <Choice key={value} group="layout-width" value={value} label={translateString(value[0].toUpperCase() + value.slice(1))} variant={value} selected={layoutWidth === value} onChange={() => setThemeSettings({ layoutWidth: value })} />)}
        </Section>
        <Section title={translateString("Font Family")} description={translateString("Choose your font family.")} icon={<Type className="size-5" />}>
          {(['Inter', 'Roboto', 'Poppins', 'Public Sans'] as const).map((value) => <Choice key={value} group="font-family" value={value} label={translateString(value)} font={value} variant="font" selected={fontFamily === value} onChange={() => setThemeSettings({ fontFamily: value as FontFamily })} />)}
        </Section>
        <div className="p-4"><button type="button" onClick={resetThemeSettings} className="w-full rounded-md border border-border px-4 py-2 text-sm hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{translateNode("Reset to defaults")}</button></div>
      </div>
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>;
}
