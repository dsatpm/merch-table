import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true;

/**
 * Data-safety surface (#5): request persistent storage on first run,
 * warn loudly when the browser won't promise persistence (private
 * browsing / storage-evictable mode), and nudge install-to-home-screen
 * since installed PWAs get friendlier storage treatment.
 *
 * None of that applies inside the native app shell — there's no private
 * mode and it's already installed — so this renders nothing there.
 */
export function StorageBanner() {
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const isNative = Capacitor.isNativePlatform();
  const [acked, setAcked] = useState(() => localStorage.getItem('storage-warn-ack') === '1');
  const [installEvt, setInstallEvt] = useState<InstallPromptEvent | null>(null);
  const [installDismissed, setInstallDismissed] = useState(
    () => localStorage.getItem('install-nudge-dismissed') === '1',
  );

  useEffect(() => {
    (async () => {
      if (!navigator.storage?.persist) {
        setPersisted(true); // API absent — nothing actionable to report
        return;
      }
      const already = await navigator.storage.persisted();
      setPersisted(already || (await navigator.storage.persist()));
    })().catch(() => setPersisted(true));

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (isNative) return null;

  if (persisted === false && !acked) {
    return (
      <div className="banner warn">
        <p>
          <strong>This browser is not promising to keep your data.</strong> Private browsing, or
          storage the browser may evict. Sales could vanish. Use a normal window and install the
          app to the home screen.
        </p>
        <button
          className="primary"
          onClick={() => {
            localStorage.setItem('storage-warn-ack', '1');
            setAcked(true);
          }}
        >
          I understand the risk
        </button>
      </div>
    );
  }

  if (!isStandalone() && !installDismissed && (installEvt || isIOS)) {
    return (
      <div className="banner info">
        <p>
          Install to the home screen for reliable offline storage
          {isIOS && !installEvt ? ' — Share → Add to Home Screen' : ''}.
        </p>
        <div className="banner-actions">
          {installEvt && (
            <button className="primary" onClick={() => installEvt.prompt()}>
              Install
            </button>
          )}
          <button
            className="ghost"
            onClick={() => {
              localStorage.setItem('install-nudge-dismissed', '1');
              setInstallDismissed(true);
            }}
          >
            Later
          </button>
        </div>
      </div>
    );
  }

  return null;
}
