import { useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { RefreshCw } from "lucide-react";
import {
  Button,
  IconButton,
  SingleChoice,
  ErrorCallout,
  LoadingIndicator,
  Tooltip,
  TooltipProvider,
} from "../components/ui";
import { locale } from "../i18n";
import {
  initialize,
  onResult,
  refresh,
  type Snapshot,
  type TaskSelection,
} from "./bridge";
import { Empty, UsageStats } from "./components";
import { TaskTimeline } from "./timeline";
import { Guide, type GuideSection } from "./guide";
import { text, date, short } from "./format";
import "../style.css";
import "./style.css";

export default function LegacyTask({
  threadId = "",
  onBack,
}: {
  threadId?: string;
  onBack?: () => void;
}) {
  locale.use();
  const [data, setData] = useState<Snapshot>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [days, setDays] = useState("7"),
    [selected, setSelected] = useState(threadId);
  const [taskSelection, setTaskSelection] = useState<TaskSelection>({
    page: 1,
    pageSize: 10,
    search: "",
  });
  const [guide, setGuide] = useState<GuideSection | null>(null);
  const entryScope = useRef<"global" | "thread">("thread"),
    receivedInitial = useRef(false),
    initialized = useRef(false);
  const current = useRef(data);
  current.current = data;
  const alive = useRef(true),
    request = useRef(0),
    inFlight = useRef(false);
  const filter = useRef({ days, selected, taskSelection });
  filter.current = { days, selected, taskSelection };
  const accept = (next: Snapshot) => {
    if (alive.current) {
      setData(next);
      setError("");
    }
  };
  const update = async (
    mode: "auto" | "filter" | "manual" = "manual",
    refreshQuota = false,
  ) => {
    if (inFlight.current && mode !== "filter") return;
    inFlight.current = true;
    const serial = ++request.current;
    setBusy(mode !== "auto");
    const f = filter.current;
    try {
      if (!initialized.current) {
        await initialize();
        initialized.current = true;
      }
      const next = await refresh({
        scope: f.selected ? "thread" : entryScope.current,
        days: Number(f.days),
        ...(refreshQuota ? { refreshQuota: true } : {}),
        ...(f.selected ? { threadId: f.selected } : {}),
        taskPage: f.taskSelection.page,
        taskPageSize: f.taskSelection.pageSize,
        taskSearch: f.taskSelection.search,
      });
      if (serial === request.current) {
        // A restarted Core may still be restoring its first snapshot.
        // Keep the last visible result until the same selection has a new snapshot.
        if (!(
          mode === "auto" &&
          next.state === "collecting" &&
          current.current?.state === "ready"
        )) {
          accept(next);
        }
      }
    } catch (e) {
      if (alive.current && serial === request.current)
        setError(e instanceof Error ? e.message : text("refreshError"));
    } finally {
      if (alive.current && serial === request.current) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  };
  const updateRef = useRef(update);
  updateRef.current = update;
  useEffect(() => {
    alive.current = true;
    const off = onResult((next) => {
      const selection = filter.current.selected;
      if (
        next.scope !== "thread" ||
        (next.state === "ready" &&
          selection &&
          next.thread &&
          next.thread.id !== selection)
      )
        return;
      if (!receivedInitial.current) {
        receivedInitial.current = true;
        setDays(String(next.state === "ready" ? next.range.days : 7));
      }
      accept(next);
    });
    void initialize()
      .then(() => {
        initialized.current = true;
        if (threadId) void updateRef.current("filter");
      })
      .catch((e) => setError(String(e)));
    return () => {
      alive.current = false;
      off();
    };
  }, []);
  useEffect(() => {
    const timer = setInterval(
      () => {
        if (document.visibilityState === "visible" && current.current)
          void updateRef.current("auto");
      },
      data?.state === "collecting" ||
        (data?.state === "ready" && (data.refreshing || data.quota?.refreshing))
        ? 500
        : 10000,
    );
    return () => clearInterval(timer);
  }, [
    data?.state,
    data?.state === "ready" && data.refreshing,
    data?.state === "ready" && data.quota?.refreshing,
  ]);
  useEffect(() => {
    if (current.current) void updateRef.current("filter");
  }, [days, selected, taskSelection]);
  const choose = (id: string) => {
    if (!id && onBack) {
      onBack();
      return;
    }
    if (id) window.scrollTo(0, 0);
    request.current++;
    inFlight.current = false;
    setSelected(id);
    setData((previous) =>
      previous?.state === "ready"
        ? { ...previous, thread: null, binding: "unknown" }
        : previous,
    );
  };
  const global = false;
  const ready = data?.state === "ready" ? data : undefined;
  const failure =
    error ||
    (data && data.state !== "ready" && data.state !== "collecting"
      ? data.message || text(data.state)
      : "");
  const detail = ready?.thread;
  const label =
    detail?.label ??
    ready?.tasks.find((task) => task.id === (detail?.id ?? selected))?.label ??
    (detail ? short(detail.id) : text("unbound"));
  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <TooltipProvider delayDuration={250}>
        <main
          className={`insight-app ${global ? "insight-overview" : "insight-task"}`}
        >
          <header className="insight-header">
            <div className="insight-title">
              {selected && (
                <button className="legacy-back" onClick={() => choose("")}>
                  ← 全部任务
                </button>
              )}
              <h1 title={global || !data ? undefined : label}>
                {global ? text("overview") : !data ? text("usage") : label}
              </h1>
            </div>
            <div className="insight-header-actions">
              {ready && (
                <div className="insight-title insight-refresh-status">
                  <IconButton
                    icon={RefreshCw}
                    size={16}
                    busy={busy}
                    label={text("refresh")}
                    disabled={busy}
                    onClick={() => void update()}
                  />
                  <Tooltip
                    text={
                      <>
                        {text(ready.refreshing ? "restoringHelp" : "freshHelp")}
                        <br />
                        {date(ready.observedAt)}
                      </>
                    }
                  >
                    <span tabIndex={0}>
                      {ready.refreshing
                        ? text("restoring")
                        : date(ready.observedAt)}
                    </span>
                  </Tooltip>
                  <span
                    className={`insight-status ${error || ready.refreshing ? "interrupted" : "completed"}`}
                    role="img"
                    aria-label={text(
                      error || ready.refreshing ? "stale" : "connected",
                    )}
                  />
                </div>
              )}
              {global && (
                <div className="insight-range">
                  <SingleChoice
                    compact
                    label={text("range")}
                    value={days}
                    onChange={(value) => {
                      setDays(value);
                      setTaskSelection((previous) => ({
                        ...previous,
                        page: 1,
                      }));
                    }}
                    options={["day", "week", "month"].map((key, i) => ({
                      value: ["1", "7", "30"][i]!,
                      label: text(key),
                    }))}
                  />
                </div>
              )}
            </div>
          </header>
          {failure && (
            <ErrorCallout
              action={
                <Button
                  variant="ghost"
                  busy={busy}
                  onClick={() => void update()}
                >
                  {text("retry")}
                </Button>
              }
            >
              {failure}
            </ErrorCallout>
          )}
          {!data || data.state !== "ready" ? (
            !failure && (
              <div className="insight-state">
                <LoadingIndicator
                  label={text(
                    data?.state === "collecting" ? "collecting" : "loading",
                  )}
                />
              </div>
            )
          ) : (
            <>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={global ? "global" : (detail?.id ?? "unbound")}
                  className="insight-content"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -3 }}
                >
                  <>
                    {detail ? (
                      <>
                        <UsageStats detail={detail} />
                        <TaskTimeline key={detail.id} detail={detail} />
                      </>
                    ) : (
                      <Empty>
                        {busy ? text("loading") : text("unbound")}
                        {!busy && (
                          <Button
                            variant="ghost"
                            onClick={() => setGuide("start")}
                          >
                            {text("guide")}
                          </Button>
                        )}
                      </Empty>
                    )}
                  </>
                </motion.div>
              </AnimatePresence>
            </>
          )}
          {guide && <Guide section={guide} close={() => setGuide(null)} />}
        </main>
      </TooltipProvider>
    </MotionConfig>
  );
}
