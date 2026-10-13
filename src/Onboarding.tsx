import { useState } from 'react';
import { Sheet } from './Sheet';
import { IconArrowRight } from './icons';

interface Step {
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    title: 'Two taps to sell',
    body: 'Tap an item, then tap Cash or Card/Venmo. That’s the whole sale. If the item comes in sizes, you’ll tap one more time to pick the size.',
  },
  {
    title: 'Give someone a deal',
    body: 'Press and hold an item to change its price for that sale. Use it for bundles, discounts, or any deal you make at the table.',
  },
  {
    title: 'Undo is always one tap away',
    body: 'Made a mistake? Tap the curved arrow under the payment buttons to take back the last sale.',
  },
  {
    title: 'Wrap up in the Night tab',
    body: 'See what you sold, export a CSV, and count your cash box. The app will tell you if the cash doesn’t match what it expects.',
  },
];

const SEEN_KEY = 'onboarding-seen';

export function Onboarding({ onDismiss }: { onDismiss?: () => void } = {}) {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(SEEN_KEY) === '1');
  const [step, setStep] = useState(0);

  const finish = () => {
    localStorage.setItem(SEEN_KEY, '1');
    setDismissed(true);
    onDismiss?.();
  };

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <Sheet open={!dismissed} label="Welcome to Merch Table">
      <img src="/splash-logo.svg" alt="" className="onboarding-logo" />
      <div className="onboarding-step" key={step}>
        <h2 className="sheet-title">{current.title}</h2>
        <p className="sheet-sub">{current.body}</p>
      </div>
      <div className="dots" aria-hidden="true">
        {STEPS.map((_, i) => (
          <span key={i} className={'dot' + (i === step ? ' is-active' : '')} />
        ))}
      </div>
      <div className="sheet-actions">
        <button className="btn btn-ghost" onClick={finish}>
          Skip
        </button>
        <span className="spacer" />
        <button
          className="btn btn-primary has-icon"
          onClick={isLast ? finish : () => setStep((s) => s + 1)}
        >
          {isLast ? "Let's go" : 'Next'}
          <span className="btn-icon">
            <IconArrowRight size={18} />
          </span>
        </button>
      </div>
    </Sheet>
  );
}
