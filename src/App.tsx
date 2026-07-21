import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { StorageBanner } from './StorageBanner';
import { Onboarding } from './Onboarding';
import { SellScreen } from './screens/SellScreen';
import { StockScreen } from './screens/StockScreen';
import { NightScreen } from './screens/NightScreen';

type Tab = 'sell' | 'stock' | 'night';

export function App() {
  const itemCount = useLiveQuery(() => db.items.count(), []);
  const nightStart = useLiveQuery(async () => (await db.settings.get('nightStart'))?.value ?? 0, []);
  const [tab, setTab] = useState<Tab | null>(null);

  if (itemCount === undefined || nightStart === undefined) return null;

  const active: Tab = tab ?? (itemCount === 0 ? 'stock' : 'sell');

  return (
    <div className="app">
      <StorageBanner />
      {itemCount === 0 && <Onboarding />}
      <main>
        {active === 'sell' && <SellScreen nightStart={nightStart} />}
        {active === 'stock' && <StockScreen />}
        {active === 'night' && <NightScreen nightStart={nightStart} />}
      </main>
      <nav>
        {(
          [
            ['sell', 'Sell'],
            ['stock', 'Stock'],
            ['night', 'Night'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            className={active === id ? 'active' : ''}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
