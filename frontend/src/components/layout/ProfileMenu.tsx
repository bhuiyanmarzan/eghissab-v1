import { useTranslation } from 'react-i18next';
import { translateNode, translateString } from '../../lib/localization';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CircleHelp, History, LockKeyhole, LogOut, MessageSquare, Pencil, Settings, ShieldAlert, SquareUserRound, UserRound, Wallet } from 'lucide-react';
import { Avatar, Button } from '../ui/primitives';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../store/useAuthStore';
import { logoutUser, logoutAllDevices } from '../../api/auth';

const profileActions = [
  { label: 'Edit Profile', icon: Pencil, to: '/apps/profiles/user/personal' },
  { label: 'View Profile', icon: UserRound, to: '/apps/profiles/account/basic' },
  { label: 'Social Profile', icon: SquareUserRound, to: '/apps/profiles/account/personal' },
  { label: 'Billing', icon: Wallet, to: '/apps/invoice/details/1' },
];
const settingActions = [
  { label: 'Support', icon: CircleHelp, href: 'https://codedthemes.support-hub.io/' },
  { label: 'Account Settings', icon: UserRound, to: '/apps/profiles/account/settings' },
  { label: 'Privacy Center', icon: LockKeyhole, unavailable: true },
  { label: 'Feedback', icon: MessageSquare, href: 'https://codedthemes.support-hub.io/' },
  { label: 'History', icon: History, unavailable: true },
];

export function ProfileMenu() {
  useTranslation();
  const user = useAuthStore((state) => state.user);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'profile' | 'setting'>('profile');
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const profileTab = useRef<HTMLButtonElement>(null);
  const settingTab = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const displayName = user ? `${user.first_name} ${user.last_name || ''}`.trim() : 'User';
  const displayEmail = user?.email || 'user@example.com';
  const displayStatus = user?.status || 'Active';

  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!open) return;
    (tab === 'profile' ? profileTab : settingTab).current?.focus();
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [open, tab]);

  const logout = async () => {
    setOpen(false);
    try {
      await logoutUser();
    } catch {
      // ignore
    } finally {
      useAuthStore.getState().clearAuth();
      navigate('/auth/login', { replace: true });
    }
  };

  const logoutAll = async () => {
    setOpen(false);
    try {
      await logoutAllDevices();
    } catch {
      // ignore
    } finally {
      useAuthStore.getState().clearAuth();
      navigate('/auth/login', { replace: true });
    }
  };
  const actionClass = 'flex w-full items-center gap-4 px-4 py-3 text-start text-sm hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary';

  return <div ref={root} className="relative" onBlur={(event) => {
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
  }}>
    <button ref={trigger} type="button" aria-label={translateString("Open profile")} title={translateString("Profile")} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? 'profile-menu' : undefined}
      onClick={() => setOpen(!open)} className={cn('flex size-9 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', open && 'bg-subtle ring-1 ring-primary')}>
      <Avatar name={displayName} size="sm" />
    </button>
    {open && <div id="profile-menu" role="dialog" aria-label={translateString("User profile")} className="absolute end-0 top-full z-50 mt-3 w-[290px] max-w-[calc(100vw-32px)] overflow-y-auto rounded-md border border-border bg-surface text-ink shadow-lg max-h-[calc(100dvh-80px)]">
      <div className="flex items-center gap-3 px-5 py-6">
        <Avatar name={displayName} size="sm" />
        <div className="min-w-0 flex-1"><p className="text-sm font-semibold truncate">{translateNode(displayName)}</p><p className="mt-0.5 text-xs text-muted truncate">{displayEmail}</p><span className="mt-1 inline-block rounded bg-primary-soft px-1.5 py-0.5 text-[10px] font-medium text-primary uppercase">{displayStatus}</span></div>
        <Button variant="ghost" size="icon" aria-label={translateString("Logout")} title={translateString("Logout")} onClick={logout}><LogOut className="size-5" /></Button>
      </div>
      <div role="tablist" aria-label={translateString("Profile tabs")} className="flex border-b border-border" onKeyDown={(event) => {
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          setTab(event.key === 'Home' ? 'profile' : event.key === 'End' ? 'setting' : tab === 'profile' ? 'setting' : 'profile');
        }
      }}>
        {(['profile', 'setting'] as const).map((value) => {
          const Icon = value === 'profile' ? UserRound : Settings;
          return <button key={value} ref={value === 'profile' ? profileTab : settingTab} type="button" role="tab" id={`profile-tab-${value}`} aria-controls={`profile-panel-${value}`} aria-selected={tab === value} tabIndex={tab === value ? 0 : -1} onClick={() => setTab(value)} className={cn('flex flex-1 items-center justify-center gap-2 border-b-2 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary', tab === value ? 'border-primary text-primary' : 'border-transparent hover:bg-subtle')}><Icon className="size-4" />{translateNode(value === 'profile' ? 'Profile' : 'Setting')}</button>;
        })}
      </div>
      <div role="tabpanel" id={`profile-panel-${tab}`} aria-labelledby={`profile-tab-${tab}`} className="py-1">
        {tab === 'profile' ? <>{profileActions.map(({ label, icon: Icon, to }) => <Link key={label} to={to} onClick={() => setOpen(false)} className={actionClass}><Icon className="size-4" />{translateNode(label)}</Link>)}<button type="button" onClick={logout} className={actionClass}><LogOut className="size-4" />{translateNode("Logout")}</button><button type="button" onClick={logoutAll} className={cn(actionClass, 'text-danger hover:bg-red-50')}><ShieldAlert className="size-4" />{translateNode("Logout All Devices")}</button></> : settingActions.map(({ label, icon: Icon, ...action }) => 'unavailable' in action ? <button key={label} type="button" disabled title={translateString("Not available in this demo")} className={cn(actionClass, 'cursor-not-allowed opacity-50')}><Icon className="size-4" />{translateNode(label)}</button> : 'href' in action ? <a key={label} href={action.href} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className={actionClass}><Icon className="size-4" />{translateNode(label)}</a> : <Link key={label} to={action.to} onClick={() => setOpen(false)} className={actionClass}><Icon className="size-4" />{translateNode(label)}</Link>)}
      </div>
    </div>}
  </div>;
}
