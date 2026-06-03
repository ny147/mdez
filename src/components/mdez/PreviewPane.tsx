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
};

export function PreviewPane({ document, title, body, previewOnly }: PreviewPaneProps) {
  return (
    <article className="flex min-h-[24rem] h-full min-w-0 flex-col rounded-3xl border-2 border-white/60 bg-cream p-4 text-abyss">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-bubble">Reader</p>
      <div className={`mt-4 min-h-0 flex-1 overflow-auto rounded-[1.5rem] bg-white p-5 ${previewOnly ? "mx-auto w-full max-w-[720px]" : ""}`}>
        <h3 className="mb-4 break-words text-2xl font-black text-abyss">{document ? title : "Preview"}</h3>
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
