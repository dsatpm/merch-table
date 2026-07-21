import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import { SellScreen } from './SellScreen';

const seed = async () => {
  await db.items.bulkAdd([
    {
      name: 'Shirt',
      price: 25,
      variants: [
        { name: 'M', startCount: 10 },
        { name: 'L', startCount: 12 },
      ],
      sortOrder: 1,
    },
    { name: 'Sticker', price: 5, variants: [{ name: '', startCount: 3 }], sortOrder: 2 },
  ]);
};

beforeEach(async () => {
  await db.delete();
  await db.open();
  localStorage.clear();
  await seed();
});

const soldTotal = () => screen.getByText(/sold/).textContent;

describe('two-tap sale (one-size item)', () => {
  it('item tap arms payment immediately, payment tap logs the sale', async () => {
    const user = userEvent.setup();
    render(<SellScreen nightStart={0} />);

    const sticker = await screen.findByRole('button', { name: /Sticker/ });
    expect(screen.getByRole('button', { name: 'Cash' })).toBeDisabled();

    await user.click(sticker);
    await user.click(screen.getByRole('button', { name: 'Cash' }));

    await waitFor(() => expect(soldTotal()).toContain('$5'));
    expect(screen.getByRole('status')).toHaveTextContent('Sticker $5 · cash');
  });
});

describe('three-tap sale (sized item)', () => {
  it('payment stays locked until a size is picked', async () => {
    const user = userEvent.setup();
    render(<SellScreen nightStart={0} />);

    await user.click(await screen.findByRole('button', { name: /Shirt/ }));
    expect(screen.getByRole('button', { name: 'Cash' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /^M/ }));
    expect(screen.getByRole('button', { name: 'Cash' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Card/Venmo' }));

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Shirt M $25 · card'),
    );
  });

  it('size row shows per-size stock', async () => {
    const user = userEvent.setup();
    render(<SellScreen nightStart={0} />);

    await user.click(await screen.findByRole('button', { name: /Shirt/ }));

    expect(screen.getByRole('button', { name: /^M/ })).toHaveTextContent('10 left');
    expect(screen.getByRole('button', { name: /^L/ })).toHaveTextContent('12 left');
  });
});

describe('#4 double-tap protection', () => {
  it('a rapid double-tap on payment logs exactly one sale', async () => {
    const user = userEvent.setup();
    render(<SellScreen nightStart={0} />);

    await user.click(await screen.findByRole('button', { name: /Sticker/ }));
    const cash = screen.getByRole('button', { name: 'Cash' });
    await user.click(cash);
    fireEvent.click(cash); // second tap lands before the debounce window closes
    fireEvent.click(cash);

    await waitFor(() => expect(soldTotal()).toContain('$5'));
    expect(soldTotal()).not.toContain('$10');
  });
});

describe('one-tap undo', () => {
  it('refunds the last sale, restoring totals and the readout', async () => {
    const user = userEvent.setup();
    render(<SellScreen nightStart={0} />);

    await user.click(await screen.findByRole('button', { name: /Sticker/ }));
    await user.click(screen.getByRole('button', { name: 'Cash' }));
    await waitFor(() => expect(soldTotal()).toContain('$5'));

    await user.click(screen.getByRole('button', { name: 'Undo last sale' }));

    await waitFor(() => expect(soldTotal()).toContain('$0'));
    expect(screen.getByText('No sales yet tonight')).toBeInTheDocument();
  });

  it('is disabled when there is nothing to undo', async () => {
    render(<SellScreen nightStart={0} />);

    expect(await screen.findByRole('button', { name: 'Undo last sale' })).toBeDisabled();
  });
});

describe('#3 stock is advisory, never a gate', () => {
  it('sells past zero and shows the recount flag', async () => {
    const user = userEvent.setup();
    render(<SellScreen nightStart={0} />);

    const sticker = await screen.findByRole('button', { name: /Sticker/ });
    for (let i = 0; i < 4; i++) {
      await user.click(sticker);
      const cash = screen.getByRole('button', { name: 'Cash' });
      await waitFor(() => expect(cash).toBeEnabled());
      await user.click(cash);
      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Sticker'));
    }

    await waitFor(() => expect(soldTotal()).toContain('$20'));
    expect(screen.getByRole('button', { name: /Sticker/ })).toHaveTextContent('-1 · recount');
  });
});

describe('long-press price override', () => {
  it('opens the override modal and logs the sale at the entered price', async () => {
    const user = userEvent.setup();
    render(<SellScreen nightStart={0} />);

    const sticker = await screen.findByRole('button', { name: /Sticker/ });
    fireEvent.pointerDown(sticker);
    await new Promise((r) => setTimeout(r, 550));
    fireEvent.pointerUp(sticker);

    const input = await screen.findByRole('spinbutton');
    await user.clear(input);
    await user.type(input, '2');
    await user.click(screen.getByRole('button', { name: 'Set price' }));
    await user.click(screen.getByRole('button', { name: 'Cash' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Sticker $2 · cash'));
    expect(soldTotal()).toContain('$2');
  });
});
