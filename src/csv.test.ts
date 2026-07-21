import { describe, expect, it } from 'vitest';
import { eventsToCsv } from './csv';
import type { SaleEvent } from './db';

const base: SaleEvent = {
  id: 1,
  uuid: 'u-1',
  deviceId: 'd-1',
  type: 'sale',
  itemId: 1,
  itemName: 'Shirt',
  variantName: 'M',
  price: 25,
  payment: 'cash',
  ts: Date.UTC(2026, 6, 20, 21, 30, 0),
};

describe('eventsToCsv', () => {
  it('emits header plus one row per event with ISO timestamp', () => {
    const csv = eventsToCsv([base]);

    expect(csv.split('\n')).toEqual([
      'time,item,variant,price,payment,type',
      '2026-07-20T21:30:00.000Z,Shirt,M,25.00,cash,sale',
    ]);
  });

  it('quotes and escapes item names containing commas or quotes', () => {
    const csv = eventsToCsv([{ ...base, itemName: 'Live, "Bootleg" LP' }]);

    expect(csv.split('\n')[1]).toContain('"Live, ""Bootleg"" LP"');
  });

  it('shows one-size (empty) variants as a dash', () => {
    const csv = eventsToCsv([{ ...base, variantName: '' }]);

    expect(csv.split('\n')[1].split(',')[2]).toBe('-');
  });

  it('labels refund events so reconciliation can tell them apart', () => {
    const csv = eventsToCsv([{ ...base, type: 'refund', refundOf: 1 }]);

    expect(csv.split('\n')[1].endsWith(',refund')).toBe(true);
  });
});
