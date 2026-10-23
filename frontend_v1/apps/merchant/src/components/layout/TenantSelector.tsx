import { useTranslation } from 'react-i18next';
import { translateNode, translateString } from '../../lib/localization';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Atom, BriefcaseBusiness, ChevronDown } from 'lucide-react';
import { tenants, useTenantStore, type Tenant } from '../../store/useTenantStore';
import { useAppStore } from '../../store/useAppStore';
import { cn } from '../../lib/utils';

function TenantSymbol({ tenant }: { tenant: Tenant }) {
  useTranslation();
  if (tenant.symbol === 'sphere') return <span aria-hidden="true" className="size-5 shrink-0 rounded-full" style={{ background: 'conic-gradient(#29b6cf 0deg 90deg, #54c8df 90deg 180deg, #199bb6 180deg 270deg, #3db8d4 270deg)' }} />;
  if (tenant.symbol === 'atom') return <Atom aria-hidden="true" className="size-5 shrink-0 text-primary" />;
  return <BriefcaseBusiness aria-hidden="true" className="size-5 shrink-0 text-amber-600" />;
}
function Plan({ tenant }: { tenant: Tenant }) {
  useTranslation();
  return tenant.plan && <span className={cn('rounded px-1.5 py-0.5 text-xs leading-none', tenant.plan === 'Pro' ? 'bg-primary text-white' : 'bg-subtle text-ink')}>{translateNode(tenant.plan)}</span>;
}
export function TenantSelector() {
  useTranslation();
  const direction = useAppStore(state => state.direction);
  const { selectedTenantId, selectTenant } = useTenantStore();
  const selected = tenants.find(tenant => tenant.id === selectedTenantId) ?? tenants[0];
  return <DropdownMenu.Root dir={direction}><DropdownMenu.Trigger asChild>
    <button type="button" aria-label={translateString(`Select tenant: ${selected.name}`)} title={`${selected.name}${selected.plan ? ` · ${translateString(selected.plan)}` : ''}`} className="tenant-trigger ms-2 flex h-9 shrink-0 items-center gap-2 rounded border border-border bg-surface px-2 text-sm hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <TenantSymbol tenant={selected} /><span className="tenant-name truncate">{selected.name}</span><span className="tenant-plan"><Plan tenant={selected} /></span><ChevronDown aria-hidden="true" className="tenant-chevron ms-auto size-3 text-muted" />
    </button>
  </DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content align="start" sideOffset={8} collisionPadding={12} className="z-[70] min-w-[200px] rounded-md border border-border bg-surface p-1 text-ink shadow-lg">
    <DropdownMenu.RadioGroup value={selected.id} onValueChange={selectTenant} aria-label={translateString("Stores and tenants")}>
      {tenants.map(tenant => <DropdownMenu.RadioItem key={tenant.id} value={tenant.id} className={cn('flex cursor-pointer items-center gap-3 rounded px-2 py-2 text-xs outline-none data-[highlighted]:bg-primary-soft data-[highlighted]:text-primary', selected.id === tenant.id && 'bg-subtle')}>
        <TenantSymbol tenant={tenant} /><span className="flex-1">{tenant.name}</span><Plan tenant={tenant} />
      </DropdownMenu.RadioItem>)}
    </DropdownMenu.RadioGroup>
  </DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root>;
}
