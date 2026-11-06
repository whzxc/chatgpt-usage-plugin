import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, RefreshIcon, SearchIcon } from "./Icons";
import { time } from "../../shared/format";

export function Button({
  label,
  children,
  busy = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  busy?: boolean;
}) {
  return (
    <button
      {...props}
      type="button"
      className={`${children ? "icon-btn" : "text-btn"}${busy ? " is-busy" : ""} ${props.className ?? ""}`}
      aria-label={label}
      aria-busy={busy || undefined}
      disabled={props.disabled || busy}
    >
      {children ?? (
        <>
          {busy && (
            <Icon>
              <path d="M12 3a9 9 0 1 1-9 9" />
            </Icon>
          )}
          {label}
        </>
      )}
    </button>
  );
}
export function Panel({ children }: { children: ReactNode }) {
  return <main className="panel">{children}</main>;
}
export function Section({
  title,
  actions,
  children,
  className = "",
}: {
  title?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`section ${className}`}>
      {(title || actions) && (
        <header className="section-head">
          <h2>{title}</h2>
          {actions && <div className="tools">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
export function Header({
  title,
  updated,
  busy = false,
  refresh,
  back,
}: {
  title: string;
  updated: number | null;
  busy?: boolean;
  refresh: () => void;
  back?: () => void;
}) {
  return (
    <header className="panel-header">
      {back && (
        <nav>
          <BackButton onClick={back} />
        </nav>
      )}
      <div className="topbar">
        <h1>{title}</h1>
        <div className="updated">
          <span>
            {busy
              ? "正在更新"
              : updated === null
                ? ""
                : `${time(updated)} 更新`}
          </span>
          <Button label="刷新" busy={busy} onClick={refresh}>
            <RefreshIcon />
          </Button>
        </div>
      </div>
    </header>
  );
}
export type Metric = { label: string; value: string; detail?: string };
export function MetricGrid({
  items,
  columns = 3,
  small = false,
}: {
  items: Metric[];
  columns?: number;
  small?: boolean;
}) {
  return (
    <div
      className={`figures${small ? " small" : ""}`}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {items.map((item) => (
        <div className="figure" key={item.label}>
          <span className="label">{item.label}</span>
          <strong className="value">{item.value}</strong>
          {item.detail && <span className="detail">{item.detail}</span>}
        </div>
      ))}
    </div>
  );
}
export function Search({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="search">
      <SearchIcon />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="搜索任务"
        aria-label="搜索任务"
        disabled={disabled}
      />
    </label>
  );
}
export function Tooltip({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: string }[];
}) {
  return (
    <aside className="tooltip" role="tooltip">
      <strong>{title}</strong>
      {rows.map((row) => (
        <div className="tooltip-row" key={row.label}>
          <span>{row.label}</span>
          <span>{row.value}</span>
        </div>
      ))}
    </aside>
  );
}

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <Button label="全部任务" onClick={onClick}>
      <Icon>
        <path d="m12 19-7-7 7-7M5 12h14" />
      </Icon>
    </Button>
  );
}
