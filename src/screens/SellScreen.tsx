import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  db,
  money,
  netCounts,
  recordSale,
  totals,
  undoLastSale,
  variantKey,
  type Item,
  type Payment,
} from '../db';
import { saleHaptic } from '../native';

interface Sel {
  item: Item;
  // null = sized item still waiting on a size tap
  variantName: string | null;
  overridePrice: number | null;
}

const LONG_PRESS_MS = 450;

/** Auto-pick the variant when there's only one (non-sized items: two taps total). */
const autoVariant = (item: Item): string | null =>
  item.variants.length === 1 ? item.variants[0].name : null;

export function SellScreen({ nightStart }: { nightStart: number }) {
  const items = useLiveQuery(() => db.items.orderBy('sortOrder').toArray(), []) ?? [];
  const allEvents = useLiveQuery(() => db.events.toArray(), []) ?? [];
  const nightEvents = allEvents.filter((e) => e.ts >= nightStart);

  const [sel, setSel] = useState<Sel | null>(null);
  const [overrideFor, setOverrideFor] = useState<Item | null>(null);
  const [overridePrice, setOverridePrice] = useState('');
  const [flash, setFlash] = useState(0);
  const [busy, setBusy] = useState(false);

  const pressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);
  // ref, not state: a same-tick double-tap must see the guard immediately
  const busyRef = useRef(false);

  const sold = netCounts(allEvents);
  const t = totals(nightEvents);
  const refundedIds = new Set(
    nightEvents.filter((e) => e.type === 'refund').map((e) => e.refundOf),
  );
  const lastSale = nightEvents
    .filter((e) => e.type === 'sale' && !refundedIds.has(e.id))
    .at(-1);

  const itemLeft = (item: Item) =>
    item.variants.reduce(
      (sum, v) => sum + v.startCount - (sold.get(variantKey(item.id!, v.name)) ?? 0),
      0,
    );

  const startPress = (item: Item) => {
    longPressFired.current = false;
    pressTimer.current = window.setTimeout(() => {
      longPressFired.current = true;
      setOverridePrice(String(item.price));
      setOverrideFor(item);
    }, LONG_PRESS_MS);
  };

  const cancelPress = () => {
    if (pressTimer.current !== null) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const tapItem = (item: Item) => {
    if (longPressFired.current) return;
    setSel((cur) =>
      cur && cur.item.id === item.id
        ? null
        : { item, variantName: autoVariant(item), overridePrice: null },
    );
  };

  const tapVariant = (variantName: string) => {
    setSel((cur) => (cur ? { ...cur, variantName } : cur));
  };

  const ready = sel !== null && sel.variantName !== null && !busy;

  const complete = async (payment: Payment) => {
    // debounce: a double-tap must never log the sale twice
    if (busyRef.current || !sel || sel.variantName === null) return;
    busyRef.current = true;
    setBusy(true);
    window.setTimeout(() => {
      busyRef.current = false;
      setBusy(false);
    }, 350);
    await recordSale(
      sel.item,
      sel.variantName,
      payment,
      sel.overridePrice ?? undefined,
    );
    setSel(null);
    setFlash((f) => f + 1);
    saleHaptic();
  };

  const confirmOverride = () => {
    if (!overrideFor) return;
    const p = parseFloat(overridePrice);
    if (!isNaN(p) && p >= 0) {
      setSel({ item: overrideFor, variantName: autoVariant(overrideFor), overridePrice: p });
    }
    setOverrideFor(null);
  };

  const undo = async () => {
    await undoLastSale(nightStart);
  };

  if (items.length === 0) {
    return (
      <div className="empty">
        <p>No merch yet.</p>
        <p className="muted">Set up your items in the Stock tab before the show.</p>
      </div>
    );
  }

  return (
    <div className="sell">
      {flash > 0 && <div key={flash} className="flash-edge" aria-hidden="true" />}

      <div className="totals-bar">
        <span>
          Cash <strong>{money(t.cash)}</strong>
        </span>
        <span>
          Card/Venmo <strong>{money(t.digital)}</strong>
        </span>
        <span className="sold-total">
          <strong>{money(t.cash + t.digital)}</strong> sold
        </span>
      </div>

      <div className="sell-grid">
        {items.map((item) => {
          const isSel = sel !== null && sel.item.id === item.id;
          const left = itemLeft(item);
          return (
            <button
              key={item.id}
              className={
                'item-btn' + (isSel ? ' selected' : '') + (left <= 0 ? ' soldout' : '')
              }
              onPointerDown={() => startPress(item)}
              onPointerUp={cancelPress}
              onPointerLeave={cancelPress}
              onPointerCancel={cancelPress}
              onContextMenu={(e) => e.preventDefault()}
              onClick={() => tapItem(item)}
            >
              <span className="item-btn-name">{item.name}</span>
              <span className="item-btn-meta">
                {isSel && sel.overridePrice !== null ? money(sel.overridePrice) : money(item.price)}
                <span className={'left' + (left < 0 ? ' negative' : '')}>
                  {left < 0 ? ` · ${left} · recount` : ` · ${left} left`}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {sel !== null && sel.item.variants.length > 1 && (
        <div className="size-row">
          {sel.item.variants.map((v) => {
            const vLeft = v.startCount - (sold.get(variantKey(sel.item.id!, v.name)) ?? 0);
            return (
              <button
                key={v.name}
                className={
                  'size-btn' +
                  (sel.variantName === v.name ? ' selected' : '') +
                  (vLeft <= 0 ? ' soldout' : '')
                }
                onClick={() => tapVariant(v.name)}
              >
                <span className="size-btn-name">{v.name || 'one size'}</span>
                <span className={'size-btn-left' + (vLeft < 0 ? ' negative' : '')}>
                  {vLeft < 0 ? `${vLeft} · recount` : `${vLeft} left`}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="pay-row">
        <button className="pay-btn cash" disabled={!ready} onClick={() => complete('cash')}>
          Cash
        </button>
        <button
          className="pay-btn digital"
          disabled={!ready}
          onClick={() => complete('digital')}
        >
          Card/Venmo
        </button>
      </div>

      <div className="undo-row">
        <button
          className="undo-arrow"
          disabled={!lastSale}
          onClick={undo}
          aria-label="Undo last sale"
        >
          ↩
        </button>
        <div className="last-sale" role="status">
          {lastSale ? (
            <>
              <span className="muted">Last sale </span>
              {lastSale.itemName}
              {lastSale.variantName ? ` ${lastSale.variantName}` : ''} {money(lastSale.price)} ·{' '}
              {lastSale.payment === 'cash' ? 'cash' : 'card'}
            </>
          ) : (
            <span className="muted">No sales yet tonight</span>
          )}
        </div>
      </div>

      {overrideFor && (
        <div className="modal-backdrop" onClick={() => setOverrideFor(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{overrideFor.name}</h3>
            <p className="muted">Override price (door deal, bundle…)</p>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="1"
              autoFocus
              value={overridePrice}
              onChange={(e) => setOverridePrice(e.target.value)}
            />
            <div className="modal-actions">
              <button className="ghost" onClick={() => setOverrideFor(null)}>
                Cancel
              </button>
              <button className="primary" onClick={confirmOverride}>
                Set price
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
