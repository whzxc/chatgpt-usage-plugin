import type { ReactNode } from "react";
// Lucide paths shared by both views; the package is unnecessary for five icons.
function Icon({ children, size = 16 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}
export const RefreshIcon = () => (
  <Icon>
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M8 16H3v5" />
  </Icon>
);
export const SearchIcon = () => (
  <Icon size={15}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </Icon>
);
export const Chevron = ({ next = false }: { next?: boolean }) => (
  <Icon>
    <path d={next ? "m9 18 6-6-6-6" : "m15 18-6-6 6-6"} />
  </Icon>
);
export const WarningIcon = () => (
  <Icon size={15}>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
    <path d="M12 9v4M12 17h.01" />
  </Icon>
);
export const CloseIcon = () => (
  <Icon>
    <path d="m18 6-12 12M6 6l12 12" />
  </Icon>
);
