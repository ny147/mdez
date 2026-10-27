"use client";

import { useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import { DEFAULT_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH, MIN_SIDEBAR_WIDTH } from "@/hooks/useSidebarWidth";

type SidebarWidthHandleProps = {
  width: number;
  onChange: (width: number) => void;
};

export function SidebarWidthHandle({ width, onChange }: SidebarWidthHandleProps) {
  const drag = useRef<{ x: number; width: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  function stopDragging() {
    drag.current = null;
    setDragging(false);
  }

  return (
    <button
      type="button"
      role="separator"
      aria-label="Resize library sidebar"
      aria-controls="library-shelf"
      aria-orientation="vertical"
      aria-valuemin={MIN_SIDEBAR_WIDTH}
      aria-valuemax={MAX_SIDEBAR_WIDTH}
      aria-valuenow={width}
      aria-valuetext={`${width} pixels`}
      title="Drag or use arrow keys to resize. Double-click to reset."
      className="sidebar-width-handle"
      data-dragging={dragging}
      onDoubleClick={() => onChange(DEFAULT_SIDEBAR_WIDTH)}
      onKeyDown={(event) => {
        const changes: Record<string, number> = {
          ArrowLeft: width - 16, ArrowRight: width + 16,
          Home: MIN_SIDEBAR_WIDTH, End: MAX_SIDEBAR_WIDTH
        };
        if (!(event.key in changes)) return;
        event.preventDefault();
        onChange(changes[event.key]);
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        drag.current = { x: event.clientX, width };
        setDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.focus();
        event.preventDefault();
      }}
      onPointerMove={(event) => {
        if (!drag.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
        onChange(drag.current.width + event.clientX - drag.current.x);
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        stopDragging();
      }}
      onPointerCancel={stopDragging}
      onLostPointerCapture={stopDragging}
    >
      <GripVertical aria-hidden="true" />
    </button>
  );
}
