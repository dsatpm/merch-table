import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
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
      expect(screen.getByText(/expected in the drawer/)).toHaveTextContent(
        'Float $100 + cash sales $25 = $125 expected in the drawer',
      ),
    );
  });

  it('flags a short drawer against expected total, not raw sales', async () => {
    const nightStart = await startNightWithSales(100);
    const user = userEvent.setup();
    render(<NightScreen nightStart={nightStart} />);

    await user.type(await screen.findByLabelText(/Counted now/), '120');

    expect(screen.getByText('⚠ $5 short')).toBeInTheDocument();
  });

  it('confirms a matching count', async () => {
    const nightStart = await startNightWithSales(100);
    const user = userEvent.setup();
    render(<NightScreen nightStart={nightStart} />);

    await user.type(await screen.findByLabelText(/Counted now/), '125');

    expect(screen.getByText('✓ Cash box checks out')).toBeInTheDocument();
  });

  it('flags an over drawer', async () => {
    const nightStart = await startNightWithSales(0);
    const user = userEvent.setup();
    render(<NightScreen nightStart={nightStart} />);

    await user.type(await screen.findByLabelText(/Counted now/), '30');

    expect(screen.getByText('⚠ $5 over expected')).toBeInTheDocument();
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
      expect(screen.getByText(/went negative — recount before next show/)).toBeInTheDocument(),
    );
    expect(screen.getByRole('cell', { name: '-1 · recount' })).toBeInTheDocument();
  });
});
