import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, getSetting, recordSale, startNewNight, type Item } from '../db';
import { NightScreen } from './NightScreen';

const shirt: Item = {
  id: 1,
  name: 'Shirt',
  price: 25,
  variants: [{ name: 'M', startCount: 10 }],
  sortOrder: 1,
};

beforeEach(async () => {
  await db.delete();
  await db.open();
  localStorage.clear();
  await db.items.add(shirt);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('#1 cash box reconciliation', () => {
  const startNightWithSales = async (float: number) => {
    await startNewNight(float);
    const nightStart = await getSetting('nightStart');
    await recordSale(shirt, 'M', 'cash'); // +25 cash
    await recordSale(shirt, 'M', 'digital'); // digital must not enter drawer math
    return nightStart;
  };

  it('expected drawer = float + cash sales, digital excluded', async () => {
    const nightStart = await startNightWithSales(100);
    render(<NightScreen nightStart={nightStart} />);

    await waitFor(() =>
      expect(screen.getByText(/should be in the box/)).toHaveTextContent(
        'Starting cash $100 + cash sales $25 = $125 that should be in the box',
      ),
    );
  });

  it('flags a short drawer against expected total, not raw sales', async () => {
    const nightStart = await startNightWithSales(100);
    const user = userEvent.setup();
    render(<NightScreen nightStart={nightStart} />);

    await user.type(await screen.findByLabelText(/How much is in the box now/), '120');

    expect(screen.getByText('$5 less than expected')).toBeInTheDocument();
  });

  it('confirms a matching count', async () => {
    const nightStart = await startNightWithSales(100);
    const user = userEvent.setup();
    render(<NightScreen nightStart={nightStart} />);

    await user.type(await screen.findByLabelText(/How much is in the box now/), '125');

    expect(screen.getByText('Your cash box matches')).toBeInTheDocument();
  });

  it('flags an over drawer', async () => {
    const nightStart = await startNightWithSales(0);
    const user = userEvent.setup();
    render(<NightScreen nightStart={nightStart} />);

    await user.type(await screen.findByLabelText(/How much is in the box now/), '30');

    expect(screen.getByText('$5 more than expected')).toBeInTheDocument();
  });
});

describe('night boundary', () => {
  it('sales before the night start stay out of tonight but stay in inventory', async () => {
    await recordSale(shirt, 'M', 'cash'); // previous night
    await startNewNight(0);
    const nightStart = await getSetting('nightStart');
    render(<NightScreen nightStart={nightStart} />);

    expect(await screen.findByText('No sales yet tonight.')).toBeInTheDocument();
    // remaining inventory folds over ALL nights: 10 - 1
    await waitFor(() => expect(screen.getByRole('cell', { name: '9' })).toBeInTheDocument());
  });
});

describe('#3 negative stock flag', () => {
  it('warns to recount when an item sells past zero', async () => {
    await db.items.update(1, { variants: [{ name: 'M', startCount: 0 }] });
    await recordSale(shirt, 'M', 'cash');
    render(<NightScreen nightStart={0} />);

    await waitFor(() =>
      expect(screen.getByText(/sold more than you had in stock\. Count these again before the next show/)).toBeInTheDocument(),
    );
    expect(screen.getByRole('cell', { name: '-1 · recount' })).toBeInTheDocument();
  });
});

describe('start new night sheet', () => {
  it('prefills the last float and records the new one', async () => {
    await startNewNight(80);
    const nightStart = await getSetting('nightStart');
    const user = userEvent.setup();
    render(<NightScreen nightStart={nightStart} />);

    await user.click(await screen.findByRole('button', { name: 'Start new night' }));
    const float = await screen.findByLabelText('Starting cash');
    await waitFor(() => expect(float).toHaveValue(80));

    await user.clear(float);
    await user.type(float, '50');
    await user.click(screen.getByRole('button', { name: 'Start night' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByText(/should be in the box/)).toHaveTextContent('Starting cash $50'),
    );
  });

  it('cancel leaves the night alone', async () => {
    await startNewNight(80);
    const nightStart = await getSetting('nightStart');
    const user = userEvent.setup();
    render(<NightScreen nightStart={nightStart} />);

    await user.click(await screen.findByRole('button', { name: 'Start new night' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText(/should be in the box/)).toHaveTextContent('Starting cash $80');
  });
});

describe('share summary', () => {
  const withSale = async () => {
    await recordSale(shirt, 'M', 'cash');
    const user = userEvent.setup(); // installs a clipboard stub on navigator
    render(<NightScreen nightStart={0} />);
    const share = await screen.findByRole('button', { name: 'Share summary' });
    await waitFor(() => expect(share).toBeEnabled());
    return { user, share };
  };

  it('copies to the clipboard and confirms on the button', async () => {
    const { user, share } = await withSale();
    const write = vi.spyOn(navigator.clipboard, 'writeText');

    await user.click(share);

    expect(write.mock.calls[0][0]).toContain('Shirt M: 1');
    expect(await screen.findByRole('button', { name: 'Copied to clipboard' })).toBeInTheDocument();
  });

  it('falls back to a sheet with the text when the clipboard is unavailable', async () => {
    const { user, share } = await withSale();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));

    await user.click(share);

    const sheet = await screen.findByRole('dialog', { name: 'Night summary' });
    expect(sheet).toHaveTextContent('Shirt M: 1');
    expect(sheet).toHaveTextContent('Cash $25 · Card/Venmo $0 · Total $25');

    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
