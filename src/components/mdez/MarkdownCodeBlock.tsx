"use client";

import { Check, Copy, TriangleAlert } from "lucide-react";
import React, { type ReactNode, isValidElement, useRef, useState } from "react";

type CopyStatus = "idle" | "copied" | "error";

function getLanguage(children: ReactNode) {
  const codeElement = React.Children.toArray(children).find(
    (child) => isValidElement<{ className?: string }>(child)
  );
  const className = isValidElement<{ className?: string }>(codeElement)
    ? codeElement.props.className
    : undefined;
  return className?.match(/(?:^|\s)language-([^\s]+)/)?.[1] ?? "code";
}

export function MarkdownCodeBlock({ children }: { children?: ReactNode }) {
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const codeRef = useRef<HTMLPreElement>(null);
  const copyLabel = copyStatus === "copied"
    ? "Code copied"
    : copyStatus === "error"
      ? "Copy failed"
      : "Copy code";

  async function copyCode() {
    const source = codeRef.current?.textContent?.replace(/\n$/, "") ?? "";
    try {
      await navigator.clipboard.writeText(source);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  }

  return (
    <div className="markdown-code-block">
      <div className="markdown-code-toolbar">
        <span className="markdown-code-language">{getLanguage(children)}</span>
        <button
          type="button"
          onClick={() => void copyCode()}
          aria-label={copyLabel}
          className="markdown-code-copy"
        >
          {copyStatus === "copied" ? <Check aria-hidden="true" />
            : copyStatus === "error" ? <TriangleAlert aria-hidden="true" />
              : <Copy aria-hidden="true" />}
          {copyStatus === "copied" ? "Copied" : copyStatus === "error" ? "Failed" : "Copy"}
        </button>
      </div>
      <pre ref={codeRef}>{children}</pre>
      <span className="sr-only" aria-live="polite">
        {copyStatus === "copied" ? "Code copied to clipboard"
          : copyStatus === "error" ? "Unable to copy code" : ""}
      </span>
    </div>
  );
}
