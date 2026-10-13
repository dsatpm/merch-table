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
import { Sheet } from '../Sheet';
import { TotalsCard } from '../TotalsCard';
import { stagger } from '../stagger';
import { IconCard, IconCash, IconTag, IconUndo } from '../icons';

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
        <span className="empty-icon reveal">
          <IconTag size={28} />
        </span>
        <p className="reveal" style={stagger(1)}>
          No merch yet.
        </p>
        <p className="muted reveal" style={stagger(2)}>
          Add your items in the Stock tab before the show, then come back here to sell.
        </p>
      </div>
    );
  }

  return (
    <div className="sell">
      {flash > 0 && <div key={flash} className="flash" aria-hidden="true" />}

      <TotalsCard t={t} />

      <div className="sell-grid">
        {items.map((item, i) => {
          const isSel = sel !== null && sel.item.id === item.id;
          const left = itemLeft(item);
          return (
            <button
              key={item.id}
              className={
                'tile reveal' + (isSel ? ' is-selected' : '') + (left <= 0 ? ' is-out' : '')
              }
              style={stagger(i + 1)}
              aria-pressed={isSel}
              onPointerDown={() => startPress(item)}
              onPointerUp={cancelPress}
              onPointerLeave={cancelPress}
              onPointerCancel={cancelPress}
              onContextMenu={(e) => e.preventDefault()}
              onClick={() => tapItem(item)}
            >
              <span className="tile-name">{item.name}</span>
              <span className="tile-foot">
                <span className="tile-price">
                  {isSel && sel.overridePrice !== null ? money(sel.overridePrice) : money(item.price)}
                </span>
                <span className={'stock-pill' + (left <= 0 ? ' is-out' : '')}>
                  {left < 0 ? `${left} · recount` : `${left} left`}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="dock bezel reveal" style={stagger(2)}>
        <div className="bezel-core dock-core">
          {sel !== null && sel.item.variants.length > 1 && (
            <div className="size-row" key={sel.item.id}>
              {sel.item.variants.map((v) => {
                const vLeft = v.startCount - (sold.get(variantKey(sel.item.id!, v.name)) ?? 0);
                return (
                  <button
                    key={v.name}
                    className={
                      'size-chip' +
                      (sel.variantName === v.name ? ' is-selected' : '') +
                      (vLeft <= 0 ? ' is-out' : '')
                    }
                    aria-pressed={sel.variantName === v.name}
                    onClick={() => tapVariant(v.name)}
                  >
                    <span className="size-chip-name">{v.name || 'one size'}</span>
                    <span className="size-chip-left">
                      {vLeft < 0 ? `${vLeft} · recount` : `${vLeft} left`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="pay-row">
            <button
              className="pay-btn pay-cash"
              disabled={!ready}
              onClick={() => complete('cash')}
            >
              Cash
              <span className="pay-icon">
                <IconCash />
              </span>
            </button>
            <button
              className="pay-btn pay-card"
              disabled={!ready}
              onClick={() => complete('digital')}
            >
              Card/Venmo
              <span className="pay-icon">
                <IconCard />
              </span>
            </button>
          </div>

          <div className="undo-row">
            <button
              className="icon-btn"
              disabled={!lastSale}
              onClick={undo}
              aria-label="Undo last sale"
            >
              <IconUndo size={20} />
            </button>
            <div className="last-sale" role="status">
              {lastSale ? (
                <>
                  <span className="last-sale-label">Last sale </span>
                  {lastSale.itemName}
                  {lastSale.variantName ? ` ${lastSale.variantName}` : ''} {money(lastSale.price)} ·{' '}
                  {lastSale.payment === 'cash' ? 'cash' : 'card'}
                </>
              ) : (
                <span className="muted">No sales yet tonight</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <Sheet open={overrideFor !== null} onClose={() => setOverrideFor(null)} label="Change price">
        <h2 className="sheet-title">{overrideFor?.name}</h2>
        <p className="sheet-sub">Set a different price for this sale, like a door deal or a bundle.</p>
        <div className="sheet-body">
          <label className="input-wrap is-big">
            <span className="input-prefix">$</span>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              min="0"
              step="1"
              autoFocus
              aria-label="Price"
              value={overridePrice}
              onChange={(e) => setOverridePrice(e.target.value)}
            />
          </label>
        </div>
        <div className="sheet-actions">
          <button className="btn btn-ghost" onClick={() => setOverrideFor(null)}>
            Cancel
          </button>
          <span className="spacer" />
          <button className="btn btn-primary" onClick={confirmOverride}>
            Set price
          </button>
        </div>
      </Sheet>
    </div>
  );
}
