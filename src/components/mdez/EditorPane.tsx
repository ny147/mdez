"use client";

import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { keymap } from "@codemirror/view";
import { FilePlus, Share2, Upload } from "lucide-react";
import { type ReactNode, useCallback, useMemo, useRef } from "react";

import { EditorToolbar, type FormatAction } from "@/components/mdez/EditorToolbar";
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
  onQuickShare: () => void;
  onViewModeChange: (viewMode: ViewMode) => void;
  onBodyChange: (body: string) => void;
  onRename: (title: string) => void;
};

export function EditorPane({
  document,
  title,
  body,
  saveStatus,
  viewMode,
  rightSlot,
  onCreateDocument,
  onOpenImport,
  onQuickShare,
  onViewModeChange,
  onBodyChange,
  onRename
}: EditorPaneProps) {
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  void saveStatus;
  void viewMode;
  void onViewModeChange;

  const applyFormat = useCallback((action: FormatAction) => {
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
  }, []);

  const formattingShortcuts = useMemo(
    () => keymap.of([
      { key: "Mod-b", run: () => { applyFormat("bold"); return true; } },
      { key: "Mod-i", run: () => { applyFormat("italic"); return true; } },
      { key: "Mod-k", run: () => { applyFormat("link"); return true; } }
    ]),
    [applyFormat]
  );

  if (!document) {
    return (
      <article className="library-subpanel flex min-h-[24rem] h-full flex-col rounded-md p-4">
        <p className="text-sm font-semibold text-accent">Editor</p>
        <div className="mt-4 flex flex-1 items-center justify-center rounded border border-dashed border-border bg-surface p-6 text-center">
          <div className="max-w-sm">
            <h2 className="font-display text-xl font-bold text-ink">No page selected</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-muted">Create a page or import Markdown before editing.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <button type="button" onClick={onCreateDocument} className="primary-button px-3 py-2">
                <FilePlus aria-hidden="true" className="h-4 w-4" /> Create page
              </button>
              <button type="button" onClick={onOpenImport} className="secondary-button px-3 py-2 text-sm font-extrabold">
                <Upload aria-hidden="true" className="h-4 w-4" /> Import Markdown
              </button>
              <button
                type="button"
                disabled
                title="Select a page to use Quick Share"
                className="secondary-button px-3 py-2 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Share2 aria-hidden="true" className="h-4 w-4" /> Quick Share
              </button>
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="library-subpanel flex min-h-[24rem] h-full min-w-0 flex-col rounded-md p-4">
      <h1 className="sr-only">Edit {title}</h1>
      <label className="min-w-0">
        <span className="text-sm font-semibold text-accent">Page title</span>
        <input
          aria-label="Page title"
          value={title}
          onChange={(event) => onRename(event.target.value)}
          className="workspace-input mt-2 w-full min-w-0 px-4 py-3 font-display text-xl font-bold placeholder:text-muted focus:ring-0"
        />
      </label>

      <EditorToolbar
        onFormat={applyFormat}
        documentActions={rightSlot}
        onQuickShare={onQuickShare}
        quickShareDisabled={!document}
      />

      <div className="editor-frame mt-3 min-h-0 flex-1 overflow-hidden rounded border border-border bg-surface shadow-soft">
        <CodeMirror
          ref={editorRef}
          value={body}
          height="100%"
          minHeight="60vh"
          extensions={[markdown(), formattingShortcuts]}
          basicSetup={{ lineNumbers: true, foldGutter: true }}
          onChange={onBodyChange}
        />
      </div>
    </article>
  );
}
