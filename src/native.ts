import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

/**
 * Native-shell boot sequence. No-ops entirely on web — the PWA install
 * path (StorageBanner, service worker) handles that surface instead.
 */
export async function initNativeShell(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  await StatusBar.setStyle({ style: Style.Dark }); // light text/icons on our dark theme
  if (Capacitor.getPlatform() === 'android') {
    await StatusBar.setBackgroundColor({ color: '#0f1115' });
  }
  await SplashScreen.hide();
}

/** Sale-confirmed tap feedback. WKWebView never implements the Vibration API, so a real Haptics call is the only way iOS gets this at all. */
export function saleHaptic(): void {
  if (Capacitor.isNativePlatform()) {
    void Haptics.impact({ style: ImpactStyle.Light });
  } else if (navigator.vibrate) {
    navigator.vibrate(30);
  }
}
