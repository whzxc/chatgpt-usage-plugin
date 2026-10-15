import type { IndexState } from "./types";
import { integer } from "./format";
export function Indexing({ index }: { index: IndexState }) {
  return (
    <div className="indexing" role="status">
      <p className="indexing-title">正在建立本机用量索引</p>
      <p>
        已读取 {integer(index.processed)} / {integer(index.total)}
      </p>
      <div
        className="progress"
        role="progressbar"
        aria-label="正在建立本机用量索引"
        aria-valuenow={index.processed}
        aria-valuemax={Math.max(1, index.total)}
        aria-valuemin={0}
      >
        <span
          style={{
            width: `${index.total ? (index.processed * 100) / index.total : 0}%`,
          }}
        />
      </div>
    </div>
  );
}
export function Failure({
  error,
  retry,
}: {
  error: string;
  retry: () => void;
}) {
  return (
    <div className="inline-error" role="status">
      <span>读取失败：{error}</span>
      <button className="text-btn" onClick={retry}>
        重试
      </button>
    </div>
  );
}
