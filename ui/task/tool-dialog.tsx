import { useEffect, useRef, useState } from "react";
import { callData } from "../app/bridge";
import type { ToolData } from "../shared/types";
import { bytes, duration } from "../shared/format";
import { Status } from "../shared/status";
import { CloseIcon } from "../components/ui/Icons";
import { Button } from "../components/ui/controls";
import "./tool-dialog.css";
type Body = NonNullable<ToolData["tool"]>["input"];
export function ToolBody({
  title,
  body,
  onCopyError,
}: {
  title: string;
  body: Body;
  onCopyError: (error: string) => void;
}) {
  return (
    <section className="tool-body">
      <header className="code-head">
        <div>
          <h3>{title}</h3>
          {body.truncated && (
            <p className="meta">{bytes(body.bytes)} · 只显示前 16,000 字符</p>
          )}
        </div>
        <Button
          label={`复制${title}`}
          disabled={body.text === null}
          onClick={() => {
            if (body.text !== null)
              void navigator.clipboard
                .writeText(body.text.slice(0, 16000))
                .then(
                  () => onCopyError(""),
                  () => onCopyError("无法复制。请重新复制。"),
                );
          }}
        />
      </header>
      <pre className="code" tabIndex={0}>
        <code>{body.text === null ? "—" : body.text.slice(0, 16000)}</code>
      </pre>
    </section>
  );
}
export function ToolDialog({
  threadId,
  toolId,
  close,
}: {
  threadId: string;
  toolId: string;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    closeRef = useRef<HTMLButtonElement>(null);
  const [data, setData] = useState<ToolData>(),
    [error, setError] = useState(""),
    [copyError, setCopyError] = useState("");
  const controller = useRef<AbortController | undefined>(undefined);
  const load = async () => {
    controller.current?.abort();
    const next = new AbortController();
    controller.current = next;
    setError("");
    try {
      const value = await callData<ToolData>(
        "usage_tool",
        { threadId, toolId },
        next.signal,
      );
      if (!next.signal.aborted) {
        setData(value);
        setError(value.reason || "");
      }
    } catch (e) {
      if (!next.signal.aborted)
        setError(e instanceof Error ? e.message : String(e));
    }
  };
  useEffect(() => {
    const previous = document.activeElement as HTMLElement,
      dialog = ref.current!;
    dialog.showModal();
    closeRef.current?.focus();
    void load();
    return () => {
      controller.current?.abort();
      dialog.close();
      previous?.focus();
    };
  }, [threadId, toolId]);
  const tool = data?.tool;
  return (
    <dialog
      className="tool-dialog"
      ref={ref}
      aria-labelledby="tool-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        className="tool-dialog-content"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="tool-heading">
          <div>
            <h2 id="tool-title">
              {tool ? `${tool.name || ""} 工具调用`.trim() : "工具调用"}
            </h2>
            {tool && (
              <p
                className={`meta${tool.exitCode !== null && tool.exitCode !== 0 ? " danger" : ""}`}
              >
                用时 {duration(tool.durationMs)} · 退出码 {tool.exitCode ?? "—"}{" "}
                · 返回 {bytes(tool.output.bytes)}
              </p>
            )}
          </div>
          <button
            ref={closeRef}
            className="icon-btn"
            aria-label="关闭"
            onClick={close}
          >
            <CloseIcon />
          </button>
        </header>
        {error ? (
          <Status kind="error" message={error} retry={() => void load()} />
        ) : !tool ? (
          <Status message="正在读取工具调用" />
        ) : (
          <>
            {(
              [
                ["输入", tool.input],
                ["输出", tool.output],
              ] as const
            ).map(([title, body]) => (
              <ToolBody
                title={title}
                body={body}
                key={title}
                onCopyError={setCopyError}
              />
            ))}
            {copyError && <Status kind="error" message={copyError} />}
          </>
        )}
      </section>
    </dialog>
  );
}
