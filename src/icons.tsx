import type { ReactNode, SVGProps } from 'react';

/**
 * Hairline icon set: 24px grid, 1.5 stroke, round joins, currentColor.
 * Hand-drawn instead of an icon package so the app ships zero icon deps
 * and every glyph matches the same stroke weight. Always decorative:
 * callers put the accessible name on the button, never on the icon.
 */
type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & { size?: number };

function make(paths: ReactNode) {
  return function Icon({ size = 22, ...rest }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
        {...rest}
      >
        {paths}
      </svg>
    );
  };
}

export const IconTag = make(
  <>
    <path d="M3.5 12.1V4.75c0-.69.56-1.25 1.25-1.25h7.35c.33 0 .65.13.88.37l7.4 7.4a1.25 1.25 0 0 1 0 1.77l-7.35 7.35a1.25 1.25 0 0 1-1.77 0l-7.4-7.4a1.25 1.25 0 0 1-.36-.89Z" />
    <circle cx="8" cy="8" r="1.25" />
  </>,
);

export const IconBox = make(
  <>
    <path d="m12 3 8 4.25v9.5L12 21l-8-4.25v-9.5L12 3Z" />
    <path d="m4 7.25 8 4.25 8-4.25" />
    <path d="M12 11.5V21" />
  </>,
);

export const IconMoon = make(
  <path d="M19.5 14.6A8 8 0 0 1 9.4 4.5a8 8 0 1 0 10.1 10.1Z" />,
);

export const IconUndo = make(
  <>
    <path d="M8.5 5 4 9.5 8.5 14" />
    <path d="M4 9.5h10.25a5.75 5.75 0 0 1 0 11.5H9" />
  </>,
);

export const IconPlus = make(
  <>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </>,
);

export const IconClose = make(
  <>
    <path d="m6 6 12 12" />
    <path d="M18 6 6 18" />
  </>,
);

export const IconCash = make(
  <>
    <rect x="2.75" y="6" width="18.5" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M6 9.5v5" />
    <path d="M18 9.5v5" />
  </>,
);

export const IconCard = make(
  <>
    <rect x="2.75" y="5.5" width="18.5" height="13" rx="2" />
    <path d="M2.75 10h18.5" />
    <path d="M6.5 15h3" />
  </>,
);

export const IconDownload = make(
  <>
    <path d="M12 4v11" />
    <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
    <path d="M4.5 19.5h15" />
  </>,
);

export const IconShare = make(
  <>
    <path d="M12 15V3.75" />
    <path d="M8 7.5 12 3.5l4 4" />
    <path d="M8.5 10.5H6.75c-.69 0-1.25.56-1.25 1.25v7.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-7.5c0-.69-.56-1.25-1.25-1.25H15.5" />
  </>,
);

export const IconCheck = make(<path d="m5 12.5 4.5 4.5L19 7.5" />);

export const IconWarning = make(
  <>
    <path d="M10.7 4.25 2.9 17.75A1.5 1.5 0 0 0 4.2 20h15.6a1.5 1.5 0 0 0 1.3-2.25L13.3 4.25a1.5 1.5 0 0 0-2.6 0Z" />
    <path d="M12 9.5v4" />
    <path d="M12 16.75v.01" />
  </>,
);

export const IconChevronRight = make(<path d="m9.5 5.5 6.5 6.5-6.5 6.5" />);

export const IconArrowRight = make(
  <>
    <path d="M4.5 12h15" />
    <path d="m13.5 6 6 6-6 6" />
  </>,
);

export const IconRefresh = make(
  <>
    <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
    <path d="M19.5 4.5v4h-4" />
  </>,
);
