"use client";

import Image from "next/image";
import React, { useState } from "react";

type MascotProps = {
  pose: "writing" | "peeking";
  className?: string;
};

export function Mascot({ pose, className = "" }: MascotProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = `/brand/mascot-${pose}.png`;
  const dimensions = pose === "writing" ? { width: 384, height: 256 } : { width: 416, height: 277 };
  return (
    <span className={`library-mascot ${className}`.trim()} aria-hidden="true">
      <Image
        src={src}
        alt=""
        {...dimensions}
        unoptimized
        draggable={false}
        style={{ visibility: failedSrc === src ? "hidden" : undefined }}
        onError={() => setFailedSrc(src)}
      />
    </span>
  );
}
