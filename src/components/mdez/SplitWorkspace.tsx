"use client";

import { type KeyboardEvent, type PointerEvent, type ReactNode, useEffect, useRef, useState } from "react";

type SplitWorkspaceProps = {
  editor: ReactNode;
  reader: ReactNode;
};

function clampSplit(value: number) {
  return Math.max(30, Math.min(70, Math.round(value)));
}

export function SplitWorkspace({ editor, reader }: SplitWorkspaceProps) {
  const [value, setValue] = useState(50);
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobile(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const changes: Record<string, number> = {
      ArrowLeft: value - 5,
      ArrowUp: value - 5,
      ArrowRight: value + 5,
      ArrowDown: value + 5,
      Home: 30,
      End: 70
    };
    if (!(event.key in changes)) return;
    event.preventDefault();
    setValue(clampSplit(changes[event.key]));
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (isMobile || !event.currentTarget.hasPointerCapture(event.pointerId) || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setValue(clampSplit(((event.clientX - rect.left) / rect.width) * 100));
  }

  const style = isMobile
    ? { gridTemplateRows: `${value}% 2rem ${100 - value}%` }
    : { gridTemplateColumns: `${value}% 0.5rem ${100 - value}%` };

  return (
    <div ref={containerRef} className="split-workspace" style={style}>
      <div className="min-h-0 min-w-0 overflow-hidden">{editor}</div>
      <button
        type="button"
        role="separator"
        aria-label="Resize editor and reader panes"
        aria-orientation={isMobile ? "horizontal" : "vertical"}
        aria-valuemin={30}
        aria-valuemax={70}
        aria-valuenow={value}
        aria-valuetext={`Editor ${value} percent ${isMobile ? "height" : "width"}`}
        onKeyDown={handleKeyDown}
        onPointerDown={(event) => {
          if (!isMobile) event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        className="split-separator"
      />
      <div className="min-h-0 min-w-0 overflow-hidden">{reader}</div>
    </div>
  );
}
