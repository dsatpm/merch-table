import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EXIT_MS, Sheet } from './Sheet';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const layer = () => document.querySelector('.sheet-layer');

describe('bottom sheet', () => {
  it('renders nothing while closed', () => {
    render(
      <Sheet open={false} label="Price">
        body
      </Sheet>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(layer()).toBeNull();
  });

  it('renders a labelled modal dialog into <body> when open', () => {
    const { container } = render(
      <Sheet open label="Override price">
        <p>body</p>
      </Sheet>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Override price' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    // portaled: a transformed screen ancestor must not trap position: fixed
    expect(container.contains(dialog)).toBe(false);
  });

  it('leaves the a11y tree the moment it closes, then unmounts after the exit animation', () => {
    const { rerender } = render(
      <Sheet open label="Price">
        <p>live content</p>
      </Sheet>,
    );
    rerender(
      <Sheet open={false} label="Price">
        {null}
      </Sheet>,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(layer()).toHaveClass('is-closing');
    // keeps showing what it showed while open, even though the caller cleared it
    expect(screen.getByText('live content')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(EXIT_MS + 1);
    });
    expect(layer()).toBeNull();
  });

  it('reopening mid-exit cancels the unmount', () => {
    const { rerender } = render(<Sheet open label="Price">a</Sheet>);
    rerender(<Sheet open={false} label="Price">a</Sheet>);
    rerender(<Sheet open label="Price">b</Sheet>);

    act(() => {
      vi.advanceTimersByTime(EXIT_MS + 1);
    });
    expect(screen.getByRole('dialog')).toHaveTextContent('b');
    expect(layer()).not.toHaveClass('is-closing');
  });

  it('backdrop tap calls onClose', () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} label="Price">
        body
      </Sheet>,
    );
    fireEvent.click(document.querySelector('.sheet-backdrop')!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('tapping inside the sheet does not close it', () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} label="Price">
        <button>inside</button>
      </Sheet>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'inside' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('lifts itself above the on-screen keyboard via --kb', () => {
    const listeners: Record<string, () => void> = {};
    const vv = {
      height: 844,
      offsetTop: 0,
      addEventListener: (type: string, fn: () => void) => {
        listeners[type] = fn;
      },
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal('visualViewport', vv);
    vi.stubGlobal('innerHeight', 844);

    const { unmount } = render(<Sheet open label="Price">body</Sheet>);
    expect((layer() as HTMLElement).style.getPropertyValue('--kb')).toBe('0px');

    vv.height = 508; // keyboard took 336px
    act(() => listeners.resize());
    expect((layer() as HTMLElement).style.getPropertyValue('--kb')).toBe('336px');

    // the sheet must not leave viewport listeners behind
    unmount();
    expect(vv.removeEventListener).toHaveBeenCalledWith('resize', listeners.resize);
    expect(vv.removeEventListener).toHaveBeenCalledWith('scroll', listeners.scroll);

    vi.unstubAllGlobals();
  });
});
