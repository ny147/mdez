"use client";

import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";

import type { Document, SaveStatus, ViewMode } from "@/types/content";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

const viewOptions: { value: ViewMode; label: string }[] = [
  { value: "split", label: "Split" },
  { value: "editor", label: "Edit" },
  { value: "preview", label: "Read" }
];

type EditorPaneProps = {
  document: Document | null;
  body: string;
  saveStatus: SaveStatus;
  viewMode: ViewMode;
  onViewModeChange: (viewMode: ViewMode) => void;
  onBodyChange: (body: string) => void;
  onRename: (title: string) => void;
};

export function EditorPane({
  document,
  body,
  saveStatus,
  viewMode,
  onViewModeChange,
  onBodyChange,
  onRename
}: EditorPaneProps) {
  if (!document) {
    return (
      <article className="flex min-h-[24rem] h-full flex-col rounded-3xl border-2 border-white/60 bg-abyss/55 p-4">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-mint">Editor</p>
        <div className="mt-4 flex flex-1 items-center justify-center rounded-[1.5rem] border-2 border-dashed border-white/40 bg-white/5 p-6 text-center">
          <div className="max-w-sm">
            <h3 className="text-xl font-black text-cream">No document selected</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-cream/70">
              Import markdown or create a document to start editing.
            </p>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="flex min-h-[24rem] h-full min-w-0 flex-col rounded-3xl border-2 border-white/60 bg-abyss/55 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <label className="min-w-0 flex-1">
          <span className="text-xs font-black uppercase tracking-[0.16em] text-mint">Document title</span>
          <input
            value={document.title}
            onChange={(event) => onRename(event.target.value)}
            className="mt-2 w-full min-w-0 rounded-2xl border-2 border-white/60 bg-white/10 px-4 py-3 text-xl font-black text-cream outline-none transition placeholder:text-cream/45 focus:border-ice"
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <p className="rounded-full border-2 border-white/60 bg-abyss/45 px-3 py-1.5 text-sm font-bold text-cream/80">{saveStatus}</p>
          <div className="hidden lg:block">
            <SegmentedControl label="Workspace view" value={viewMode} options={viewOptions} onChange={onViewModeChange} />
          </div>
        </div>
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-hidden rounded-[1.5rem] border-2 border-white/50 bg-[#282c34]">
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
