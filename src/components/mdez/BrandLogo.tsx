import React from "react";
import mark from "./brand-mark.json";

export type BrandLogoProps = {
  showWordmark?: boolean;
  className?: string;
};

export function BrandLogo({ showWordmark = true, className = "" }: BrandLogoProps) {
  return (
    <span className={`brand-logo ${className}`.trim()} role="img" aria-label="Mdez">
      <svg className="brand-logo-mark" viewBox={mark.viewBox} aria-hidden="true" focusable="false">
        {(["mascot", "book", "sparkle"] as const).map((part) => (
          <g key={part} className={`brand-logo-${part}`}>
            {mark[part].map((shape, index) => (
              <path key={index} d={shape.d} fill={mark.colors[shape.color as keyof typeof mark.colors]} />
            ))}
          </g>
        ))}
      </svg>
      {showWordmark ? <span className="brand-logo-wordmark" aria-hidden="true">mdez</span> : null}
    </span>
  );
}
