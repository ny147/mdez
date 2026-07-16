import type { ReactNode } from "react";

export type FormatAction = "bold" | "italic" | "link" | "image" | "code" | "h1" | "h2" | "divider";

const actions: { action: FormatAction; label: string; glyph: string }[] = [
  { action: "bold", label: "Bold", glyph: "B" },
  { action: "italic", label: "Italic", glyph: "I" },
  { action: "link", label: "Insert link", glyph: "\u2197" },
  { action: "image", label: "Insert image", glyph: "\u25a7" },
  { action: "code", label: "Code", glyph: "</>" },
  { action: "h1", label: "Heading 1", glyph: "H1" },
  { action: "h2", label: "Heading 2", glyph: "H2" },
  { action: "divider", label: "Divider", glyph: "---" }
];

type EditorToolbarProps = {
  onFormat: (action: FormatAction) => void;
  documentActions?: ReactNode;
};

export function EditorToolbar({ onFormat, documentActions }: EditorToolbarProps) {
  return (
    <div role="toolbar" aria-label="Markdown toolbar" className="editor-toolbar">
      <div className="editor-format-actions">
        {actions.map((item) => (
          <button
            key={item.action}
            type="button"
            aria-label={item.label}
            title={item.label}
            onClick={() => onFormat(item.action)}
            className="workspace-icon-button shrink-0 font-mono text-xs font-bold"
          >
            {item.glyph}
          </button>
        ))}
      </div>
      <div className="editor-document-actions">{documentActions}</div>
    </div>
  );
}