"use client";

import { type KeyboardEvent, type PointerEvent, type ReactNode, useRef, useState } from "react";

type CompactPane = "editor" | "reader";

type SplitWorkspaceProps = {
  editor: ReactNode;
  reader: ReactNode;
  orientation: "horizontal" | "vertical";
  compact: boolean;
};

const compactOptions: { value: CompactPane; label: string }[] = [
  { value: "editor", label: "Edit" },
  { value: "reader", label: "Preview" }
];

function clampSplit(value: number) {
  return Math.max(30, Math.min(70, Math.round(value)));
}

export function SplitWorkspace({ editor, reader, orientation, compact }: SplitWorkspaceProps) {
  const [value, setValue] = useState(50);
  const [compactPane, setCompactPane] = useState<CompactPane>("editor");
  const containerRef = useRef<HTMLDivElement>(null);
  const isHorizontal = orientation === "horizontal";

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
    if (!event.currentTarget.hasPointerCapture(event.pointerId) || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const position = isHorizontal ? event.clientY - rect.top : event.clientX - rect.left;
    const extent = isHorizontal ? rect.height : rect.width;
    setValue(clampSplit((position / extent) * 100));
  }

  const style = isHorizontal
    ? { gridTemplateRows: `minmax(0, ${value}fr) var(--split-separator-size, 2rem) minmax(0, ${100 - value}fr)` }
    : { gridTemplateColumns: `minmax(0, ${value}fr) var(--split-separator-size, 0.5rem) minmax(0, ${100 - value}fr)` };

  if (compact) {
    return (
      <div className="split-workspace split-workspace-compact" data-orientation="compact">
        <div role="tablist" aria-label="Split workspace pane" className="compact-split-tabs">
          {compactOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              id={`compact-split-${option.value}-tab`}
              aria-controls={`compact-split-${option.value}-panel`}
              aria-selected={compactPane === option.value}
              onClick={() => setCompactPane(option.value)}
              className="compact-split-tab"
            >
              {option.label}
            </button>
          ))}
        </div>
        <div
          id="compact-split-editor-panel"
          role="tabpanel"
          aria-label="Edit"
          aria-labelledby="compact-split-editor-tab"
          hidden={compactPane !== "editor"}
          className="min-h-0 min-w-0"
        >
          {editor}
        </div>
        <div
          id="compact-split-reader-panel"
          role="tabpanel"
          aria-label="Preview"
          aria-labelledby="compact-split-reader-tab"
          hidden={compactPane !== "reader"}
          className="min-h-0 min-w-0"
        >
          {reader}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="split-workspace" data-orientation={orientation} style={style}>
      <div className="min-h-0 min-w-0 overflow-hidden">{editor}</div>
      <button
        type="button"
        role="separator"
        aria-label="Resize editor and reader panes"
        aria-orientation={orientation}
        aria-valuemin={30}
        aria-valuemax={70}
        aria-valuenow={value}
        aria-valuetext={`Editor ${value} percent ${isHorizontal ? "height" : "width"}`}
        onKeyDown={handleKeyDown}
        onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
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
