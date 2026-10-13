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
    body: 'Tap the item, then tap Cash or Card/Venmo. That’s a sale — sized items add one extra tap to pick a size.',
  },
  {
    title: 'Door deals happen',
    body: 'Long-press an item to override its price before you tap payment — bundles, discounts, whatever the deal is tonight.',
  },
  {
    title: 'Undo is always one tap away',
    body: 'The curved arrow under the sell buttons refunds the last sale instantly, no matter how loud the room is.',
  },
  {
    title: 'End the night in Night',
    body: 'See totals, export a CSV, and reconcile the cash box — it’ll flag any difference between counted and expected cash.',
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
