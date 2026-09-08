"use client";

import { Share2 } from "lucide-react";
import React, { type ReactNode } from "react";

import type { MarkdownFormatAction } from "@/lib/markdown-format";

export type FormatAction = MarkdownFormatAction;

type FormatActionConfig = {
  action: FormatAction;
  label: string;
  glyph: string;
  ariaKeyShortcuts?: string;
  shortcutLabel?: string;
};

const actions: FormatActionConfig[] = [
  { action: "bold", label: "Bold", glyph: "B", ariaKeyShortcuts: "Control+B Meta+B", shortcutLabel: "Ctrl/⌘ B" },
  { action: "italic", label: "Italic", glyph: "I", ariaKeyShortcuts: "Control+I Meta+I", shortcutLabel: "Ctrl/⌘ I" },
  { action: "link", label: "Insert link", glyph: "↗" },
  { action: "image", label: "Insert image", glyph: "▧" },
  { action: "inlineCode", label: "Inline code", glyph: "`" },
  { action: "codeBlock", label: "Code block", glyph: "</>" },
  { action: "math", label: "Math", glyph: "∑" },
  { action: "h1", label: "Heading 1", glyph: "H1" },
  { action: "h2", label: "Heading 2", glyph: "H2" },
  { action: "divider", label: "Divider", glyph: "---" }
];

type EditorToolbarProps = {
  onFormat: (action: FormatAction) => void;
  documentActions?: ReactNode;
  onQuickShare?: () => void;
  quickShareDisabled?: boolean;
};

function FormatButton({ item, onFormat }: { item: FormatActionConfig; onFormat: (action: FormatAction) => void }) {
  const title = item.shortcutLabel ? `${item.label} (${item.shortcutLabel})` : item.label;

  return (
    <button
      type="button"
      aria-label={item.label}
      aria-keyshortcuts={item.ariaKeyShortcuts}
      title={title}
      onClick={() => onFormat(item.action)}
      className="workspace-icon-button shrink-0 font-mono text-xs font-bold"
    >
      {item.glyph}
    </button>
  );
}

export function EditorToolbar({
  onFormat,
  documentActions,
  onQuickShare,
  quickShareDisabled = false
}: EditorToolbarProps) {
  return (
    <div role="toolbar" aria-label="Markdown toolbar" className="editor-toolbar">
      <div className="editor-format-actions">
        {actions.map((item) => <FormatButton key={item.action} item={item} onFormat={onFormat} />)}
      </div>
      <div className="editor-document-actions">
        {onQuickShare ? (
          <button
            type="button"
            onClick={onQuickShare}
            disabled={quickShareDisabled}
            className="secondary-button min-h-10 shrink-0 px-3 py-2 text-xs font-extrabold disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Share2 aria-hidden="true" className="h-4 w-4" /> Quick Share
          </button>
        ) : null}
        {documentActions}
      </div>
    </div>
  );
}
