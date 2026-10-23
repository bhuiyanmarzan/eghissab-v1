import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProfileMenu } from './ProfileMenu';

afterEach(cleanup);
function setup() {
  render(<MemoryRouter initialEntries={['/dashboard/analytics']}><Routes>
    <Route path="/dashboard/analytics" element={<><ProfileMenu /><button>Outside</button></>} />
    <Route path="/apps/profiles/user/personal" element={<h1>Edit destination</h1>} />
    <Route path="/apps/profiles/account/settings" element={<h1>Settings destination</h1>} />
    <Route path="/auth/login" element={<h1>Login destination</h1>} />
  </Routes></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Open profile' }));
}

describe('ProfileMenu', () => {
  it('opens, switches tabs with the keyboard, and restores focus on Escape', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'User profile' })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Profile' }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Setting' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('link', { name: 'Account Settings' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open profile' })).toHaveFocus();
  });
  it('dismisses when clicking outside', () => {
    setup();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('navigates to the reference edit profile destination', () => {
    setup();
    fireEvent.click(screen.getByRole('link', { name: 'Edit Profile' }));
    expect(screen.getByRole('heading', { name: 'Edit destination' })).toBeInTheDocument();
  });
  it('navigates to account settings', () => {
    setup();
    fireEvent.click(screen.getByRole('tab', { name: 'Setting' }));
    fireEvent.click(screen.getByRole('link', { name: 'Account Settings' }));
    expect(screen.getByRole('heading', { name: 'Settings destination' })).toBeInTheDocument();
  });
  it('returns to login from logout', () => {
    setup();
    fireEvent.click(screen.getAllByRole('button', { name: 'Logout' })[0]);
    expect(screen.getByRole('heading', { name: 'Login destination' })).toBeInTheDocument();
  });
});
