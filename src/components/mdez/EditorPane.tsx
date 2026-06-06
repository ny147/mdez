"use client";

import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import type { ReactNode } from "react";

import type { Document, SaveStatus, ViewMode } from "@/types/content";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

const viewOptions: { value: ViewMode; label: string }[] = [
  { value: "split", label: "Split" },
  { value: "editor", label: "Edit" },
  { value: "preview", label: "Read" }
];

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
  void onCreateDocument;
  void onOpenImport;

  const saveStatusClass =
    saveStatus === "Saved"
      ? "border-success/60 bg-success/15 text-success"
      : saveStatus === "Saving..."
        ? "border-holo-blue/55 bg-holo-blue/10 text-holo-blue"
        : "border-oshi-pink/60 bg-oshi-pink/15 text-oshi-pink";

  if (!document) {
    return (
      <article className="cyber-subpanel flex min-h-[24rem] h-full flex-col rounded-md p-4">
        <p className="holo-label text-success">Editor</p>
        <div className="mt-4 flex flex-1 items-center justify-center rounded border border-dashed border-holo-blue/35 bg-deep-void/35 p-6 text-center">
          <div className="max-w-sm">
            <h3 className="font-display text-xl font-black text-ink">No document selected</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-ink-muted">
              Import markdown or create a document to start editing.
            </p>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="cyber-subpanel flex min-h-[24rem] h-full min-w-0 flex-col rounded-md p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <label className="min-w-0 flex-1">
          <span className="holo-label text-success">Document title</span>
          <input
            value={title}
            onChange={(event) => onRename(event.target.value)}
            className="holo-input mt-2 w-full min-w-0 px-4 py-3 font-display text-xl font-black placeholder:text-ink-muted/70 focus:ring-0"
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <p
            role="status"
            aria-live="polite"
            className={`rounded border px-3 py-1.5 font-mono text-sm font-bold ${saveStatusClass}`}
          >
            {saveStatus}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="hidden lg:block">
              <SegmentedControl label="Workspace view" value={viewMode} options={viewOptions} onChange={onViewModeChange} />
            </div>
            {rightSlot}
          </div>
        </div>
      </div>

      <div className="holo-editor-frame mt-4 min-h-0 flex-1 overflow-hidden rounded border border-holo-blue/65 bg-[#0b1020] shadow-[0_0_18px_rgba(39,194,255,0.2),inset_0_1px_0_rgba(208,215,222,0.08)]">
        <CodeMirror
          value={body}
          height="100%"
          minHeight="60vh"
          extensions={[markdown()]}
          theme={oneDark}
          basicSetup={{ lineNumbers: true, foldGutter: true }}
          onChange={onBodyChange}
        />
      </div>
    </article>
  );
}
