import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db, recordSale, type Item } from '../db';
import { StockScreen } from './StockScreen';

const shirt: Item = {
  id: 1,
  name: 'Shirt',
  price: 25,
  variants: [
    { name: 'M', startCount: 10 },
    { name: 'L', startCount: 12 },
  ],
  sortOrder: 1,
};

beforeEach(async () => {
  await db.delete();
  await db.open();
  localStorage.clear();
});

const editor = () => screen.getByRole('dialog');
const sheetGone = () =>
  waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

describe('stock list', () => {
  it('shows each variant as left/start, folding in sales', async () => {
    await db.items.add(shirt);
    await recordSale(shirt, 'M', 'cash');
    render(<StockScreen />);

    const card = await screen.findByRole('button', { name: /Shirt/ });
    await waitFor(() => expect(card).toHaveTextContent('M9/10'));
    expect(card).toHaveTextContent('L12/12');
    expect(card).toHaveTextContent('$25');
  });

  it('shows the setup hint when there is no merch yet', async () => {
    render(<StockScreen />);
    expect(await screen.findByText('Set up your merch at home, on wifi.')).toBeInTheDocument();
  });
});

describe('item editor sheet', () => {
  it('adds a one-size item', async () => {
    const user = userEvent.setup();
    render(<StockScreen />);

    await user.click(await screen.findByRole('button', { name: 'Add item' }));
    expect(editor()).toHaveAccessibleName('New item');

    await user.type(screen.getByLabelText('Name'), 'Sticker');
    await user.type(screen.getByLabelText(/Price/), '5');
    await user.type(screen.getByLabelText('Variant 1 count'), '40');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await sheetGone();
    const card = await screen.findByRole('button', { name: /Sticker/ });
    expect(card).toHaveTextContent('$5');
    expect(card).toHaveTextContent('one size40/40');
  });

  it('opens an existing item prefilled and saves edits', async () => {
    await db.items.add(shirt);
    const user = userEvent.setup();
    render(<StockScreen />);

    await user.click(await screen.findByRole('button', { name: /Shirt/ }));
    expect(editor()).toHaveAccessibleName('Edit item');
    expect(screen.getByLabelText('Name')).toHaveValue('Shirt');
    expect(screen.getByLabelText(/Price/)).toHaveValue(25);
    expect(screen.getByLabelText('Variant 2 name')).toHaveValue('L');

    await user.clear(screen.getByLabelText(/Price/));
    await user.type(screen.getByLabelText(/Price/), '30');
    await user.click(screen.getByRole('button', { name: 'Remove variant 2' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await sheetGone();
    const card = screen.getByRole('button', { name: /Shirt/ });
    await waitFor(() => expect(card).toHaveTextContent('$30'));
    expect(card).toHaveTextContent('M10/10');
    expect(card).not.toHaveTextContent('L12/12');
  });

  it('adds a variant row on demand', async () => {
    const user = userEvent.setup();
    render(<StockScreen />);

    await user.click(await screen.findByRole('button', { name: 'Add item' }));
    expect(screen.queryByLabelText('Variant 2 name')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add variant' }));
    expect(screen.getByLabelText('Variant 2 name')).toBeInTheDocument();
  });

  it('cancel discards the draft', async () => {
    const user = userEvent.setup();
    render(<StockScreen />);

    await user.click(await screen.findByRole('button', { name: 'Add item' }));
    await user.type(screen.getByLabelText('Name'), 'Poster');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await sheetGone();
    expect(screen.queryByRole('button', { name: /Poster/ })).not.toBeInTheDocument();
    expect(screen.getByText('Set up your merch at home, on wifi.')).toBeInTheDocument();
  });

  it('deletes an item after confirmation', async () => {
    await db.items.add(shirt);
    const confirm = vi.fn(() => true);
    vi.stubGlobal('confirm', confirm);
    const user = userEvent.setup();
    render(<StockScreen />);

    await user.click(await screen.findByRole('button', { name: /Shirt/ }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(confirm).toHaveBeenCalledWith('Delete "Shirt"? Past sales stay in the log.');
    await sheetGone();
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Shirt/ })).not.toBeInTheDocument(),
    );
    vi.unstubAllGlobals();
  });

  it('keeps the item when delete is not confirmed', async () => {
    await db.items.add(shirt);
    vi.stubGlobal('confirm', () => false);
    const user = userEvent.setup();
    render(<StockScreen />);

    await user.click(await screen.findByRole('button', { name: /Shirt/ }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(editor()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Shirt/ })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('refuses to save without a name', async () => {
    const user = userEvent.setup();
    render(<StockScreen />);

    await user.click(await screen.findByRole('button', { name: 'Add item' }));
    await user.type(screen.getByLabelText(/Price/), '5');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(editor()).toBeInTheDocument();
    expect(screen.getByText('Set up your merch at home, on wifi.')).toBeInTheDocument();
  });
});
