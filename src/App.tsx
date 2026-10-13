import { useEffect, useState, type CSSProperties } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { StorageBanner } from './StorageBanner';
import { Onboarding } from './Onboarding';
import { Splash } from './Splash';
import { SellScreen } from './screens/SellScreen';
import { StockScreen } from './screens/StockScreen';
import { NightScreen } from './screens/NightScreen';
import { IconBox, IconMoon, IconTag } from './icons';

type Tab = 'sell' | 'stock' | 'night';

const TABS = [
  { id: 'sell', label: 'Sell', Icon: IconTag },
  { id: 'stock', label: 'Stock', Icon: IconBox },
  { id: 'night', label: 'Night', Icon: IconMoon },
] as const;

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
  const activeIndex = TABS.findIndex((t) => t.id === active);

  return (
    <div className="app">
      <StorageBanner />
      {itemCount === 0 && <Onboarding />}
      <main className={'main' + (active === 'sell' && itemCount > 0 ? ' is-fixed' : '')}>
        {active === 'sell' && <SellScreen nightStart={nightStart} />}
        {active === 'stock' && <StockScreen />}
        {active === 'night' && <NightScreen nightStart={nightStart} />}
      </main>
      <nav className="tabbar" aria-label="Screens">
        <div className="tabbar-pill" style={{ '--tab-index': activeIndex } as CSSProperties}>
          <span className="tabbar-indicator" aria-hidden="true" />
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={'tab' + (active === id ? ' is-active' : '')}
              aria-current={active === id ? 'page' : undefined}
              onClick={() => setTab(id)}
            >
              <Icon size={22} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
