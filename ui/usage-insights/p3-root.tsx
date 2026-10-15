import { useEffect, useRef, useState } from "react";
import { initialize, onInitialResult } from "./bridge";
import LegacyTask from "./app";
import P3Overview from "./p3-overview";
import type { OverviewInitial } from "./p3-types";
import "./p3.css";

function overviewOf(result: unknown): OverviewInitial | undefined {
  const value = result as
    | {
        _meta?: { usageOverview?: OverviewInitial };
        structuredContent?: unknown;
      }
    | undefined;
  return (
    value?._meta?.usageOverview ??
    (value?.structuredContent &&
    "summary" in (value.structuredContent as object)
      ? (value.structuredContent as OverviewInitial)
      : undefined)
  );
}
function legacyOf(result: unknown) {
  const value = result as
    { _meta?: { usage?: { scope?: string } } } | undefined;
  return value?._meta?.usage?.scope === "thread";
}
export default function P3Root() {
  const [initial, setInitial] = useState<OverviewInitial>(),
    [thread, setThread] = useState<string | undefined>(),
    [directThread, setDirectThread] = useState(false),
    [error, setError] = useState("");
  const scroll = useRef(0);
  useEffect(() => {
    const off = onInitialResult((result) => {
      const overview = overviewOf(result);
      if (overview) setInitial(overview);
      else if (legacyOf(result)) setDirectThread(true);
    });
    void initialize().catch((e) => setError(String(e)));
    return off;
  }, []);
  if (directThread)
    return (
      <div className="legacy-shell">
        <LegacyTask />
      </div>
    );
  if (error) return <main className="app-state">读取失败：{error}</main>;
  if (!initial) return <main className="app-state">正在读取本机用量。</main>;
  return (
    <>
      <div hidden={!!thread}>
        <P3Overview
          initial={initial}
          active={!thread}
          onOpen={(id) => {
            scroll.current = window.scrollY;
            setThread(id);
            window.scrollTo(0, 0);
          }}
        />
      </div>
      {thread && (
        <div className="legacy-shell">
          <LegacyTask
            threadId={thread}
            onBack={() => {
              setThread(undefined);
              requestAnimationFrame(() => window.scrollTo(0, scroll.current));
            }}
          />
        </div>
      )}
    </>
  );
}
