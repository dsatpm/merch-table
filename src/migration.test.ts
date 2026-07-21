import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';

/**
 * #14 acceptance: events written before the uuid/deviceId schema must be
 * backfilled when the app's db module opens the database.
 *
 * The app db is a module singleton, so this file builds the old schema
 * FIRST and only then imports the module (dynamic import, own test file
 * = own module registry).
 */
describe('v1 → v2 migration', () => {
  it('backfills uuid and deviceId on pre-existing events', async () => {
    const old = new Dexie('merch-table');
    old.version(1).stores({
      items: '++id, sortOrder',
      events: '++id, ts, itemId, type',
      settings: 'key',
    });
    await old.open();
    await old.table('events').add({
      type: 'sale',
      itemId: 1,
      itemName: 'Shirt',
      variantName: 'M',
      price: 25,
      payment: 'cash',
      ts: 1000,
    });
    old.close();

    const { db } = await import('./db');
    await db.open();

    const events = await db.events.toArray();
    expect(events).toHaveLength(1);
    expect(events[0].uuid).toMatch(/^[0-9a-f-]{36}$/);
    expect(events[0].deviceId).toBeTruthy();
    // original fields untouched
    expect(events[0]).toMatchObject({ itemName: 'Shirt', price: 25, ts: 1000 });
  });
});
