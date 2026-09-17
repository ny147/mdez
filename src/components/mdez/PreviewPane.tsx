"use client";

import { FilePlus, Upload } from "lucide-react";
import React, { useRef, type CSSProperties } from "react";

import { MarkdownReader } from "@/components/mdez/MarkdownReader";
import { ReadingWidthHandle } from "@/components/mdez/ReadingWidthHandle";
import type { ReaderPreferences } from "@/hooks/useReaderPreferences";
import type { Document } from "@/types/content";

type PreviewPaneProps = {
  document: Document | null;
  title: string;
  body: string;
  previewOnly: boolean;
  preferences: ReaderPreferences;
  onPreferencesChange: (patch: Partial<ReaderPreferences>) => void;
  onResetPreferences: () => void;
  onCreateDocument: () => void;
  onOpenImport: () => void;
};

export function PreviewPane({
  document,
  title,
  body,
  previewOnly,
  preferences,
  onPreferencesChange,
  onResetPreferences,
  onCreateDocument,
  onOpenImport
}: PreviewPaneProps) {
  const columnRef = useRef<HTMLDivElement>(null);
  const readingStyle = { "--reader-font-size": `${preferences.fontSize}px` } as CSSProperties;
  return (
    <article className="reader-pane library-subpanel relative flex min-h-[24rem] h-full min-w-0 flex-col rounded-md p-4 text-ink" data-preview-only={previewOnly}>
      <div className="reader-toolbar">
        <p className="reader-pane-label">Reader</p>
        {document ? <div className="reader-controls" role="group" aria-label="Reading settings">
          <button type="button" className="workspace-icon-button" aria-label="Decrease reading text size" disabled={preferences.fontSize <= 12} onClick={() => onPreferencesChange({ fontSize: preferences.fontSize - 2 })}>A−</button>
          <output aria-label="Reading text size" aria-live="polite">{preferences.fontSize} px</output>
          <button type="button" className="workspace-icon-button" aria-label="Increase reading text size" disabled={preferences.fontSize >= 28} onClick={() => onPreferencesChange({ fontSize: preferences.fontSize + 2 })}>A+</button>
          <button type="button" className="reader-reset" aria-label="Reset reading settings" onClick={onResetPreferences}>Reset</button>
        </div> : null}
      </div>
      <div className="reader-pane-body mt-3 min-h-0 flex-1 overflow-auto px-1 py-5" style={readingStyle}>
        <div
          ref={columnRef}
          className={`reader-content-column ${previewOnly ? "reader-content-resizable" : ""}`}
          style={{ "--reader-width": `${preferences.readWidth}px` } as CSSProperties}
        >
        {document ? (
          <>
            <MarkdownReader title={title} markdown={body} showTableOfContents />
            {previewOnly ? <ReadingWidthHandle width={preferences.readWidth} containerRef={columnRef} onChange={(readWidth) => onPreferencesChange({ readWidth })} /> : null}
          </>
        ) : (
          <div className="flex min-h-80 items-center justify-center text-center">
            <div>
              <h2 className="font-display text-xl font-bold">No page selected</h2>
              <p className="mt-2 text-muted">Create a page or import markdown before reading.</p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button type="button" onClick={onCreateDocument} className="primary-button px-3 py-2">
                  <FilePlus aria-hidden="true" className="h-4 w-4" /> Create page
                </button>
                <button type="button" onClick={onOpenImport} className="secondary-button px-3 py-2 text-sm font-extrabold">
                  <Upload aria-hidden="true" className="h-4 w-4" /> Import Markdown
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </article>
  );
}
