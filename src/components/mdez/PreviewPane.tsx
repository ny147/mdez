"use client";

import { type MouseEvent as ReactMouseEvent, type ReactNode, createElement, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { FilePlus, List, Upload, X } from "lucide-react";

import type { Document } from "@/types/content";
import { extractHeadings } from "@/lib/headings";

type PreviewPaneProps = {
  document: Document | null;
  title: string;
  body: string;
  previewOnly: boolean;
  onCreateDocument: () => void;
  onOpenImport: () => void;
};

export function PreviewPane({ document, title, body, previewOnly, onCreateDocument, onOpenImport }: PreviewPaneProps) {
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [currentHeadingId, setCurrentHeadingId] = useState<string | null>(null);
  const tocRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const headings = useMemo(() => extractHeadings(body), [body]);
  let headingCursor = 0;

  useEffect(() => {
    function closeToc(event: KeyboardEvent | globalThis.MouseEvent) {
      if (!isTocOpen) return;
      if (event instanceof KeyboardEvent && event.key === "Escape") {
        setIsTocOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event instanceof globalThis.MouseEvent && !tocRef.current?.contains(event.target as Node) && event.target !== triggerRef.current) {
        setIsTocOpen(false);
      }
    }

    globalThis.document.addEventListener("keydown", closeToc);
    globalThis.document.addEventListener("mousedown", closeToc);
    return () => {
      globalThis.document.removeEventListener("keydown", closeToc);
      globalThis.document.removeEventListener("mousedown", closeToc);
    };
  }, [isTocOpen]);

  function openToc() {
    setIsTocOpen(true);
    window.setTimeout(() => tocRef.current?.querySelector<HTMLAnchorElement>('a[aria-current="location"], a')?.focus(), 0);
  }

  function selectHeading(event: ReactMouseEvent<HTMLAnchorElement>, id: string) {
    event.preventDefault();
    setCurrentHeadingId(id);
    globalThis.document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setIsTocOpen(false);
  }

  const headingComponents = Object.fromEntries(
    [1, 2, 3, 4, 5, 6].map((depth) => [
      `h${depth}`,
      ({ children }: { children?: ReactNode }) => {
        const heading = headings[headingCursor++];
        return createElement(`h${depth}`, { id: heading?.id }, children);
      }
    ])
  );

  return (
    <article className="library-subpanel relative flex min-h-[24rem] h-full min-w-0 flex-col rounded-md p-4 text-ink">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-accent-read">Reader</p>
        {document && headings.length > 0 ? (
          <button ref={triggerRef} type="button" onClick={openToc} aria-label="Open table of contents" aria-expanded={isTocOpen} className="workspace-icon-button">
            <List aria-hidden="true" className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <nav
        ref={tocRef}
        aria-label="Table of contents"
        aria-hidden={!isTocOpen}
        inert={!isTocOpen}
        className={`toc-panel ${isTocOpen ? "toc-panel-open" : ""}`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
          <h2 className="font-display text-base font-bold">Table of contents</h2>
          <button type="button" aria-label="Close table of contents" onClick={() => { setIsTocOpen(false); triggerRef.current?.focus(); }} className="workspace-icon-button">
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
        <ul className="mt-2 grid gap-1">
          {headings.map((heading) => (
            <li key={heading.id}>
              <a
                href={`#${heading.id}`}
                aria-current={currentHeadingId === heading.id ? "location" : undefined}
                onClick={(event) => selectHeading(event, heading.id)}
                className="block rounded px-2 py-1.5 text-sm text-muted hover:bg-panel hover:text-ink focus-visible:bg-panel"
                style={{ paddingLeft: `${0.5 + (heading.depth - 1) * 0.75}rem` }}
              >
                {heading.text}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className={`mt-3 min-h-0 flex-1 overflow-auto rounded border border-border bg-surface p-5 shadow-soft ${previewOnly ? "mx-auto w-full max-w-[720px]" : ""}`}>
        {document ? (
          <>
            <h2 className="mb-4 break-words font-display text-2xl font-bold text-ink">{title}</h2>
            <div className="markdown-preview min-w-0 max-w-[680px]">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={headingComponents}>
                {body}
              </ReactMarkdown>
            </div>
          </>
        ) : (
          <div className="flex min-h-80 items-center justify-center text-center">
            <div>
              <h2 className="font-display text-xl font-bold">No page selected</h2>
              <p className="mt-2 text-muted">Create a page or import markdown before reading.</p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button type="button" onClick={onCreateDocument} className="primary-button px-3 py-2"><FilePlus aria-hidden="true" className="h-4 w-4" /> Create page</button>
                <button type="button" onClick={onOpenImport} className="secondary-button px-3 py-2 text-sm font-extrabold"><Upload aria-hidden="true" className="h-4 w-4" /> Import markdown</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
