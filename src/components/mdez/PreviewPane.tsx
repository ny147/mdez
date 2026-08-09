"use client";

import { FilePlus, Upload } from "lucide-react";
import React from "react";

import { MarkdownReader } from "@/components/mdez/MarkdownReader";
import type { Document } from "@/types/content";

type PreviewPaneProps = {
  document: Document | null;
  title: string;
  body: string;
  previewOnly: boolean;
  onCreateDocument: () => void;
  onOpenImport: () => void;
};

export function PreviewPane({
  document,
  title,
  body,
  previewOnly,
  onCreateDocument,
  onOpenImport
}: PreviewPaneProps) {
  return (
    <article className="library-subpanel relative flex min-h-[24rem] h-full min-w-0 flex-col rounded-md p-4 text-ink">
      <p className="text-sm font-semibold text-accent-read">Reader</p>
      <div className={`mt-3 min-h-0 flex-1 overflow-auto px-1 py-5 ${previewOnly ? "mx-auto w-full max-w-[720px]" : ""}`}>
        {document ? (
          <MarkdownReader title={title} markdown={body} showTableOfContents />
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
    </article>
  );
}
