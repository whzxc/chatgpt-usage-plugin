import { useEffect, useRef, useState } from "react";
import { callData } from "../app/bridge";
import type { ToolData } from "../shared/types";
import { bytes, clock, duration } from "../shared/format";
import { Failure } from "../shared/status";
import { CloseIcon } from "../shared/icons";
import "./tool-dialog.css";

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
  const load = async (signal?: AbortSignal) => {
    try {
      const value = await callData<ToolData>(
        "usage_tool",
        { threadId, toolId },
        signal,
      );
      if (!signal?.aborted) {
        setData(value);
        setError(value.reason || "");
      }
    } catch (e) {
      if (!signal?.aborted) setError(String(e));
    }
  };
  useEffect(() => {
    const previous = document.activeElement as HTMLElement,
      controller = new AbortController(),
      dialog = ref.current!;
    dialog.showModal();
    closeRef.current?.focus();
    void load(controller.signal);
    return () => {
      controller.abort();
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
      aria-describedby="tool-description"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section onClick={(e) => e.stopPropagation()}>
        <header>
          <h2 id="tool-title">{tool?.name || ""} 工具调用</h2>
          <p id="tool-description">
            {tool
              ? `${clock(tool.at)}，用时 ${duration(tool.durationMs)}，返回 ${bytes(tool.output.bytes)}`
              : "正在读取工具调用。"}
          </p>
          <button
            ref={closeRef}
            className="icon-btn"
            aria-label="关闭"
            onClick={close}
          >
            <CloseIcon />
          </button>
        </header>
        <div className="body">
          {error && <Failure error={error} retry={() => void load()} />}
          {tool &&
            (
              [
                ["输入", tool.input],
                ["输出", tool.output],
              ] as const
            ).map(([title, body]) => (
              <div key={title}>
                <div className="code-head">
                  <h3>
                    {title}
                    {body.truncated && (
                      <span>{bytes(body.bytes)}，只显示前 16,000 字符</span>
                    )}
                  </h3>
                  <button
                    className="text-btn"
                    onClick={() =>
                      void navigator.clipboard.writeText(body.text ?? "").then(
                        () => setCopyError(""),
                        () => setCopyError("无法复制。"),
                      )
                    }
                  >
                    复制
                  </button>
                </div>
                <pre className="code" tabIndex={0}>
                  {body.text ?? "—"}
                </pre>
              </div>
            ))}
          {copyError && <p role="status">{copyError}</p>}
        </div>
      </section>
    </dialog>
  );
}
