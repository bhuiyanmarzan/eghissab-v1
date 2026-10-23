import { useTranslation } from 'react-i18next';
import { translateNode, translateString } from '../../lib/localization';
import * as Dialog from '@radix-ui/react-dialog';
import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { searchPages } from '../../lib/globalSearch';

export function GlobalSearch() {
  useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const links = useRef<(HTMLAnchorElement | null)[]>([]);
  const dialog = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const matches = searchPages(query);
  const groups = [...new Set(matches.map(item => item.group))];
  const ordered = groups.flatMap(group => matches.filter(item => item.group === group));
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
  const close = () => { setOpen(false); setQuery(''); };
  useEffect(() => { setOpen(false); setQuery(''); }, [location.pathname]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (event.isComposing || event.altKey || event.key.toLowerCase() !== 'k' || !(event.ctrlKey || event.metaKey)) return;
      if (!open && document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      event.preventDefault();
      setOpen(!open);
      setQuery('');
    };
    document.addEventListener('keydown', shortcut);
    return () => document.removeEventListener('keydown', shortcut);
  }, [open]);

  return <Dialog.Root open={open} onOpenChange={next => { setOpen(next); if (!next) setQuery(''); }}><Dialog.Trigger asChild>
    <button ref={trigger} type="button" aria-label={translateString("Open global search")} title={translateString(`Global search (${isMac ? '⌘' : 'Ctrl'} K)`)} aria-keyshortcuts="Control+K Meta+K" className="global-search-trigger ms-2 flex h-9 shrink-0 items-center gap-2 rounded border border-border bg-surface px-2 text-muted hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Search className="size-4" /><kbd className="search-shortcut rounded bg-subtle px-1 py-0.5 text-[10px]">{isMac ? '⌘' : 'Ctrl'} {translateNode("K")}</kbd></button>
  </Dialog.Trigger><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[80] bg-black/60" /><Dialog.Content ref={dialog} aria-describedby={undefined} onOpenAutoFocus={event => { event.preventDefault(); input.current?.focus(); }} onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus(); }} className="global-search-dialog fixed left-1/2 top-4 z-[90] flex max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-3xl -translate-x-1/2 flex-col overflow-hidden rounded-md border border-border bg-surface text-ink shadow-xl sm:top-[min(120px,15vh)] sm:max-h-[calc(100dvh-150px)]" onKeyDown={event => {
    if (event.nativeEvent.isComposing) return;
    const onInput = event.target === input.current;
    if (onInput && event.key === 'Enter' && ordered.length) { event.preventDefault(); navigate(ordered[0].to); close(); return; }
    if (onInput && ['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); links.current[event.key === 'ArrowDown' ? 0 : ordered.length - 1]?.focus(); return; }
    if (onInput || !['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const current = links.current.indexOf(document.activeElement as HTMLAnchorElement);
    if (current < 0) return;
    event.preventDefault();
    const columns = window.innerWidth >= 768 ? 4 : window.innerWidth >= 640 ? 3 : 2;
    const rtl = document.documentElement.dir === 'rtl';
    const step = event.key === 'ArrowDown' ? columns : event.key === 'ArrowUp' ? -columns : event.key === (rtl ? 'ArrowLeft' : 'ArrowRight') ? 1 : -1;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? ordered.length - 1 : Math.max(0, Math.min(ordered.length - 1, current + step));
    links.current[next]?.focus();
  }}>
    <Dialog.Title className="sr-only">{translateNode("Global search")}</Dialog.Title>
    <div className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-6"><Search aria-hidden="true" className="size-5 shrink-0 text-muted" /><input ref={input} aria-label={translateString("Search pages")} placeholder={translateString("Search...")} value={query} onChange={event => setQuery(event.target.value)} className="min-w-0 flex-1 border-0 bg-transparent text-xl outline-none placeholder:text-muted" /><Dialog.Close aria-label={translateString("Close global search")} className="rounded bg-subtle px-2 py-1 text-xs text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{translateNode("Esc")}</Dialog.Close></div>
    <div className="min-h-0 max-h-[470px] overflow-y-auto overscroll-contain p-5">
      {!ordered.length ? <p role="status" className="py-12 text-center text-sm text-muted">{translateNode("No pages found for “")}{query}{translateNode("”.")}</p> : groups.map(group => <section key={group} aria-label={translateString(group)} className="mb-5 last:mb-0"><h2 className="mb-3 text-sm text-muted">{translateNode(group)}</h2><div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 md:gap-6">{ordered.filter(item => item.group === group).map(item => {
        const index = ordered.indexOf(item);
        return <Link key={item.to} ref={element => { links.current[index] = element; }} to={item.to} onClick={close} className="search-tile flex min-h-[104px] flex-col items-center justify-center gap-2 rounded border border-border p-3 text-center text-sm hover:border-primary hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><item.icon aria-hidden="true" className="size-8 text-primary" /><span>{translateNode(item.label)}</span>{query.trim() && <span className="max-w-full break-all text-[10px] leading-4 text-muted">{item.to}</span>}</Link>;
      })}</div></section>)}
    </div>
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
