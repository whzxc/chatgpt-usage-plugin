import type { IndexState } from "./types";
import { integer } from "./format";
import { Icon, WarningIcon } from "../components/ui/Icons";
import { Button } from "../components/ui/controls";
export function Status({
  kind = "loading",
  message,
  retry,
  processed = 0,
  total = 0,
}: {
  kind?: "loading" | "error" | "stale" | "empty" | "indexing" | "warning";
  message?: string;
  retry?: () => void;
  processed?: number;
  total?: number;
}) {
  const text =
    message ??
    {
      loading: "正在读取本机用量",
      error: "无法读取本机用量",
      stale: "更新失败，显示上次读取的数据。",
      empty: "这个时间范围内没有用量记录",
      indexing: "正在建立本机用量索引",
      warning: "调用起点缺失，保留记录顺序。",
    }[kind];
  return (
    <div role="status" className={`status status-${kind}`}>
      <div className="status-line">
        {["error", "stale", "warning"].includes(kind) ? (
          <WarningIcon />
        ) : (
          <Icon>
            {kind === "empty" ? (
              <>
                <path d="M22 12h-6l-2 3h-4l-2-3H2" />
                <path d="M5 4h14l3 8v8H2v-8Z" />
              </>
            ) : kind === "indexing" ? (
              <>
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M3 5v14a9 3 0 0 0 18 0V5M3 12a9 3 0 0 0 18 0" />
              </>
            ) : (
              <path d="M12 3a9 9 0 1 1-9 9" />
            )}
          </Icon>
        )}
        <span>{text}</span>
        {retry && <Button label="重试" onClick={retry} />}
      </div>
      {kind === "indexing" && (
        <>
          <div className="status-progress-label">
            {`已读取 ${integer(processed)} / ${integer(total)}`}
          </div>
          <div
            className="progress"
            role="progressbar"
            aria-label={text}
            aria-valuenow={processed}
            aria-valuemax={Math.max(1, total)}
            aria-valuemin={0}
          >
            <span
              style={{ width: `${total ? (processed / total) * 100 : 0}%` }}
            />
          </div>
        </>
      )}
    </div>
  );
}
export function Indexing({ index }: { index: IndexState }) {
  return (
    <Status kind="indexing" processed={index.processed} total={index.total} />
  );
}
export function Failure({
  error,
  retry,
}: {
  error: string;
  retry: () => void;
}) {
  return <Status kind="error" message={error || undefined} retry={retry} />;
}
