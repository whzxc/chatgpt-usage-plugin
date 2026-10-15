import { useEffect, useRef, useState } from "react";
import { initialize, onInitialResult } from "./bridge";
import Overview from "../overview/overview";
import TaskPage from "../task/task";
import type { OverviewInitial, ThreadData } from "../shared/types";
import "../shared/layout.css";

export default function Root() {
  const [initial, setInitial] = useState<OverviewInitial>(),
    [thread, setThread] = useState<string | undefined>(),
    [directThread, setDirectThread] = useState<ThreadData>(),
    [error, setError] = useState("");
  const scroll = useRef(0);
  useEffect(() => {
    const off = onInitialResult((result) => {
      const meta = (
        result as {
          _meta?: {
            usageOverview?: OverviewInitial;
            usageTask?: ThreadData;
            usageError?: string;
          };
        }
      )._meta;
      setError(meta?.usageError ?? "");
      if (meta?.usageOverview) {
        setInitial(meta.usageOverview);
        setDirectThread(undefined);
      }
      if (meta?.usageTask) setDirectThread(meta.usageTask);
    });
    void initialize().catch((e) => setError(String(e)));
    return off;
  }, []);
  if (directThread) return <TaskPage initial={directThread} />;
  if (error) return <main className="app-state">读取失败：{error}</main>;
  if (!initial) return <main className="app-state">正在读取本机用量。</main>;
  return (
    <>
      <div hidden={!!thread}>
        <Overview
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
        <TaskPage
          threadId={thread}
          onBack={() => {
            setThread(undefined);
            requestAnimationFrame(() => window.scrollTo(0, scroll.current));
          }}
        />
      )}
    </>
  );
}
