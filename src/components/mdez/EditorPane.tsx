"use client";

import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { FilePlus, Upload } from "lucide-react";
import { type ReactNode, useRef } from "react";

import type { Document, SaveStatus, ViewMode } from "@/types/content";

type EditorPaneProps = {
  document: Document | null;
  title: string;
  body: string;
  saveStatus: SaveStatus;
  viewMode: ViewMode;
  rightSlot?: ReactNode;
  onCreateDocument: () => void;
  onOpenImport: () => void;
  onViewModeChange: (viewMode: ViewMode) => void;
  onBodyChange: (body: string) => void;
  onRename: (title: string) => void;
};

type FormatAction = "bold" | "italic" | "link" | "image" | "code" | "h1" | "h2" | "divider";

const toolbarActions: { action: FormatAction; label: string; glyph: string }[] = [
  { action: "bold", label: "Bold", glyph: "B" },
  { action: "italic", label: "Italic", glyph: "I" },
  { action: "link", label: "Insert link", glyph: "↗" },
  { action: "image", label: "Insert image", glyph: "▧" },
  { action: "code", label: "Code", glyph: "</>" },
  { action: "h1", label: "Heading 1", glyph: "H1" },
  { action: "h2", label: "Heading 2", glyph: "H2" },
  { action: "divider", label: "Divider", glyph: "—" }
];

export function EditorPane({
  document,
  title,
  body,
  saveStatus,
  viewMode,
  rightSlot,
  onCreateDocument,
  onOpenImport,
  onViewModeChange,
  onBodyChange,
  onRename
}: EditorPaneProps) {
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  void saveStatus;
  void viewMode;
  void onViewModeChange;

  function applyFormat(action: FormatAction) {
    const view = editorRef.current?.view;
    if (!view) return;

    const selection = view.state.selection.main;
    const selected = view.state.sliceDoc(selection.from, selection.to);
    let from = selection.from;
    let to = selection.to;
    let insert = selected;
    let anchor = selection.from;

    if (action === "h1" || action === "h2") {
      const line = view.state.doc.lineAt(selection.from);
      const text = line.text.replace(/^#{1,6}\s+/, "");
      const prefix = action === "h1" ? "# " : "## ";
      from = line.from;
      to = line.to;
      insert = prefix + text;
      anchor = from + insert.length;
    } else if (action === "divider") {
      insert = "\n---\n";
      anchor = from + insert.length;
    } else {
      const config = {
        bold: { before: "**", after: "**", fallback: "bold text" },
        italic: { before: "_", after: "_", fallback: "italic text" },
        link: { before: "[", after: "](url)", fallback: "link text" },
        image: { before: "![", after: "](url)", fallback: "image description" },
        code: selected.includes("\n")
          ? { before: "\n\`\`\`\n", after: "\n\`\`\`\n", fallback: "code" }
          : { before: "`", after: "`", fallback: "code" }
      }[action];

      const value = selected || config.fallback;
      insert = config.before + value + config.after;
      anchor = selected ? from + insert.length : from + config.before.length;
    }

    view.dispatch({ changes: { from, to, insert }, selection: { anchor } });
    view.focus();
  }

  if (!document) {
    return (
      <article className="library-subpanel flex min-h-[24rem] h-full flex-col rounded-md p-4">
        <p className="text-sm font-semibold text-accent">Editor</p>
        <div className="mt-4 flex flex-1 items-center justify-center rounded border border-dashed border-border bg-surface p-6 text-center">
          <div className="max-w-sm">
            <h2 className="font-display text-xl font-bold text-ink">No page selected</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-muted">Create a page or import markdown before editing.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={onCreateDocument} className="primary-button px-3 py-2">
                <FilePlus aria-hidden="true" className="h-4 w-4" /> Create page
              </button>
              <button type="button" onClick={onOpenImport} className="secondary-button px-3 py-2 text-sm font-extrabold">
                <Upload aria-hidden="true" className="h-4 w-4" /> Import markdown
              </button>
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="library-subpanel flex min-h-[24rem] h-full min-w-0 flex-col rounded-md p-4">
      <label className="min-w-0">
        <span className="text-sm font-semibold text-accent">Page title</span>
        <input
          aria-label="Page title"
          value={title}
          onChange={(event) => onRename(event.target.value)}
          className="workspace-input mt-2 w-full min-w-0 px-4 py-3 font-display text-xl font-bold placeholder:text-muted focus:ring-0"
        />
      </label>

      <div role="toolbar" aria-label="Markdown toolbar" className="mt-3 flex min-w-0 items-center gap-1 overflow-x-auto rounded-md border border-border bg-panel p-1.5">
        {toolbarActions.map((item) => (
          <button
            key={item.action}
            type="button"
            aria-label={item.label}
            title={item.label}
            onClick={() => applyFormat(item.action)}
            className="workspace-icon-button shrink-0 font-mono text-xs font-bold"
          >
            {item.glyph}
          </button>
        ))}
        <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden="true" />
        <div className="ml-auto flex shrink-0 items-center gap-1">{rightSlot}</div>
      </div>

      <div className="editor-frame mt-3 min-h-0 flex-1 overflow-hidden rounded border border-border bg-surface shadow-soft">
        <CodeMirror
          ref={editorRef}
          value={body}
          height="100%"
          minHeight="60vh"
          extensions={[markdown()]}
          basicSetup={{ lineNumbers: true, foldGutter: true }}
          onChange={onBodyChange}
        />
      </div>
    </article>
  );
}
