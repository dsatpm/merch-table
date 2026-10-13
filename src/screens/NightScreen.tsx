import { useState, type CSSProperties } from 'react';
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
import { Sheet } from '../Sheet';
import { TotalsCard } from '../TotalsCard';
import { stagger } from '../stagger';
import {
  IconArrowRight,
  IconCheck,
  IconDownload,
  IconRefresh,
  IconShare,
  IconWarning,
} from '../icons';

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
        start: v.startCount,
        left: v.startCount - (soldAllTime.get(k) ?? 0),
      };
    }),
  );
  const negatives = inventory.filter((r) => r.left < 0);

  const expectedCash = nightFloat + t.cash;
  const countedNum = parseFloat(counted);
  const hasCount = !isNaN(countedNum);
  const diff = hasCount ? countedNum - expectedCash : 0;
  const balanced = Math.abs(diff) < 0.005;

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

  const soldRows = items.flatMap((item) =>
    item.variants.flatMap((v) => {
      const k = variantKey(item.id!, v.name);
      const n = soldTonight.get(k) ?? 0;
      return n === 0 ? [] : [{ key: k, label: variantLabel(item, v.name), n }];
    }),
  );

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="night">
      <header className="screen-head reveal">
        <div>
          <span className="eyebrow">{today}</span>
          <h1>Tonight</h1>
        </div>
      </header>

      <TotalsCard t={t} />

      <section className="section reveal" style={stagger(1)}>
        <h2 className="section-title">Sold tonight</h2>
        <div className="bezel list-card">
          <div className="bezel-core">
            {t.units === 0 ? (
              <p className="muted list-empty">No sales yet tonight.</p>
            ) : (
              <table>
                <tbody>
                  {soldRows.map((r) => (
                    <tr key={r.key}>
                      <td>{r.label}</td>
                      <td className="num qty">×{r.n}</td>
                      <td className="num amount">{money(revenueTonight.get(r.key) ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>

      <section className="section reveal" style={stagger(2)}>
        <h2 className="section-title">Remaining inventory</h2>
        {negatives.length > 0 && (
          <p className="callout is-warn">
            <IconWarning size={18} />
            <span>
              {negatives.map((r) => r.label).join(', ')} went negative — recount before next
              show.
            </span>
          </p>
        )}
        <div className="bezel list-card">
          <div className="bezel-core">
            <table>
              <tbody>
                {inventory.map((r) => (
                  <tr key={r.key}>
                    <td>
                      <span className="row-label">
                        {r.label}
                        <span className={'meter' + (r.left <= 0 ? ' is-out' : '')} aria-hidden="true">
                          <span
                            className="meter-fill"
                            style={
                              {
                                '--fill': r.start > 0 ? Math.min(1, Math.max(0, r.left / r.start)) : 0,
                              } as CSSProperties
                            }
                          />
                        </span>
                      </span>
                    </td>
                    <td className={'num left' + (r.left < 0 ? ' warn' : '')}>
                      {r.left < 0 ? `${r.left} · recount` : r.left}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section reveal" style={stagger(3)}>
        <h2 className="section-title">Reconcile cash box</h2>
        <div className="bezel">
          <div className="bezel-core reconcile">
            <p className="equation">
              Float {money(nightFloat)} + cash sales {money(t.cash)} ={' '}
              <strong>{money(expectedCash)}</strong> expected in the drawer
            </p>
            <label className="field">
              Counted now
              <span className="input-wrap is-big">
                <span className="input-prefix">$</span>
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={counted}
                  placeholder="Count the box…"
                  onChange={(e) => setCounted(e.target.value)}
                />
              </span>
            </label>
            {hasCount && (
              <p className={'callout reconcile-result ' + (balanced ? 'is-ok' : 'is-bad')}>
                {balanced ? <IconCheck size={20} /> : <IconWarning size={20} />}
                <span>
                  {balanced
                    ? 'Cash box checks out'
                    : diff > 0
                      ? `${money(diff)} over expected`
                      : `${money(-diff)} short`}
                </span>
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="actions reveal" style={stagger(4)}>
        <button
          className="btn btn-primary btn-block has-icon"
          onClick={exportCsv}
          disabled={nightEvents.length === 0}
        >
          Export tonight as CSV
          <span className="btn-icon">
            <IconDownload size={20} />
          </span>
        </button>
        <button
          className="btn btn-secondary btn-block has-icon"
          onClick={shareSummary}
          disabled={nightEvents.length === 0}
        >
          {shared ? 'Copied to clipboard' : 'Share summary'}
          <span className="btn-icon">
            {shared ? <IconCheck size={20} /> : <IconShare size={20} />}
          </span>
        </button>
        <button className="btn btn-secondary btn-block has-icon" onClick={openNewNight}>
          Start new night
          <span className="btn-icon">
            <IconRefresh size={20} />
          </span>
        </button>
      </section>

      <Sheet
        open={summaryModal !== null}
        onClose={() => setSummaryModal(null)}
        label="Night summary"
      >
        <h2 className="sheet-title">Night summary</h2>
        <div className="sheet-body">
          <pre className="summary-pre">{summaryModal}</pre>
        </div>
        <div className="sheet-actions">
          <span className="spacer" />
          <button className="btn btn-primary" onClick={() => setSummaryModal(null)}>
            Close
          </button>
        </div>
      </Sheet>

      <Sheet open={floatModal} onClose={() => setFloatModal(false)} label="Start new night">
        <h2 className="sheet-title">Start new night</h2>
        <p className="sheet-sub">
          Tonight’s totals reset to zero. Sales stay in the log; inventory carries over. How much
          change is in the cash box to start?
        </p>
        <div className="sheet-body">
          <label className="input-wrap is-big">
            <span className="input-prefix">$</span>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              min="0"
              autoFocus
              aria-label="Starting float"
              value={floatInput}
              onChange={(e) => setFloatInput(e.target.value)}
            />
          </label>
        </div>
        <div className="sheet-actions">
          <button className="btn btn-ghost" onClick={() => setFloatModal(false)}>
            Cancel
          </button>
          <span className="spacer" />
          <button className="btn btn-primary has-icon" onClick={confirmNewNight}>
            Start night
            <span className="btn-icon">
              <IconArrowRight size={18} />
            </span>
          </button>
        </div>
      </Sheet>
    </div>
  );
}
