"use client";

import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

import type { Document } from "@/types/content";

type PreviewPaneProps = {
  document: Document | null;
  title: string;
  body: string;
  previewOnly: boolean;
  onCreateDocument: () => void;
  onOpenImport: () => void;
};

export function PreviewPane({ document, title, body, previewOnly, onCreateDocument, onOpenImport }: PreviewPaneProps) {
  void onCreateDocument;
  void onOpenImport;

  return (
    <article className="cyber-subpanel flex min-h-[24rem] h-full min-w-0 flex-col rounded-md p-4 text-deep-void">
      <p className="holo-label text-markdown-gray">Reader</p>
      <div
        className={`mt-4 min-h-0 flex-1 overflow-auto rounded border border-markdown-gray/80 bg-[#f7fbff] p-5 shadow-[0_18px_40px_rgba(0,8,20,0.28),inset_0_1px_0_rgba(255,255,255,0.72)] ${
          previewOnly ? "mx-auto w-full max-w-[720px]" : ""
        }`}
      >
        <h3 className="mb-4 break-words font-display text-2xl font-black text-deep-void">{document ? title : "Preview"}</h3>
        <div className="markdown-preview min-w-0">
          {document ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
              {body}
            </ReactMarkdown>
          ) : (
            <p>Select a document to see rendered markdown.</p>
          )}
        </div>
      </div>
    </article>
  );
}
