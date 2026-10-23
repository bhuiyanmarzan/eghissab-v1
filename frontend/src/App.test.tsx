import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { allApplicationRoutes } from './data/navigation';

describe('App', () => {
  it('renders the login route', async () => {
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={['/auth/login']}><App /></MemoryRouter></QueryClientProvider>);
    expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument();
  });

  it('keeps the captured route catalog complete', () => {
    expect(allApplicationRoutes).toHaveLength(126);
  });
});
