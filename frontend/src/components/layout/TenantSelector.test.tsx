import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TenantSelector } from './TenantSelector';
import { useTenantStore } from '../../store/useTenantStore';

beforeEach(() => useTenantStore.setState({ selectedTenantId: 'acme' }));
afterEach(cleanup);
async function setup() {
  render(<TenantSelector />);
  fireEvent.keyDown(screen.getByRole('button', { name: 'Select tenant: Acme Corp' }), { key: 'Enter' });
  await screen.findByRole('menu');
}

describe('Tenant selector', () => {
  it('shows the three reference stores and their plans', async () => {
    await setup();
    expect(screen.getByRole('menuitemradio', { name: /Acme Corp/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemradio', { name: /Globex Inc/ })).toHaveTextContent('Pro');
    expect(screen.getByRole('menuitemradio', { name: /Stellar Labs/ })).toBeInTheDocument();
  });
  it('switches tenants, updates the header, and persists across reload', async () => {
    await setup(); fireEvent.click(screen.getByRole('menuitemradio', { name: /Globex Inc/ }));
    expect(screen.getByRole('button', { name: 'Select tenant: Globex Inc.' })).toHaveTextContent('Pro');
    expect(useTenantStore.getState().selectedTenantId).toBe('globex');
    const saved = localStorage.getItem('mantis-tenant')!;
    act(() => { useTenantStore.setState({ selectedTenantId: 'acme' }); });
    localStorage.setItem('mantis-tenant', saved);
    await act(async () => { await useTenantStore.persist.rehydrate(); });
    expect(screen.getByRole('button', { name: 'Select tenant: Globex Inc.' })).toBeInTheDocument();
  });
  it('supports the unbadged tenant and Escape dismissal', async () => {
    await setup(); fireEvent.click(screen.getByRole('menuitemradio', { name: /Stellar Labs/ }));
    const trigger = screen.getByRole('button', { name: 'Select tenant: Stellar Labs' });
    expect(trigger).not.toHaveTextContent('Free'); expect(trigger).not.toHaveTextContent('Pro');
    fireEvent.keyDown(trigger, { key: 'Enter' });
    const menu = await screen.findByRole('menu');
    fireEvent.keyDown(menu, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });
});
