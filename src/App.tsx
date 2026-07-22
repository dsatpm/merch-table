import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { StorageBanner } from './StorageBanner';
import { Onboarding } from './Onboarding';
import { Splash } from './Splash';
import { SellScreen } from './screens/SellScreen';
import { StockScreen } from './screens/StockScreen';
import { NightScreen } from './screens/NightScreen';

type Tab = 'sell' | 'stock' | 'night';

const MIN_SPLASH_MS = 3000;

export function App() {
  const itemCount = useLiveQuery(() => db.items.count(), []);
  const nightStart = useLiveQuery(async () => (await db.settings.get('nightStart'))?.value ?? 0, []);
  const [tab, setTab] = useState<Tab | null>(null);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setMinTimeElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(id);
  }, []);

  if (itemCount === undefined || nightStart === undefined || !minTimeElapsed) return <Splash />;

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
