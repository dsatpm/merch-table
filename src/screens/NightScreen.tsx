import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  db,
  money,
  netCounts,
  startNewNight,
  totals,
  variantKey,
  variantLabel,
} from '../db';
import { downloadCsv, eventsToCsv } from '../csv';

export function NightScreen({ nightStart }: { nightStart: number }) {
  const items = useLiveQuery(() => db.items.orderBy('sortOrder').toArray(), []) ?? [];
  const allEvents = useLiveQuery(() => db.events.toArray(), []) ?? [];
  const nightFloat =
    useLiveQuery(async () => (await db.settings.get('nightFloat'))?.value ?? 0, []) ?? 0;
  const lastFloat =
    useLiveQuery(async () => (await db.settings.get('lastFloat'))?.value ?? 0, []) ?? 0;
  const nightEvents = allEvents.filter((e) => e.ts >= nightStart);

  const [counted, setCounted] = useState('');
  const [floatModal, setFloatModal] = useState(false);
  const [floatInput, setFloatInput] = useState('');
  const [shared, setShared] = useState(false);
  const [summaryModal, setSummaryModal] = useState<string | null>(null);

  const t = totals(nightEvents);
  const soldTonight = netCounts(nightEvents);
  const soldAllTime = netCounts(allEvents);

  const revenueTonight = new Map<string, number>();
  for (const e of nightEvents) {
    const k = variantKey(e.itemId, e.variantName);
    revenueTonight.set(
      k,
      (revenueTonight.get(k) ?? 0) + (e.type === 'sale' ? e.price : -e.price),
    );
  }

  const inventory = items.flatMap((item) =>
    item.variants.map((v) => {
      const k = variantKey(item.id!, v.name);
      return {
        key: k,
        label: variantLabel(item, v.name),
        left: v.startCount - (soldAllTime.get(k) ?? 0),
      };
    }),
  );
  const negatives = inventory.filter((r) => r.left < 0);

  const expectedCash = nightFloat + t.cash;
  const countedNum = parseFloat(counted);
  const hasCount = !isNaN(countedNum);
  const diff = hasCount ? countedNum - expectedCash : 0;

  const exportCsv = () => {
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(eventsToCsv(nightEvents), `merch-${date}.csv`);
  };

  const summaryText = () => {
    const lines: string[] = [`Merch — ${new Date().toLocaleDateString()}`];
    for (const item of items) {
      for (const v of item.variants) {
        const n = soldTonight.get(variantKey(item.id!, v.name)) ?? 0;
        if (n !== 0) lines.push(`${variantLabel(item, v.name)}: ${n}`);
      }
    }
    lines.push(
      `Cash ${money(t.cash)} · Card/Venmo ${money(t.digital)} · Total ${money(t.cash + t.digital)}`,
    );
    if (negatives.length > 0) {
      lines.push(`Recount: ${negatives.map((r) => `${r.label} (${r.left})`).join(', ')}`);
    }
    return lines.join('\n');
  };

  const shareSummary = async () => {
    const text = summaryText();
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        // fall through to clipboard (user cancelled or share failed)
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setShared(true);
      window.setTimeout(() => setShared(false), 2000);
    } catch {
      // clipboard unavailable — show the text for manual copy
      setSummaryModal(text);
    }
  };

  const openNewNight = () => {
    setFloatInput(String(lastFloat));
    setFloatModal(true);
  };

  const confirmNewNight = async () => {
    await startNewNight(parseFloat(floatInput) || 0);
    setCounted('');
    setFloatModal(false);
  };

  return (
    <div className="night">
      <section>
        <h3>Tonight</h3>
        <div className="big-totals">
          <div className="big-total">
            <span className="muted">Cash</span>
            <strong>{money(t.cash)}</strong>
          </div>
          <div className="big-total">
            <span className="muted">Card/Venmo</span>
            <strong>{money(t.digital)}</strong>
          </div>
          <div className="big-total">
            <span className="muted">Total</span>
            <strong>{money(t.cash + t.digital)}</strong>
          </div>
        </div>
      </section>

      <section>
        <h3>Sold tonight</h3>
        {t.units === 0 ? (
          <p className="muted">No sales yet tonight.</p>
        ) : (
          <table>
            <tbody>
              {items.flatMap((item) =>
                item.variants
                  .map((v) => {
                    const k = variantKey(item.id!, v.name);
                    const n = soldTonight.get(k) ?? 0;
                    if (n === 0) return null;
                    return (
                      <tr key={k}>
                        <td>{variantLabel(item, v.name)}</td>
                        <td className="num">{n}</td>
                        <td className="num">{money(revenueTonight.get(k) ?? 0)}</td>
                      </tr>
                    );
                  })
                  .filter(Boolean),
              )}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h3>Remaining inventory</h3>
        {negatives.length > 0 && (
          <p className="warn">
            ⚠ {negatives.map((r) => r.label).join(', ')} went negative — recount before next
            show.
          </p>
        )}
        <table>
          <tbody>
            {inventory.map((r) => (
              <tr key={r.key}>
                <td>{r.label}</td>
                <td className={'num' + (r.left < 0 ? ' warn' : '')}>
                  {r.left < 0 ? `${r.left} · recount` : r.left}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h3>Reconcile cash box</h3>
        <div className="reconcile-box">
          <p className="muted">
            Float {money(nightFloat)} + cash sales {money(t.cash)} ={' '}
            <strong className="drawer-expected">{money(expectedCash)}</strong> expected in the
            drawer
          </p>
        </div>
        <label className="reconcile-count-label">
          Counted now
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={counted}
            placeholder="Count the box…"
            onChange={(e) => setCounted(e.target.value)}
          />
        </label>
        {hasCount && (
          <p className={'reconcile-result ' + (Math.abs(diff) < 0.005 ? 'ok' : 'bad')}>
            {Math.abs(diff) < 0.005
              ? '✓ Cash box checks out'
              : diff > 0
                ? `⚠ ${money(diff)} over expected`
                : `⚠ ${money(-diff)} short`}
          </p>
        )}
      </section>

      <section className="night-actions">
        <button className="primary big" onClick={exportCsv} disabled={nightEvents.length === 0}>
          Export tonight as CSV
        </button>
        <button className="ghost big" onClick={shareSummary} disabled={nightEvents.length === 0}>
          {shared ? '✓ Copied to clipboard' : 'Share summary'}
        </button>
        <button className="ghost big" onClick={openNewNight}>
          Start new night
        </button>
      </section>

      {summaryModal !== null && (
        <div className="modal-backdrop" onClick={() => setSummaryModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Night summary</h3>
            <pre className="summary-pre">{summaryModal}</pre>
            <div className="modal-actions">
              <button className="primary" onClick={() => setSummaryModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {floatModal && (
        <div className="modal-backdrop" onClick={() => setFloatModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Start new night</h3>
            <p className="muted">
              Tonight’s totals reset to zero. Sales stay in the log; inventory carries over. How
              much change is in the cash box to start?
            </p>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              autoFocus
              value={floatInput}
              onChange={(e) => setFloatInput(e.target.value)}
            />
            <div className="modal-actions">
              <button className="ghost" onClick={() => setFloatModal(false)}>
                Cancel
              </button>
              <button className="primary" onClick={confirmNewNight}>
                Start night
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
