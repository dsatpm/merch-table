import { money, type Totals } from './db';
import { stagger } from './stagger';

/**
 * Tonight's money at a glance, shared by Sell and Night. The amount and
 * "sold tonight" stay in one element: the Sell tests read the total off
 * the node whose own text says "sold".
 */
export function TotalsCard({ t }: { t: Pick<Totals, 'cash' | 'digital'> }) {
  const total = money(t.cash + t.digital);
  return (
    <section className="bezel reveal" style={stagger(0)}>
      <div className="bezel-core totals">
        <div className="totals-main">
          <p className="totals-amount">
            <span className={'amount' + (total.length > 6 ? ' is-long' : '')}>{total}</span>
            <span className="eyebrow-dot" aria-hidden="true" /> sold tonight
          </p>
        </div>
        <div className="totals-split">
          <div className="totals-stat">
            <span>
              <i className="swatch cash" aria-hidden="true" />
              Cash
            </span>
            <strong>{money(t.cash)}</strong>
          </div>
          <div className="totals-stat">
            <span>
              <i className="swatch card" aria-hidden="true" />
              Card/Venmo
            </span>
            <strong>{money(t.digital)}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}
