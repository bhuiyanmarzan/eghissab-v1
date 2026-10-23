import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { GlobalSearch } from './GlobalSearch';
import { searchPages } from '../../lib/globalSearch';

afterEach(cleanup);
function setup() {
  render(<MemoryRouter initialEntries={['/dashboard/default']}><GlobalSearch /><Routes><Route path="/dashboard/default" element={<h1>Dashboard</h1>} /><Route path="/dashboard/analytics" element={<h1>Analytics destination</h1>} /><Route path="/pricing" element={<h1>Pricing destination</h1>} /></Routes></MemoryRouter>);
}
function open() { fireEvent.click(screen.getByRole('button', { name: 'Open global search' })); return within(screen.getByRole('dialog')); }

describe('Global search', () => {
  it('opens the reference groups with page tiles and focuses the input', () => {
    setup(); const panel = open();
    expect(panel.getByRole('heading', { name: 'Dashboards' })).toBeInTheDocument();
    expect(panel.getByRole('heading', { name: 'Plugins' })).toBeInTheDocument();
    expect(panel.getByRole('link', { name: 'Analytics' })).toHaveAttribute('href', '/dashboard/analytics');
    expect(panel.getByRole('textbox', { name: 'Search pages' })).toHaveFocus();
  });
  it('filters all application pages, including routes missing from the old header menu', () => {
    setup(); const panel = open();
    fireEvent.change(panel.getByRole('textbox', { name: 'Search pages' }), { target: { value: 'forms sticky' } });
    expect(panel.getByRole('link', { name: /Sticky Bar/ })).toHaveAttribute('href', '/forms/layout/sticky-bar');
    fireEvent.change(panel.getByRole('textbox', { name: 'Search pages' }), { target: { value: 'not-a-real-page-zz' } });
    expect(panel.getByRole('status')).toHaveTextContent('No pages found');
    expect(panel.queryByRole('link')).not.toBeInTheDocument();
    expect(searchPages('Customers').some(item => item.to === '/apps/customer/customer-list')).toBe(true);
  });
  it.each(['ctrlKey', 'metaKey'])('opens using %s + K', key => {
    setup(); fireEvent.keyDown(document, { key: 'k', [key]: true });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
  it('navigates by selecting a tile', () => {
    setup(); const panel = open();
    fireEvent.click(panel.getByRole('link', { name: 'Analytics' }));
    expect(screen.getByRole('heading', { name: 'Analytics destination' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('supports arrows through results and Enter from the search input', () => {
    setup(); const panel = open(); const input = panel.getByRole('textbox', { name: 'Search pages' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(panel.getByRole('link', { name: 'Default' })).toHaveFocus();
    fireEvent.keyDown(panel.getByRole('link', { name: 'Default' }), { key: 'ArrowRight' });
    expect(panel.getByRole('link', { name: 'Analytics' })).toHaveFocus();
    fireEvent.change(input, { target: { value: 'Pricing' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByRole('heading', { name: 'Pricing destination' })).toBeInTheDocument();
  });
  it('clears the query and restores focus when Escape closes search', async () => {
    setup(); const panel = open();
    fireEvent.change(panel.getByRole('textbox', { name: 'Search pages' }), { target: { value: 'Pricing' } });
    fireEvent.keyDown(panel.getByRole('textbox', { name: 'Search pages' }), { key: 'Escape' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open global search' })).toHaveFocus());
    expect(open().getByRole('textbox', { name: 'Search pages' })).toHaveValue('');
  });
});
