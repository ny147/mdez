"use client";

import { List, X } from "lucide-react";
import React, {
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  createElement,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

import { extractHeadings } from "@/lib/headings";

type MarkdownReaderProps = {
  title: string;
  markdown: string;
  showTableOfContents?: boolean;
};

function displayTitle(title: string) {
  return title.toLowerCase() === "untitled.md"
    ? "Untitled Document"
    : title.replace(/\.(?:md|markdown)$/i, "");
}

export function MarkdownReader({
  title,
  markdown,
  showTableOfContents = false
}: MarkdownReaderProps) {
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [currentHeadingId, setCurrentHeadingId] = useState<string | null>(null);
  const tocRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const headings = useMemo(() => extractHeadings(markdown), [markdown]);
  let headingCursor = 0;

  useEffect(() => {
    function closeToc(event: KeyboardEvent | globalThis.MouseEvent) {
      if (!isTocOpen) return;
      if (event instanceof KeyboardEvent && event.key === "Escape") {
        setIsTocOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (
        event instanceof globalThis.MouseEvent
        && !tocRef.current?.contains(event.target as Node)
        && event.target !== triggerRef.current
      ) {
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
    window.setTimeout(
      () => tocRef.current?.querySelector<HTMLAnchorElement>('a[aria-current="location"], a')?.focus(),
      0
    );
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
    <div className="relative min-w-0">
      {showTableOfContents && headings.length > 0 ? (
        <div className="flex justify-end">
          <button
            ref={triggerRef}
            type="button"
            onClick={openToc}
            aria-label="Open table of contents"
            aria-expanded={isTocOpen}
            className="workspace-icon-button"
          >
            <List aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {showTableOfContents ? (
        <nav
          ref={tocRef}
          aria-label="Table of contents"
          aria-hidden={!isTocOpen}
          inert={!isTocOpen}
          className={`toc-panel floating-surface ${isTocOpen ? "toc-panel-open" : ""}`}
        >
          <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
            <h2 className="font-display text-base font-bold">Table of contents</h2>
            <button
              type="button"
              aria-label="Close table of contents"
              onClick={() => {
                setIsTocOpen(false);
                triggerRef.current?.focus();
              }}
              className="workspace-icon-button"
            >
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
      ) : null}

      <h1 className="reader-document-title break-words">{displayTitle(title)}</h1>
      <div className="markdown-preview min-w-0 max-w-[680px]">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={headingComponents}
          skipHtml
        >
          {markdown}
        </ReactMarkdown>
      </div>
    </div>
  );
}
