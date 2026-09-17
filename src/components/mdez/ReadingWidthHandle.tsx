"use client";

import { useRef, type RefObject } from "react";
import { GripVertical } from "lucide-react";

type ReadingWidthHandleProps = {
  width: number;
  containerRef: RefObject<HTMLDivElement | null>;
  onChange: (width: number) => void;
};

export function ReadingWidthHandle({ width, containerRef, onChange }: ReadingWidthHandleProps) {
  const drag = useRef<{ x: number; width: number } | null>(null);
  function changeWidth(next: number) {
    const available = containerRef.current?.parentElement?.clientWidth ?? 1440;
    onChange(Math.max(320, Math.min(1440, available, Math.round(next))));
  }

  return (
    <button
      type="button"
      role="separator"
      aria-label="Resize reading width"
      aria-orientation="vertical"
      aria-valuemin={320}
      aria-valuemax={1440}
      aria-valuenow={width}
      aria-valuetext={`${width} pixels, limited to the available screen width`}
      title="Drag to resize reading width, or use the arrow keys"
      className="reading-width-handle"
      onKeyDown={(event) => {
        const changes: Record<string, number> = { ArrowLeft: width - 40, ArrowRight: width + 40, Home: 320, End: 1440 };
        if (!(event.key in changes)) return;
        event.preventDefault();
        changeWidth(changes[event.key]);
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        drag.current = { x: event.clientX, width: containerRef.current?.getBoundingClientRect().width ?? width };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
        event.currentTarget.focus();
      }}
      onPointerMove={(event) => {
        if (!drag.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
        // The reading column is centered, so its two edges move symmetrically.
        changeWidth(drag.current.width + 2 * (event.clientX - drag.current.x));
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        drag.current = null;
      }}
      onPointerCancel={() => { drag.current = null; }}
      onLostPointerCapture={() => { drag.current = null; }}
    >
      <GripVertical aria-hidden="true" className="reading-width-grip" />
    </button>
  );
}
