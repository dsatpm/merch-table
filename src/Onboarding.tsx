import { useState } from 'react';

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
    body: 'The ↩ arrow next to the sell buttons refunds the last sale instantly, no matter how loud the room is.',
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

  if (dismissed) return null;

  const finish = () => {
    localStorage.setItem(SEEN_KEY, '1');
    setDismissed(true);
    onDismiss?.();
  };

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <div className="modal-backdrop">
      <div className="modal onboarding-modal" role="dialog" aria-modal="true" aria-label="Welcome to Merch Table">
        <img src="/icon-192.png" alt="" className="onboarding-logo" width={64} height={64} />
        <h3>{current.title}</h3>
        <p className="muted">{current.body}</p>
        <div className="onboarding-dots">
          {STEPS.map((_, i) => (
            <span key={i} className={'dot' + (i === step ? ' active' : '')} />
          ))}
        </div>
        <div className="modal-actions onboarding-actions">
          <button className="ghost" onClick={finish}>
            Skip
          </button>
          {isLast ? (
            <button className="primary" onClick={finish}>
              Let's go
            </button>
          ) : (
            <button className="primary" onClick={() => setStep((s) => s + 1)}>
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
