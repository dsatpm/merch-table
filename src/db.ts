import Dexie, { type EntityTable } from 'dexie';

export type Payment = 'cash' | 'digital';

export interface Variant {
  name: string; // '' means one-size
  startCount: number;
}

export interface Item {
  id?: number;
  name: string;
  price: number;
  variants: Variant[];
  sortOrder: number;
}

/**
 * Every sale is an immutable event. Undo/refund appends a 'refund' event
 * pointing at the original sale; nothing is ever mutated or deleted.
 * Inventory and totals are derived by folding over the log.
 * uuid + deviceId stamp every event so future multi-device sync is a
 * union-by-uuid merge, no conflict resolution.
 */
export interface SaleEvent {
  id?: number;
  uuid: string;
  deviceId: string;
  type: 'sale' | 'refund';
  refundOf?: number;
  itemId: number;
  itemName: string;
  variantName: string;
  price: number;
  payment: Payment;
  ts: number;
}

export interface Setting {
  key: string;
  value: number;
}

export function getDeviceId(): string {
  let id = localStorage.getItem('merch-device-id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('merch-device-id', id);
  }
  return id;
}

export const db = new Dexie('merch-table') as Dexie & {
  items: EntityTable<Item, 'id'>;
  events: EntityTable<SaleEvent, 'id'>;
  settings: EntityTable<Setting, 'key'>;
};

db.version(1).stores({
  items: '++id, sortOrder',
  events: '++id, ts, itemId, type',
  settings: 'key',
});

db.version(2)
  .stores({
    items: '++id, sortOrder',
    events: '++id, ts, itemId, type, uuid',
    settings: 'key',
  })
  .upgrade((tx) =>
    tx
      .table('events')
      .toCollection()
      .modify((e) => {
        if (!e.uuid) e.uuid = crypto.randomUUID();
        if (!e.deviceId) e.deviceId = getDeviceId();
      }),
  );

export const variantKey = (itemId: number, variantName: string) => `${itemId}|${variantName}`;
export const variantLabel = (item: Pick<Item, 'name'>, variantName: string) =>
  variantName ? `${item.name} ${variantName}` : item.name;

export async function getSetting(key: string, fallback = 0): Promise<number> {
  const row = await db.settings.get(key);
  return row?.value ?? fallback;
}

/** Start a night session: totals reset, float recorded, last float remembered. */
export async function startNewNight(float: number): Promise<void> {
  // ties with a just-recorded sale (same ms) would leak it into the new
  // night, so nightStart must land strictly after the last logged event
  const lastEvent = await db.events.orderBy('ts').last();
  const nightStart = Math.max(Date.now(), (lastEvent?.ts ?? 0) + 1);
  await db.settings.bulkPut([
    { key: 'nightStart', value: nightStart },
    { key: 'nightFloat', value: float },
    { key: 'lastFloat', value: float },
  ]);
}

export async function recordSale(
  item: Item,
  variantName: string,
  payment: Payment,
  priceOverride?: number,
): Promise<void> {
  await db.events.add({
    uuid: crypto.randomUUID(),
    deviceId: getDeviceId(),
    type: 'sale',
    itemId: item.id!,
    itemName: item.name,
    variantName,
    price: priceOverride ?? item.price,
    payment,
    ts: Date.now(),
  });
}

/** Refund the most recent not-yet-refunded sale of the current night. */
export async function undoLastSale(nightStart: number): Promise<SaleEvent | null> {
  const events = await db.events.where('ts').aboveOrEqual(nightStart).toArray();
  const refunded = new Set(events.filter((e) => e.type === 'refund').map((e) => e.refundOf));
  const last = events
    .filter((e) => e.type === 'sale' && !refunded.has(e.id))
    .sort((a, b) => a.ts - b.ts || a.id! - b.id!)
    .at(-1);
  if (!last) return null;
  await db.events.add({
    uuid: crypto.randomUUID(),
    deviceId: getDeviceId(),
    type: 'refund',
    refundOf: last.id,
    itemId: last.itemId,
    itemName: last.itemName,
    variantName: last.variantName,
    price: last.price,
    payment: last.payment,
    ts: Date.now(),
  });
  return last;
}

/** Net units sold per item-variant: sales +1, refunds -1. */
export function netCounts(events: SaleEvent[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of events) {
    const k = variantKey(e.itemId, e.variantName);
    map.set(k, (map.get(k) ?? 0) + (e.type === 'sale' ? 1 : -1));
  }
  return map;
}

export interface Totals {
  cash: number;
  digital: number;
  units: number;
}

export function totals(events: SaleEvent[]): Totals {
  const t: Totals = { cash: 0, digital: 0, units: 0 };
  for (const e of events) {
    const sign = e.type === 'sale' ? 1 : -1;
    t[e.payment] += sign * e.price;
    t.units += sign;
  }
  return t;
}

export const money = (n: number) =>
  (n < 0 ? '-$' : '$') + Math.abs(n).toFixed(2).replace(/\.00$/, '');
