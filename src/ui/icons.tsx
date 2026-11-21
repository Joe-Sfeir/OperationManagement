/** Small line icons drawn for this app (no icon pack). 16 px, stroke follows the text colour. */
const base = { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

export const PlayIcon = () => (
  <svg {...base}>
    <path d="M5 3.5v9l7-4.5z" fill="currentColor" />
  </svg>
);
export const PauseIcon = () => (
  <svg {...base}>
    <path d="M5 3.5v9M11 3.5v9" strokeWidth={2.2} />
  </svg>
);
export const RestartIcon = () => (
  <svg {...base}>
    <path d="M3 8a5 5 0 1 0 1.6-3.7M3 3v2.6h2.6" />
  </svg>
);
export const SlidersIcon = () => (
  <svg {...base}>
    <path d="M2.5 5h7M12.5 5h1M2.5 11h1M6.5 11h7" />
    <circle cx="11" cy="5" r="1.5" />
    <circle cx="5" cy="11" r="1.5" />
  </svg>
);
export const CloseIcon = () => (
  <svg {...base}>
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);
export const PanelsIcon = () => (
  <svg {...base}>
    <rect x="2" y="3" width="12" height="10" rx="1.5" />
    <path d="M6 3v10M10 3v10" />
  </svg>
);
export const BackIcon = () => (
  <svg {...base}>
    <path d="M9.5 3.5L5 8l4.5 4.5" />
  </svg>
);
