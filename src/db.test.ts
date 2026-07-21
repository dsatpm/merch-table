import { beforeEach, describe, expect, it } from 'vitest';
import {
  db,
  getDeviceId,
  getSetting,
  money,
  netCounts,
  recordSale,
  startNewNight,
  totals,
  undoLastSale,
  variantKey,
  type Item,
} from './db';

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

describe('recordSale', () => {
  it('appends an immutable sale event snapshotting item, variant, price, and payment', async () => {
    await recordSale(shirt, 'M', 'cash');

    const events = await db.events.toArray();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'sale',
      itemId: 1,
      itemName: 'Shirt',
      variantName: 'M',
      price: 25,
      payment: 'cash',
    });
  });

  it('stores an override price on the event instead of the list price', async () => {
    await recordSale(shirt, 'M', 'cash', 15);

    const [event] = await db.events.toArray();
    expect(event.price).toBe(15);
  });

  it('stamps every event with a unique uuid and the install device id', async () => {
    await recordSale(shirt, 'M', 'cash');
    await recordSale(shirt, 'L', 'digital');

    const events = await db.events.toArray();
    expect(events[0].uuid).not.toBe(events[1].uuid);
    for (const e of events) {
      expect(e.uuid).toMatch(/^[0-9a-f-]{36}$/);
      expect(e.deviceId).toBe(getDeviceId());
    }
  });
});

describe('undoLastSale', () => {
  it('appends a refund event referencing the most recent sale — never deletes', async () => {
    await recordSale(shirt, 'M', 'cash');
    await recordSale(shirt, 'L', 'digital');

    const undone = await undoLastSale(0);

    expect(undone?.variantName).toBe('L');
    const events = await db.events.toArray();
    expect(events).toHaveLength(3);
    const refund = events[2];
    expect(refund.type).toBe('refund');
    expect(refund.refundOf).toBe(events[1].id);
    expect(refund.payment).toBe('digital');
  });

  it('walks backwards: a second undo refunds the next-earlier sale', async () => {
    await recordSale(shirt, 'M', 'cash');
    await recordSale(shirt, 'L', 'digital');

    await undoLastSale(0);
    const second = await undoLastSale(0);

    expect(second?.variantName).toBe('M');
  });

  it('returns null when every sale is already refunded', async () => {
    await recordSale(shirt, 'M', 'cash');
    await undoLastSale(0);

    expect(await undoLastSale(0)).toBeNull();
  });

  it('never reaches into a previous night', async () => {
    await recordSale(shirt, 'M', 'cash');
    const nightStart = Date.now() + 1;

    expect(await undoLastSale(nightStart)).toBeNull();
  });
});

describe('derived state', () => {
  it('netCounts: sales decrement stock, refunds restore it', async () => {
    await recordSale(shirt, 'M', 'cash');
    await recordSale(shirt, 'M', 'cash');
    await recordSale(shirt, 'L', 'digital');
    await undoLastSale(0); // refunds the L

    const counts = netCounts(await db.events.toArray());
    expect(counts.get(variantKey(1, 'M'))).toBe(2);
    expect(counts.get(variantKey(1, 'L'))).toBe(0);
  });

  it('totals: refunds subtract from the matching payment bucket', async () => {
    await recordSale(shirt, 'M', 'cash');
    await recordSale(shirt, 'L', 'digital');
    await recordSale(shirt, 'L', 'digital');
    await undoLastSale(0); // refunds a digital 25

    const t = totals(await db.events.toArray());
    expect(t).toEqual({ cash: 25, digital: 25, units: 2 });
  });

  it('totals include override prices as charged, not list price', async () => {
    await recordSale(shirt, 'M', 'cash', 15);

    const t = totals(await db.events.toArray());
    expect(t.cash).toBe(15);
  });
});

describe('night sessions', () => {
  it('startNewNight records the float and remembers it for next time', async () => {
    await startNewNight(100);

    expect(await getSetting('nightFloat')).toBe(100);
    expect(await getSetting('lastFloat')).toBe(100);
    expect(await getSetting('nightStart')).toBeGreaterThan(0);
  });
});

describe('device id', () => {
  it('is stable across calls within an install', () => {
    expect(getDeviceId()).toBe(getDeviceId());
  });
});

describe('money', () => {
  it('formats whole dollars without cents', () => {
    expect(money(25)).toBe('$25');
  });

  it('keeps non-zero cents', () => {
    expect(money(25.5)).toBe('$25.50');
  });

  it('prefixes negatives with -$', () => {
    expect(money(-5)).toBe('-$5');
  });

  it('formats zero as $0', () => {
    expect(money(0)).toBe('$0');
  });
});
