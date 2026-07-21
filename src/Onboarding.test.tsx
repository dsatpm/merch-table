import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Onboarding } from './Onboarding';

beforeEach(() => {
  localStorage.clear();
});

describe('first-run welcome walkthrough', () => {
  it('shows on first render when nobody has seen it yet', () => {
    render(<Onboarding />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('stays hidden once the user has already dismissed it', () => {
    localStorage.setItem('onboarding-seen', '1');
    render(<Onboarding />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('steps forward through the walkthrough one screen at a time', async () => {
    const user = userEvent.setup();
    render(<Onboarding />);

    expect(screen.getByText(/two taps/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText(/long-press/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText(/undo/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText(/reconcile/i)).toBeInTheDocument();
  });

  it('dismisses on the final step and remembers the choice', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<Onboarding onDismiss={onDismiss} />);

    for (let i = 0; i < 3; i++) {
      await user.click(screen.getByRole('button', { name: 'Next' }));
    }
    await user.click(screen.getByRole('button', { name: "Let's go" }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onDismiss).toHaveBeenCalled();
    expect(localStorage.getItem('onboarding-seen')).toBe('1');
  });

  it('can be skipped immediately from any step', async () => {
    const user = userEvent.setup();
    render(<Onboarding />);

    await user.click(screen.getByRole('button', { name: 'Skip' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(localStorage.getItem('onboarding-seen')).toBe('1');
  });

  it('does not reappear after remounting post-dismiss', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Onboarding />);
    await user.click(screen.getByRole('button', { name: 'Skip' }));
    unmount();

    render(<Onboarding />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
