import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

export const EXIT_MS = 240;

const reducedMotion = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface SheetProps {
  open: boolean;
  /** Backdrop tap calls this. Omit to make the sheet non-dismissable (onboarding). */
  onClose?: () => void;
  label: string;
  children: ReactNode;
}

/**
 * Bottom sheet, the app's only modal surface. Thumb-reachable on every
 * phone size, and it rides above the software keyboard via the
 * --kb inset below.
 *
 * Exit animates: after `open` flips false the sheet stays mounted for
 * EXIT_MS, rendering the last children it saw (callers usually null the
 * state the content reads from in the same tick). While closing it is
 * aria-hidden, so to assistive tech and to tests it is gone immediately.
 *
 * Portaled to <body> because the screens animate in with transforms,
 * and a transformed ancestor would turn position: fixed into absolute.
 */
export function Sheet({ open, onClose, label, children }: SheetProps) {
  const [present, setPresent] = useState(open);
  if (open && !present) setPresent(true);
  const closing = present && !open;

  const lastChildren = useRef(children);
  if (open) lastChildren.current = children;

  useEffect(() => {
    if (!closing) return;
    const id = window.setTimeout(() => setPresent(false), reducedMotion() ? 0 : EXIT_MS);
    return () => clearTimeout(id);
  }, [closing]);

  const layerRef = useRef<HTMLDivElement>(null);
  useKeyboardInset(layerRef, present);

  if (!present) return null;

  return createPortal(
    <div
      ref={layerRef}
      className={'sheet-layer' + (closing ? ' is-closing' : '')}
      aria-hidden={closing || undefined}
    >
      <div className="sheet-backdrop" onClick={closing ? undefined : onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label}>
        <div className="sheet-grabber" aria-hidden="true" />
        {open ? children : lastChildren.current}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Publishes the on-screen keyboard height as --kb on the sheet layer.
 * iOS WKWebView and Android visual-viewport resizing both shrink
 * visualViewport without moving fixed elements, so a bottom sheet would
 * sit under the keyboard. When the platform resizes the layout viewport
 * instead, the difference is 0 and nothing moves.
 */
function useKeyboardInset(ref: RefObject<HTMLElement>, active: boolean) {
  useEffect(() => {
    const vv = window.visualViewport;
    const el = ref.current;
    if (!active || !vv || !el) return;
    const update = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      el.style.setProperty('--kb', `${Math.round(kb)}px`);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [ref, active]);
}
