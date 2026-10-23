import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { navigation, type NavGroup } from '../../data/navigation';
import {
  activeSidebarPath,
  expandedSidebarPath,
  matchesRoute,
  sidebarSections,
  type SidebarNode,
} from '../../data/sidebarNavigation';
import { useAppStore } from '../../store/useAppStore';
import { Avatar } from '../ui/primitives';
import { translateString } from '../../lib/localization';
import { cn } from '../../lib/utils';
const topNodes = sidebarSections.flatMap((section) => section.nodes);
export function SharedNavigation() {
  useTranslation();
  const { sidebarOpen, layout, direction, setSidebarOpen } = useAppStore();
  const { pathname } = useLocation();
  const [expanded, setExpanded] = useState<Record<number, string>>(() =>
    expandedSidebarPath(pathname),
  );
  const [flyout, setFlyout] = useState<string | null>(null);
  const [horizontal, setHorizontal] = useState<string | null>(null);
  const [flyoutTop, setFlyoutTop] = useState(64);
  const root = useRef<HTMLDivElement>(null);
  const activePath = activeSidebarPath(pathname);
  const current = activePath.at(-1)?.id;
  const rootActiveId = activePath[0]?.id;
  const activeIds = new Set(activePath.map((node) => node.id));
  const flyoutNode = topNodes.find((node) => node.id === flyout);
  const focusToggle = () =>
    document.querySelector<HTMLButtonElement>('[aria-controls="application-navigation"]')?.focus();
  useEffect(() => {
    setExpanded(expandedSidebarPath(pathname));
    setFlyout(null);
    setHorizontal(null);
  }, [pathname]);
  useEffect(() => {
    setFlyout(null);
    setHorizontal(null);
  }, [layout, sidebarOpen, direction]);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        setFlyout(null);
        setHorizontal(null);
      }
    };
    const keyboard = (event: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"][aria-modal="true"], [role="menu"]')) return;
      if (event.key === 'Escape') {
        if (flyout)
          root.current
            ?.querySelector<HTMLButtonElement>(`[data-sidebar-trigger="${flyout}"]`)
            ?.focus();
        setFlyout(null);
        setHorizontal(null);
        if (window.innerWidth < 1024 && sidebarOpen) {
          setSidebarOpen(false);
          document
            .querySelector<HTMLButtonElement>('[aria-controls="application-navigation"]')
            ?.focus();
        }
      }
      if (event.key === 'Tab' && window.innerWidth < 1024 && sidebarOpen) {
        const panel = root.current?.querySelector('.app-sidebar');
        const controls = Array.from(
          panel?.querySelectorAll<HTMLElement>('button, a[href]') ?? [],
        ).filter((element) => element.getClientRects().length > 0);
        const first = controls[0],
          last = controls.at(-1);
        if (!panel?.contains(document.activeElement)) {
          event.preventDefault();
          (event.shiftKey ? last : first)?.focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', keyboard);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', keyboard);
    };
  }, [sidebarOpen, setSidebarOpen, flyout]);
  useEffect(() => {
    if (!sidebarOpen || window.innerWidth >= 1024) return;
    const panel = root.current?.querySelector('.app-sidebar');
    (
      panel?.querySelector<HTMLElement>('a[aria-current="page"]') ??
      panel?.querySelector<HTMLElement>('.sidebar-row.is-ancestor') ??
      panel?.querySelector<HTMLElement>('button')
    )?.focus({ preventScroll: true });
  }, [sidebarOpen]);
  useEffect(() => {
    if (window.innerWidth < 1024 && !sidebarOpen) return;
    const scroll = root.current?.querySelector<HTMLElement>('.sidebar-scroll');
    const selected = sidebarOpen
      ? scroll?.querySelector<HTMLElement>('a[aria-current="page"]')
      : scroll?.querySelector<HTMLElement>(
          `[data-sidebar-trigger="${rootActiveId}"], [data-sidebar-leaf="${rootActiveId}"]`,
        );
    if (!scroll || !selected) return;
    const viewport = scroll.getBoundingClientRect(),
      row = selected.getBoundingClientRect();
    if (!row.height) return;
    if (row.bottom > viewport.bottom) scroll.scrollTop += row.bottom - viewport.bottom + 12;
    else if (row.top < viewport.top) scroll.scrollTop += row.top - viewport.top - 12;
  }, [pathname, current, rootActiveId, expanded, sidebarOpen]);
  useEffect(() => {
    const popup = root.current?.querySelector<HTMLElement>('.sidebar-popup');
    const selected = popup?.querySelector<HTMLElement>('a[aria-current="page"]');
    if (!popup || !selected || popup.contains(document.activeElement)) return;
    const frame = popup.getBoundingClientRect(), row = selected.getBoundingClientRect();
    if (row.bottom > frame.bottom) popup.scrollTop += row.bottom - frame.bottom + 8;
    else if (row.top < frame.top) popup.scrollTop += row.top - frame.top - 8;
  }, [flyout, current, expanded]);
  const navigate = () => {
    setFlyout(null);
    setHorizontal(null);
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
      focusToggle();
    }
  };
  const toggle = (id: string, depth: number) =>
    setExpanded((old) => {
      const next = Object.fromEntries(
        Object.entries(old).filter(([level]) => Number(level) < depth),
      );
      if (old[depth] !== id) next[depth] = id;
      return next;
    });
  function showFlyout(node: SidebarNode, button: HTMLElement, focus = false) {
    setFlyoutTop(
      Math.max(64, Math.min(button.getBoundingClientRect().top, window.innerHeight - 300)),
    );
    setFlyout(node.id);
    if (focus)
      queueMicrotask(() =>
        root.current
          ?.querySelector<HTMLElement>(`#nav-flyout-${node.id} a, #nav-flyout-${node.id} button`)
          ?.focus(),
      );
  }
  function renderNode(
    node: SidebarNode,
    depth = 0,
    mode: 'sidebar' | 'flyout' = 'sidebar',
  ): React.ReactNode {
    const rail = mode === 'sidebar' && depth === 0 && !sidebarOpen && window.innerWidth >= 1024;
    const open = rail ? flyout === node.id : expanded[depth] === node.id;
    const branch = !!node.children?.length;
    const label = translateString(node.label);
    const Icon = node.icon;
    const contents = (
      <>
        {Icon && (
          <span className="sidebar-row-icon">
            <Icon className="size-[18px]" />
          </span>
        )}
        <span className="nav-label sidebar-label">{label}</span>
        {node.badge && (
          <span
            className={cn(
              'nav-label sidebar-badge',
              node.badge === 'AI' && 'sidebar-badge-ai',
              node.id === 'ai' && 'sidebar-badge-danger',
            )}
          >
            {translateString(node.badge)}
          </span>
        )}
        {branch && (
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'nav-label ms-auto size-3 shrink-0 transition-transform',
              open && 'rotate-180',
            )}
          />
        )}
      </>
    );
    const rowClass = cn(
      'sidebar-row',
      depth === 0 && 'nav-group',
      current === node.id && 'is-current',
      branch && activeIds.has(node.id) && 'is-ancestor',
    );
    const style = {
      '--nav-depth': mode === 'flyout' ? Math.max(0, depth - 1) : depth,
    } as React.CSSProperties;
    return (
      <li key={node.id}>
        {branch ? (
          <button
            type="button"
            data-sidebar-trigger={node.id}
            className={rowClass}
            style={style}
            title={label}
            aria-label={label}
            aria-expanded={open}
            aria-controls={rail ? `nav-flyout-${node.id}` : `${mode}-children-${node.id}`}
            onMouseEnter={(event) => {
              if (rail) showFlyout(node, event.currentTarget);
            }}
            onFocus={(event) => {
              if (rail) showFlyout(node, event.currentTarget);
            }}
            onClick={(event) => {
              if (rail) {
                if (flyout === node.id) setFlyout(null);
                else showFlyout(node, event.currentTarget);
              } else toggle(node.id, depth);
            }}
            onKeyDown={(event) => {
              if (event.key === (direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight')) {
                event.preventDefault();
                if (rail) showFlyout(node, event.currentTarget, true);
                else {
                  if (!open) toggle(node.id, depth);
                  queueMicrotask(() =>
                    root.current
                      ?.querySelector<HTMLElement>(
                        `#${mode}-children-${node.id} a, #${mode}-children-${node.id} button`,
                      )
                      ?.focus(),
                  );
                }
              }
            }}
          >
            {contents}
          </button>
        ) : (
          <Link
            to={node.to!}
            data-sidebar-leaf={node.id}
            className={rowClass}
            style={style}
            aria-label={label}
            title={label}
            aria-current={current === node.id ? 'page' : undefined}
            onClick={navigate}
            onMouseEnter={() => {
              if (depth === 0 && mode === 'sidebar') setFlyout(null);
            }}
            onFocus={() => {
              if (depth === 0 && mode === 'sidebar') setFlyout(null);
            }}
          >
            {contents}
          </Link>
        )}
        {branch && expanded[depth] === node.id && (
          <ul
            id={`${mode}-children-${node.id}`}
            className={cn(
              'sidebar-children m-0 list-none p-0',
              mode === 'sidebar' && 'nav-children',
            )}
          >
            {node.children!.map((child) => renderNode(child, depth + 1, mode))}
          </ul>
        )}
      </li>
    );
  }
  function horizontalActive(group: NavGroup) {
    const prefixes: Record<string, string[]> = {
      Dashboard: ['/dashboard'],
      Widgets: ['/widget'],
      Applications: ['/apps'],
      Forms: ['/forms'],
      Tables: ['/tables'],
      Charts: ['/charts', '/map'],
      Components: ['/components-overview'],
    };
    return (prefixes[group.label] ?? group.items.map((item) => item.to)).some((prefix) =>
      matchesRoute(pathname, prefix),
    );
  }
  return (
    <div ref={root} onMouseLeave={() => setFlyout(null)}>
      <aside
        id="application-navigation"
        className={cn('app-sidebar border-border bg-surface', sidebarOpen && 'is-open')}
        aria-label={translateString('Sidebar navigation')}
      >
        <nav aria-label={translateString('Main navigation')} className="sidebar-scroll">
          {sidebarSections.map((section) => (
            <section
              key={section.id}
              className={cn('sidebar-section', section.divider && 'sidebar-section-divider')}
            >
              {section.label && (
                <h2 className="nav-caption sidebar-caption">{translateString(section.label)}</h2>
              )}
              <ul className="m-0 list-none p-0">{section.nodes.map((node) => renderNode(node))}</ul>
            </section>
          ))}
        </nav>
        <Link
          to="/apps/profiles/account/basic"
          onClick={navigate}
          aria-label={translateString('Open account profile')}
          className="sidebar-user flex shrink-0 items-center gap-3 border-t border-border px-5 py-4 hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
        >
          <Avatar name="John Doe" />
          <span className="nav-label min-w-0 flex-1">
            <strong className="block truncate text-sm font-medium">John Doe</strong>
            <span className="block text-[11px] text-muted">
              {translateString('UI/UX Designer')}
            </span>
          </span>
          <ChevronRight className="nav-label size-4 text-muted rtl:rotate-180" />
        </Link>
      </aside>
      <nav
        aria-label={translateString('Horizontal navigation')}
        className="app-horizontal border-b border-border bg-surface"
      >
        {navigation.map((group) => (
          <div
            key={group.label}
            className="relative"
            onMouseEnter={() => setHorizontal(group.label)}
            onMouseLeave={() => setHorizontal(null)}
          >
            <button
              type="button"
              aria-expanded={horizontal === group.label}
              onClick={() => setHorizontal((old) => (old === group.label ? null : group.label))}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-3 text-sm hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                horizontalActive(group) && 'text-primary',
              )}
            >
              <group.icon className="size-4" />
              {translateString(group.label)}
              <ChevronDown className="size-3" />
            </button>
            {horizontal === group.label && (
              <div className="absolute start-0 top-full z-40 max-h-[calc(100dvh-140px)] w-60 overflow-y-auto rounded-md border border-border bg-surface p-2 shadow-lg">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={navigate}
                    className={({ isActive }) =>
                      cn(
                        'block rounded px-3 py-2 text-sm hover:bg-subtle focus-visible:ring-2 focus-visible:ring-primary',
                        isActive && 'bg-primary-soft text-primary',
                      )
                    }
                  >
                    {translateString(item.label)}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
      {layout !== 'horizontal' && !sidebarOpen && flyoutNode?.children && (
        <nav
          id={`nav-flyout-${flyoutNode.id}`}
          aria-label={`${translateString(flyoutNode.label)} ${translateString('submenu')}`}
          className="nav-flyout sidebar-popup fixed z-40 max-h-[calc(100dvh-80px)] w-60 overflow-y-auto rounded-md border border-border bg-surface py-2 shadow-lg"
          style={{ top: flyoutTop, insetInlineStart: 60, maxHeight: `calc(100dvh - ${flyoutTop}px - 16px)` }}
        >
          <h2 className="px-4 py-2 text-sm font-semibold">{translateString(flyoutNode.label)}</h2>
          <ul className="m-0 list-none p-0">
            {flyoutNode.children.map((child) => renderNode(child, 1, 'flyout'))}
          </ul>
        </nav>
      )}
      {sidebarOpen && (
        <button
          aria-label={translateString('Close navigation')}
          className="fixed inset-0 top-16 z-20 bg-black/20 lg:hidden"
          onClick={() => {
            setSidebarOpen(false);
            focusToggle();
          }}
        />
      )}
    </div>
  );
}
