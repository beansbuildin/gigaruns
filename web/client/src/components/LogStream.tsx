import { useEffect, useRef, useState } from "react";

import type { JobLine, SseEvent } from "../types";

/**
 * Live-tails one job's output over SSE. A job that already finished by the
 * time this connects still shows everything — the server replays its full
 * `lines` buffer before switching to live events (see
 * `web/server/src/routes/jobs.ts`'s `/stream` handler).
 */
export function LogStream({ jobId, onDone }: { jobId: string; onDone?: (exitCode: number | null) => void }) {
  const [lines, setLines] = useState<JobLine[]>([]);
  const [exitCode, setExitCode] = useState<number | null | "running">("running");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLines([]);
    setExitCode("running");
    const source = new EventSource(`/api/jobs/${encodeURIComponent(jobId)}/stream`);
    source.onmessage = (event) => {
      const payload = JSON.parse(event.data) as SseEvent;
      if (payload.type === "line") {
        setLines((prev) => [...prev, payload]);
      } else {
        setExitCode(payload.exitCode);
        onDone?.(payload.exitCode);
        source.close();
      }
    };
    source.onerror = () => {
      // The server closes the stream itself when the job finishes; an error
      // after that point is just the connection ending normally.
      source.close();
    };
    return () => source.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [lines]);

  return (
    <div className="log-stream">
      <div className="log-stream__body">
        {lines.map((line, i) => (
          <div key={i} className={`log-stream__line log-stream__line--${line.stream}`}>
            {line.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="log-stream__status">
        {exitCode === "running" ? "running…" : exitCode === 0 ? "✓ finished (exit 0)" : `✗ finished (exit ${exitCode})`}
      </div>
    </div>
  );
}
