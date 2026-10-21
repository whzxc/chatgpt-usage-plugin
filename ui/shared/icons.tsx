import type { ReactNode } from "react";
// Lucide paths shared by both views.
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

export const ZapIcon = () => (
  <Icon size={13}>
    <path d="m4 14 12-12-2 8h6L8 22l2-8H4Z" />
  </Icon>
);

export const InboxIcon = () => (
  <Icon size={44}>
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
  </Icon>
);
export const MessageIcon = () => (
  <Icon size={13}>
    <path d="M21 15a4 4 0 0 1-4 4H7l-5 3V6a4 4 0 0 1 4-4h11a4 4 0 0 1 4 4Z" />
    <path d="M7 8h10M7 12h6" />
  </Icon>
);
export const TraceIcon = ({ name }: { name?: string }) => {
  if (!name)
    return (
      <Icon size={14}>
        <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" />
      </Icon>
    );
  if (/exec|terminal|shell|stdin|command/i.test(name))
    return (
      <Icon size={14}>
        <path d="m4 5 7 7-7 7M13 19h7" />
      </Icon>
    );
  if (/patch|edit|write.*file/i.test(name))
    return (
      <Icon size={14}>
        <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M16 3l5 5M10 14l-1 5 5-1L22 6l-4-4Z" />
      </Icon>
    );
  if (/search|find|grep|glob/i.test(name)) return <SearchIcon />;
  if (/web|fetch|browse|http/i.test(name))
    return (
      <Icon size={14}>
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a18 18 0 0 1 0 20 18 18 0 0 1 0-20" />
      </Icon>
    );
  if (/mcp/i.test(name))
    return (
      <Icon size={14}>
        <path d="M12 3v4M8 3v4M6 7h8v4a4 4 0 0 1-8 0ZM10 15v3a3 3 0 0 0 3 3h4M17 19v4" />
      </Icon>
    );
  if (/file|read|view/i.test(name))
    return (
      <Icon size={14}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8ZM14 2v6h6M8 13h8M8 17h6" />
      </Icon>
    );
  return (
    <Icon size={14}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </Icon>
  );
};
