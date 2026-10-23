import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DemoTable, type DemoTableOptions } from './DemoTable';
import { ReactTableExamples } from '../../pages/ReactTablePage';
import { makeReactTableRows } from '../../data/reactTableRows';
import { reactTableFeatures } from '../../lib/reactTable';
import { useReactTableStore } from '../../store/useReactTableStore';
const data = makeReactTableRows();
const update = vi.fn().mockResolvedValue(true);
const create = vi.fn().mockResolvedValue(true);
const remove = vi.fn().mockResolvedValue(true);
const show = (options: DemoTableOptions, rows = data.slice(0, 10)) =>
  render(
    <DemoTable
      data={rows}
      options={options}
      prefKey="test"
      onUpdate={update}
      onCreate={create}
      onDelete={remove}
    />,
  );
const bodyRows = (name: string) =>
  within(screen.getByRole('table', { name })).getAllByRole('row').slice(1);
beforeEach(() => {
  useReactTableStore.setState({ preferences: {} });
  update.mockClear().mockResolvedValue(true);
  create.mockClear().mockResolvedValue(true);
  remove.mockClear().mockResolvedValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe('React Table examples', () => {
  it.each(reactTableFeatures)(
    'renders the %s feature without using the customer page',
    (feature) => {
      render(
        <ReactTableExamples
          feature={feature}
          rows={data}
          tenant="acme"
          onUpdate={update}
          onCreate={create}
          onDelete={remove}
        />,
      );
      expect(screen.getAllByRole('table').length).toBeGreaterThan(0);
      if (feature === 'empty') expect(screen.getByText('No records found')).toBeInTheDocument();
      if (feature === 'basic') expect(screen.getAllByRole('table')).toHaveLength(3);
      if (feature === 'virtualized') {
        expect(screen.getAllByRole('row').length).toBeLessThan(50);
        expect(screen.getByRole('table', { name: 'Virtualized Rows' })).toBeInTheDocument();
      }
    },
  );
  it('toggles dense rows and supports ascending and descending sort', () => {
    const view = show({ title: 'Test', dense: true, sorting: true });
    fireEvent.click(screen.getByRole('switch', { name: 'Dense' }));
    expect(screen.getByRole('table')).not.toHaveClass('rt-dense');
    fireEvent.click(screen.getByRole('button', { name: 'Name' }));
    expect(bodyRows('Test')[0]).toHaveTextContent('Antonio Sharp');
    fireEvent.click(screen.getByRole('button', { name: 'Name' }));
    expect(bodyRows('Test')[0]).toHaveTextContent('Verna Henderson');
    view.unmount();
  });
  it('combines text, numeric range and status filters', () => {
    show({ title: 'Test', filtering: true });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Minimum Age' }), {
      target: { value: '50' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter Status' }), {
      target: { value: 'Complicated' },
    });
    expect(bodyRows('Test')).toHaveLength(2);
    fireEvent.change(screen.getByRole('textbox', { name: 'Search Name' }), {
      target: { value: 'Louisa' },
    });
    expect(bodyRows('Test')).toHaveLength(1);
    fireEvent.change(screen.getByRole('textbox', { name: 'Search records — Test' }), {
      target: { value: 'missing' },
    });
    expect(screen.getByText('No records found')).toBeInTheDocument();
  });
  it('groups rows, expands a group and returns to a flat table', () => {
    show({ title: 'Test', fields: ['name', 'age', 'visits', 'status'], grouping: true }, data);
    const groups = bodyRows('Test').length;
    fireEvent.click(screen.getAllByRole('button', { name: /Expand group/ })[0]);
    expect(bodyRows('Test').length).toBeGreaterThan(groups);
    fireEvent.click(screen.getByRole('button', { name: 'Clear grouping' }));
    expect(bodyRows('Test')).toHaveLength(100);
  });
  it('selects all filtered rows across pages and preserves stable row identifiers', () => {
    show({ title: 'Test', selection: 'all', pagination: 'bottom', sorting: true }, data);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all filtered rows — Test' }));
    expect(screen.getByText('100 row(s) selected')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Go to next page' }));
    expect(screen.getByRole('checkbox', { name: 'Select all filtered rows — Test' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(screen.getByText('0 row(s) selected')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Go to page — Test' }), {
      target: { value: '10' },
    });
    expect(screen.getByRole('button', { name: 'Page 10' })).toHaveAttribute('aria-current', 'page');
  });
  it('expands nested rows and user detail panels', () => {
    const view = show({ title: 'Test', expansion: 'tree' });
    fireEvent.click(screen.getByRole('button', { name: 'Expand row acme-1' }));
    expect(bodyRows('Test')).toHaveLength(12);
    view.unmount();
    show({ title: 'Details', expansion: 'details' });
    fireEvent.click(screen.getByRole('button', { name: 'Expand row acme-1' }));
    expect(screen.getByText('100 Main Street')).toBeInTheDocument();
  });
  it('validates row edits and saves the correct record', async () => {
    show({ title: 'Test', editing: 'row' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit row acme-1' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Email — acme-1' }), {
      target: { value: 'bad' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save row acme-1' }));
    expect(screen.getByText('Enter a valid email')).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('textbox', { name: 'Email — acme-1' }), {
      target: { value: 'edited@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save row acme-1' }));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        'acme-1',
        expect.objectContaining({ email: 'edited@example.com' }),
      ),
    );
  });
  it('commits a cell on blur and does not report success when saving fails', async () => {
    update.mockResolvedValue(false);
    show({ title: 'Test', editing: 'cell' });
    const input = screen.getByRole('textbox', { name: 'Name — acme-1' });
    fireEvent.change(input, { target: { value: 'Edited name' } });
    fireEvent.blur(input);
    expect(await screen.findByText('Unable to save changes. Try again.')).toBeInTheDocument();
    expect(update).toHaveBeenCalledWith('acme-1', { name: 'Edited name' });
  });
  it('reorders rows with a drag event and keyboard controls', () => {
    show({ title: 'Test', drag: 'rows' });
    const transfer = { setData: vi.fn(), getData: () => 'acme-1', effectAllowed: 'move' };
    fireEvent.dragStart(screen.getByRole('button', { name: 'Move row acme-1' }), {
      dataTransfer: transfer,
    });
    fireEvent.drop(screen.getByRole('button', { name: 'Move row acme-3' }).closest('tr')!, {
      dataTransfer: transfer,
    });
    expect(bodyRows('Test')[0]).toHaveTextContent('Betty Dennis');
    expect(useReactTableStore.getState().preferences.test.rowOrder?.[2]).toBe('acme-1');
    fireEvent.keyDown(screen.getByRole('button', { name: 'Move row acme-2' }), {
      key: 'ArrowDown',
    });
    expect(bodyRows('Test')[0]).toHaveTextContent('Fanny Innocenti');
  });
  it('reorders columns and resizes them using the keyboard', () => {
    const view = show({ title: 'Test', drag: 'columns' });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Move column Name' }), {
      key: 'ArrowRight',
      altKey: true,
    });
    expect(screen.getAllByRole('columnheader')[0]).toHaveTextContent('Email');
    view.unmount();
    show({ title: 'Resize', resizing: true });
    const separator = screen.getByRole('separator', { name: 'Resize Name' });
    fireEvent.keyDown(separator, { key: 'ArrowRight' });
    expect(separator).toHaveAttribute('aria-valuenow', '210');
    fireEvent.click(screen.getByRole('button', { name: 'Reset column widths' }));
    expect(separator).toHaveAttribute('aria-valuenow', '200');
  });
  it('hides columns and can recover from hiding every column', async () => {
    show({ title: 'Test', visibility: true });
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Show columns — Test' }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'Email' }));
    expect(screen.queryByRole('columnheader', { name: 'Email' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Toggle all columns' }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Toggle all columns' }));
    expect(screen.getByText('No columns selected')).toBeInTheDocument();
  });
  it('supports view, creation and canceling deletion in the combined example', async () => {
    show({ title: 'Test', umbrella: true });
    fireEvent.click(screen.getByRole('button', { name: 'View record acme-1' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Louisa Payet');
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete record acme-1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Add Record' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });
});
