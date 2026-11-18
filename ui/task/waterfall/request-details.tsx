import { useEffect, useState } from "react";
import { callData } from "../../app/bridge";
import { Button } from "../../components/ui/controls";
import { Chevron, CloseIcon } from "../../components/ui/Icons";
import { compact, money } from "../../shared/format";
import { Failure, Status } from "../../shared/status";
import type { TurnData } from "../../shared/types";
import type { TraceSpan } from "../waterfall-model";

function TraceText({
  span,
  threadId,
  turnId,
}: {
  span: TraceSpan;
  threadId: string;
  turnId: string;
}) {
  const [text, setText] = useState<string>(),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void callData<TurnData>(
      "usage_turn",
      {
        threadId,
        turnId,
        text: { id: span.id.slice(span.kind.length + 1), kind: span.kind },
      },
      controller.signal,
    )
      .then((data) => {
        if (data.reason || data.text === undefined)
          throw Error(data.reason || "无法读取全文");
        if (!controller.signal.aborted) {
          setText(data.text);
          setError("");
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : String(e));
      });
    return () => controller.abort();
  }, [threadId, turnId, span.id, span.kind, attempt]);
  return (
    <div className="wf-full-text">
      {error && (
        <Failure error={error} retry={() => setAttempt((n) => n + 1)} />
      )}
      {text === undefined && !error && <Status message="正在读取全文" />}
      {text !== undefined && <p>{text}</p>}
    </div>
  );
}

function NoteDetails({
  span,
  threadId,
  turnId,
}: {
  span: TraceSpan;
  threadId: string;
  turnId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="wf-note">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Chevron next />
        <span>{span.kind === "reasoning" ? "思考" : "回复"}</span>
        {!open && <span className="wf-note-summary">{span.text}</span>}
      </button>
      {open && <TraceText span={span} threadId={threadId} turnId={turnId} />}
    </div>
  );
}

export function RequestDetailsPanel({
  span,
  threadId,
  turnId,
  close,
  id,
}: {
  span: TraceSpan;
  threadId: string;
  turnId: string;
  close: () => void;
  id?: string;
}) {
  const request = span.request!;
  const facts = [
    ["模型", request.model || "—"],
    ["输入", compact(request.input)],
    ["缓存", compact(request.cached)],
    ["输出", compact(request.output)],
    ["推理 tokens", compact(request.reasoning)],
    ["估算费用", money(request.cost)],
  ];
  return (
    <div
      className="wf-details"
      id={id}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
      }}
    >
      <header>
        <h3>{`请求 #${request.sequence} · ${span.label}`}</h3>
        <Button label="关闭请求详情" onClick={close}>
          <CloseIcon />
        </Button>
      </header>
      <p className="meta">
        {`${span.elapsed !== null && span.elapsed < 100 ? "起点推算不可靠。" : ""}模型起点由轮次或前次调用完成时间推算，可能包含等待；无每请求 TTFT。`}
      </p>
      <dl>
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {span.notes?.map((note) => (
        <NoteDetails
          key={note.id}
          span={note}
          threadId={threadId}
          turnId={turnId}
        />
      ))}
    </div>
  );
}
