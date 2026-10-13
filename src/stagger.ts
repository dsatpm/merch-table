import type { CSSProperties } from 'react';

/** Inline style for a `.reveal` child: its position in the entry stagger. */
export const stagger = (i: number) => ({ '--i': i }) as CSSProperties;
