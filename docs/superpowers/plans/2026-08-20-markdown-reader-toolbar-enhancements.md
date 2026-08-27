# Markdown Reader and Toolbar Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Mdez's existing KaTeX reader with safe LaTeX compatibility delimiters, add polished copyable code blocks, and replace the editor's More disclosure with one explicit horizontally scrollable formatting row.

**Architecture:** Keep `MarkdownReader` as the shared rendering boundary for workspace previews and public shared pages. Add one pure delimiter normalizer before the existing `react-markdown` pipeline, one focused code-block component around highlighted `<code>` output, and one pure Markdown-format edit builder between `EditorToolbar` and CodeMirror. Preserve existing safety and rendering plugins; do not introduce another Markdown parser or duplicate reader implementation.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, CodeMirror 6, react-markdown, remark-gfm, remark-math, rehype-highlight, rehype-katex, KaTeX, Vitest, Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-12-markdown-math-rendering-design.md` defines the shared-reader, responsive-math, and raw-HTML safety constraints. The approved task design extends that spec with `\(...\)` and `\[...\]` compatibility, copyable code blocks, and the one-row toolbar described here.

## Global Constraints

- Work on `codex/markdown-rendering` in `.worktrees/markdown-rendering` after fast-forwarding the branch from the latest `main`.
- Standard `$...$` and `$$...$$` rendering already exists and must remain unchanged.
- Support `\(...\)` as inline math and `\[...\]` as display math.
- Do not interpret plain `[ ... ]` text as math.
- Do not normalize math delimiters inside inline code, backtick-fenced code, or tilde-fenced code.
- Keep `skipHtml` enabled; do not add `rehype-raw`, KaTeX trust mode, custom macros, or raw HTML rendering.
- Keep `rehype-highlight` and existing syntax colors intact.
- Workspace preview and public shared pages must inherit the same behavior through `MarkdownReader`.
- The formatting row order is: Bold, Italic, Link, Image, Inline code, Code block, Math, H1, H2, Divider.
- Quick Share and export controls remain in `.editor-document-actions`; they are not part of the horizontally scrolling format strip.
- Mobile controls remain at least 44 by 44 CSS pixels and must not cause document-level horizontal overflow.
- No sidebar, books, pages, storage, import, export, GitHub, Quick Share, or key-group behavior changes belong in this branch.
- No new npm dependencies are required; `remark-math`, `rehype-katex`, `katex`, and `rehype-highlight` are already installed.
- Use strict red-green-refactor TDD for each behavioral slice.

---

### Task 1: Normalize LaTeX Compatibility Delimiters Outside Code

**Files:**
- Create: `src/lib/markdown-math.ts`
- Create: `tests/unit/markdown-math.test.ts`

**Interfaces:**
- Consumes: raw Markdown as `string`.
- Produces: `normalizeMathDelimiters(markdown: string): string`.
- Contract: convert unescaped `\(`, `\)`, `\[`, and `\]` outside code while preserving all other bytes and line endings.

- [ ] **Step 1: Write the failing normalizer tests**

Create `tests/unit/markdown-math.test.ts`:

````ts
import { describe, expect, it } from "vitest";

import { normalizeMathDelimiters } from "@/lib/markdown-math";

describe("normalizeMathDelimiters", () => {
  it("converts inline compatibility delimiters", () => {
    expect(normalizeMathDelimiters("Value: \\(n! = n(n-1)\\cdots1\\)"))
      .toBe("Value: $n! = n(n-1)\\cdots1$");
  });

  it("converts display compatibility delimiters", () => {
    expect(normalizeMathDelimiters("\\[\n\\frac{8!}{6!}=56\n\\]"))
      .toBe("$$\n\\frac{8!}{6!}=56\n$$");
  });

  it("leaves plain square brackets and escaped delimiters unchanged", () => {
    expect(normalizeMathDelimiters("[ordinary text] and \\\\(literal\\\\)"))
      .toBe("[ordinary text] and \\\\(literal\\\\)");
  });

  it("does not normalize delimiters inside inline or fenced code", () => {
    const markdown = "`\\(inline\\)`\n\n```text\n\\[backticks\\]\n```\n\n~~~text\n\\(tildes\\)\n~~~";
    expect(normalizeMathDelimiters(markdown)).toBe(markdown);
  });
});
````

- [ ] **Step 2: Run the test and verify it fails for the missing module**

Run:

```powershell
npm test -- tests/unit/markdown-math.test.ts
```

Expected: FAIL because `@/lib/markdown-math` does not exist. Do not write renderer code before observing this failure.

- [ ] **Step 3: Implement the minimal stateful normalizer**

Create `src/lib/markdown-math.ts`:

```ts
function countRun(value: string, index: number, character: string) {
  let cursor = index;
  while (value[cursor] === character) cursor += 1;
  return cursor - index;
}

function isEscaped(value: string, index: number) {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === "\\"; cursor -= 1) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
}

function normalizeLine(line: string) {
  let result = "";
  let cursor = 0;
  let inlineCodeTicks = 0;

  while (cursor < line.length) {
    if (line[cursor] === "`") {
      const tickCount = countRun(line, cursor, "`");
      if (inlineCodeTicks === 0) inlineCodeTicks = tickCount;
      else if (tickCount === inlineCodeTicks) inlineCodeTicks = 0;
      result += line.slice(cursor, cursor + tickCount);
      cursor += tickCount;
      continue;
    }

    if (inlineCodeTicks === 0 && !isEscaped(line, cursor)) {
      const delimiter = line.slice(cursor, cursor + 2);
      if (delimiter === "\\(" || delimiter === "\\)") {
        result += "$";
        cursor += 2;
        continue;
      }
      if (delimiter === "\\[" || delimiter === "\\]") {
        result += "$$";
        cursor += 2;
        continue;
      }
    }

    result += line[cursor];
    cursor += 1;
  }

  return result;
}

export function normalizeMathDelimiters(markdown: string) {
  let fenceMarker: "`" | "~" | null = null;
  let fenceLength = 0;

  return markdown.split(/(\r?\n)/).map((line) => {
    if (/^\r?\n$/.test(line)) return line;
    const fence = line.match(/^\s{0,3}(`{3,}|~{3,})/);

    if (fence) {
      const marker = fence[1][0] as "`" | "~";
      const length = fence[1].length;
      if (fenceMarker === null) {
        fenceMarker = marker;
        fenceLength = length;
      } else if (marker === fenceMarker && length >= fenceLength) {
        fenceMarker = null;
        fenceLength = 0;
      }
      return line;
    }

    return fenceMarker === null ? normalizeLine(line) : line;
  }).join("");
}
```

- [ ] **Step 4: Run the normalizer tests and verify they pass**

Run:

```powershell
npm test -- tests/unit/markdown-math.test.ts
```

Expected: 4 tests pass. Confirm the code examples remain byte-for-byte unchanged.

- [ ] **Step 5: Commit the isolated normalizer**

```powershell
git add src/lib/markdown-math.ts tests/unit/markdown-math.test.ts
git commit -m "feat: normalize latex compatibility delimiters"
```

---

### Task 2: Apply Compatibility Math to Every Shared Reader Surface

**Files:**
- Modify: `src/components/mdez/MarkdownReader.tsx`
- Modify: `tests/unit/markdown-reader.test.tsx`
- Test: `tests/unit/public-shared-page.test.tsx`

**Interfaces:**
- Consumes: `normalizeMathDelimiters(markdown: string): string` from Task 1.
- Produces: KaTeX DOM for compatibility delimiters through the existing `remarkMath` and `rehypeKatex` pipeline.
- No public component prop changes.

- [ ] **Step 1: Add failing reader-level compatibility tests**

Append to `tests/unit/markdown-reader.test.tsx`:

````tsx
it("renders LaTeX inline compatibility delimiters", () => {
  const { container } = render(
    <MarkdownReader title="Inline" markdown={"Value: \\(n! = n(n-1)\\cdots1\\)"} />
  );
  expect(container.querySelector(".katex")).toBeInTheDocument();
  expect(container.querySelector(".katex-display")).toBeNull();
});

it("renders LaTeX display compatibility delimiters", () => {
  const { container } = render(
    <MarkdownReader title="Display" markdown={"\\[\n\\frac{8!}{6!}=56\n\\]"} />
  );
  expect(container.querySelector(".katex-display")).toBeInTheDocument();
});

it("does not render compatibility delimiters inside code", () => {
  const { container } = render(
    <MarkdownReader title="Code" markdown={"`\\(inline\\)`\n\n```text\n\\[display\\]\n```"} />
  );
  expect(container.querySelector(".katex")).toBeNull();
  expect(screen.getByText("\\(inline\\)")).toBeVisible();
  expect(screen.getByText("\\[display\\]")).toBeVisible();
});
````

- [ ] **Step 2: Run the reader tests and verify the two rendering tests fail**

```powershell
npm test -- tests/unit/markdown-reader.test.tsx
```

Expected: inline and display compatibility assertions fail because `MarkdownReader` still passes raw Markdown to `ReactMarkdown`; the code-safety assertion passes.

- [ ] **Step 3: Normalize once at the shared reader boundary**

In `src/components/mdez/MarkdownReader.tsx`, import the Task 1 function and memoize its result:

````tsx
import { normalizeMathDelimiters } from "@/lib/markdown-math";

const normalizedMarkdown = useMemo(
  () => normalizeMathDelimiters(markdown),
  [markdown]
);
````

Pass `normalizedMarkdown` to the existing `ReactMarkdown` child:

```tsx
<ReactMarkdown
  remarkPlugins={[remarkGfm, remarkMath]}
  rehypePlugins={[
    rehypeHighlight,
    [rehypeKatex, { throwOnError: false }]
  ]}
  components={headingComponents}
  skipHtml
>
  {normalizedMarkdown}
</ReactMarkdown>
```

Do not change plugin order, `skipHtml`, or KaTeX options.

- [ ] **Step 4: Run shared-reader regression tests**

```powershell
npm test -- tests/unit/markdown-reader.test.tsx tests/unit/public-shared-page.test.tsx
```

Expected: all tests pass, including standard `$...$`, standard `$$...$$`, plain bracket prose, raw HTML suppression, compatibility delimiters, and public shared pages.

- [ ] **Step 5: Commit shared-reader integration**

```powershell
git add src/components/mdez/MarkdownReader.tsx tests/unit/markdown-reader.test.tsx
git commit -m "feat: render compatible latex delimiters"
```

---

### Task 3: Add Copyable Highlighted Code Blocks

**Files:**
- Create: `src/components/mdez/MarkdownCodeBlock.tsx`
- Modify: `src/components/mdez/MarkdownReader.tsx`
- Modify: `src/app/styles/markdown.css`
- Modify: `tests/unit/markdown-reader.test.tsx`

**Interfaces:**
- Consumes: the highlighted `<code>` React node produced by `rehype-highlight` as `children?: ReactNode`.
- Produces: `MarkdownCodeBlock({ children }: { children?: ReactNode })` with language label, `<pre>`, copy control, and live status.
- Clipboard source: rendered `<pre>.textContent` with exactly one Markdown-added trailing newline removed.

- [ ] **Step 1: Add failing language-label and clipboard tests**

Update the Testing Library imports in `tests/unit/markdown-reader.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
```

Append:

````tsx
it("labels a fenced code block and copies its source", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText }
  });

  render(
    <MarkdownReader title="TypeScript" markdown={"```ts\nconst value = 1;\n```"} />
  );

  expect(screen.getByText("ts", { exact: true })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Copy code" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith("const value = 1;"));
  expect(screen.getByRole("button", { name: "Code copied" })).toBeVisible();
});

it("reports when copying a code block fails", async () => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockRejectedValue(new Error("Clipboard unavailable")) }
  });

  render(<MarkdownReader title="Failure" markdown={"```text\ncopy me\n```"} />);
  fireEvent.click(screen.getByRole("button", { name: "Copy code" }));
  expect(await screen.findByRole("button", { name: "Copy failed" })).toBeVisible();
});
````

- [ ] **Step 2: Run the tests and verify they fail on missing controls**

```powershell
npm test -- tests/unit/markdown-reader.test.tsx
```

Expected: FAIL because no language label or Copy button exists. Existing highlighting assertions remain green.

- [ ] **Step 3: Create the focused code-block component**

Create `src/components/mdez/MarkdownCodeBlock.tsx`:

```tsx
"use client";

import { Check, Copy, TriangleAlert } from "lucide-react";
import React, { type ReactNode, isValidElement, useRef, useState } from "react";

type CopyStatus = "idle" | "copied" | "error";

function getLanguage(children: ReactNode) {
  const codeElement = React.Children.toArray(children).find(
    (child) => isValidElement<{ className?: string }>(child)
  );
  const className = isValidElement<{ className?: string }>(codeElement)
    ? codeElement.props.className
    : undefined;
  return className?.match(/(?:^|\s)language-([^\s]+)/)?.[1] ?? "code";
}

export function MarkdownCodeBlock({ children }: { children?: ReactNode }) {
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const codeRef = useRef<HTMLPreElement>(null);
  const copyLabel = copyStatus === "copied"
    ? "Code copied"
    : copyStatus === "error"
      ? "Copy failed"
      : "Copy code";

  async function copyCode() {
    const source = codeRef.current?.textContent?.replace(/\n$/, "") ?? "";
    try {
      await navigator.clipboard.writeText(source);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  }

  return (
    <div className="markdown-code-block">
      <div className="markdown-code-toolbar">
        <span className="markdown-code-language">{getLanguage(children)}</span>
        <button
          type="button"
          onClick={() => void copyCode()}
          aria-label={copyLabel}
          className="markdown-code-copy"
        >
          {copyStatus === "copied" ? <Check aria-hidden="true" />
            : copyStatus === "error" ? <TriangleAlert aria-hidden="true" />
              : <Copy aria-hidden="true" />}
          {copyStatus === "copied" ? "Copied" : copyStatus === "error" ? "Failed" : "Copy"}
        </button>
      </div>
      <pre ref={codeRef}>{children}</pre>
      <span className="sr-only" aria-live="polite">
        {copyStatus === "copied" ? "Code copied to clipboard"
          : copyStatus === "error" ? "Unable to copy code" : ""}
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Route rendered `<pre>` nodes through the component**

In `src/components/mdez/MarkdownReader.tsx`:

```tsx
import { MarkdownCodeBlock } from "@/components/mdez/MarkdownCodeBlock";

components={{
  ...headingComponents,
  pre: ({ children }: { children?: ReactNode }) => (
    <MarkdownCodeBlock>{children}</MarkdownCodeBlock>
  )
}}
```

Do not replace the `code` renderer; inline code must remain a normal `<code>` element and `rehype-highlight` must continue creating its highlighted spans.

- [ ] **Step 5: Add responsive code-block styling**

Append to `src/app/styles/markdown.css` immediately after the existing `pre code` rules:

```css
.markdown-preview .markdown-code-block {
  margin-block: 1rem;
  overflow: hidden;
  border-radius: 0.375rem;
  background: var(--color-ink);
}

.markdown-preview .markdown-code-toolbar {
  display: flex;
  min-height: 2.75rem;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid color-mix(in srgb, var(--color-paper) 18%, transparent);
  padding-inline: 0.75rem;
  color: var(--color-paper);
  font-family: var(--font-mono);
  font-size: 0.75rem;
}

.markdown-preview .markdown-code-language {
  overflow: hidden;
  font-weight: 750;
  opacity: 0.78;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.markdown-preview .markdown-code-copy {
  display: inline-flex;
  min-width: 2.75rem;
  min-height: 2.75rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  border: 0;
  border-radius: 0.25rem;
  background: transparent;
  padding-inline: 0.5rem;
  color: inherit;
  font: inherit;
  font-weight: 750;
  cursor: pointer;
}

.markdown-preview .markdown-code-copy:hover,
.markdown-preview .markdown-code-copy:focus-visible {
  background: color-mix(in srgb, var(--color-paper) 14%, transparent);
}

.markdown-preview .markdown-code-block pre {
  margin: 0;
  border-radius: 0;
}
```

Keep the existing `.markdown-preview pre { overflow-x: auto; }` rule; it is the source-code overflow boundary.

- [ ] **Step 6: Run code-block and shared-reader tests**

```powershell
npm test -- tests/unit/markdown-reader.test.tsx tests/unit/public-shared-page.test.tsx
```

Expected: language, copy success, copy failure, inline code, syntax highlighting, math, and public-reader tests all pass without console errors.

- [ ] **Step 7: Commit the code-block slice**

```powershell
git add src/components/mdez/MarkdownCodeBlock.tsx src/components/mdez/MarkdownReader.tsx src/app/styles/markdown.css tests/unit/markdown-reader.test.tsx
git commit -m "feat: enhance rendered markdown code blocks"
```

---

### Task 4: Build a Pure Markdown Formatting Edit Model

**Files:**
- Create: `src/lib/markdown-format.ts`
- Create: `tests/unit/markdown-format.test.ts`
- Modify: `src/components/mdez/EditorPane.tsx`

**Interfaces:**
- Produces: `MarkdownFormatAction`, `MarkdownFormatEdit`, and `createMarkdownFormatEdit(request)`.
- `EditorPane` supplies CodeMirror offsets, selected text, and the current line for heading actions.
- `EditorPane` dispatches the returned `{ from, to, insert, anchor }` without duplicating wrapper logic.

- [ ] **Step 1: Write failing formatter tests**

Create `tests/unit/markdown-format.test.ts` with hand-derived results:

````ts
import { describe, expect, it } from "vitest";

import { createMarkdownFormatEdit } from "@/lib/markdown-format";

describe("createMarkdownFormatEdit", () => {
  it("wraps selected text as inline code", () => {
    expect(createMarkdownFormatEdit({ action: "inlineCode", from: 4, to: 9, selected: "value" }))
      .toEqual({ from: 4, to: 9, insert: "`value`", anchor: 11 });
  });

  it("wraps selected text in a fenced code block", () => {
    expect(createMarkdownFormatEdit({ action: "codeBlock", from: 0, to: 16, selected: "const value = 1;" }))
      .toEqual({ from: 0, to: 16, insert: "\n```text\nconst value = 1;\n```\n", anchor: 30 });
  });

  it("uses inline math for a single-line selection", () => {
    expect(createMarkdownFormatEdit({ action: "math", from: 8, to: 13, selected: "x + y" }))
      .toEqual({ from: 8, to: 13, insert: "$x + y$", anchor: 15 });
  });

  it("uses display math for a multiline selection", () => {
    expect(createMarkdownFormatEdit({ action: "math", from: 0, to: 9, selected: "x + y\n= z" }))
      .toEqual({ from: 0, to: 9, insert: "\n$$\nx + y\n= z\n$$\n", anchor: 17 });
  });

  it("places the cursor inside an empty math template", () => {
    expect(createMarkdownFormatEdit({ action: "math", from: 3, to: 3, selected: "" }))
      .toEqual({ from: 3, to: 3, insert: "$formula$", anchor: 4 });
  });

  it("replaces an existing heading prefix on the whole line", () => {
    expect(createMarkdownFormatEdit({
      action: "h2",
      from: 5,
      to: 5,
      selected: "",
      line: { from: 0, to: 9, text: "### Title" }
    })).toEqual({ from: 0, to: 9, insert: "## Title", anchor: 8 });
  });
});
````

- [ ] **Step 2: Run the formatter tests and verify they fail**

```powershell
npm test -- tests/unit/markdown-format.test.ts
```

Expected: FAIL because `@/lib/markdown-format` does not exist.

- [ ] **Step 3: Implement the pure edit builder**

Create `src/lib/markdown-format.ts` with these public types:

````ts
export type MarkdownFormatAction =
  | "bold" | "italic" | "link" | "image"
  | "inlineCode" | "codeBlock" | "math"
  | "h1" | "h2" | "divider";

type MarkdownFormatRequest = {
  action: MarkdownFormatAction;
  from: number;
  to: number;
  selected: string;
  line?: { from: number; to: number; text: string };
};

export type MarkdownFormatEdit = {
  from: number;
  to: number;
  insert: string;
  anchor: number;
};
````

Implement `createMarkdownFormatEdit` with these branches:

````ts
export function createMarkdownFormatEdit(request: MarkdownFormatRequest): MarkdownFormatEdit {
  const { action, from, to, selected } = request;

  if (action === "h1" || action === "h2") {
    const line = request.line ?? { from, to, text: selected };
    const text = line.text.replace(/^#{1,6}\s+/, "");
    const insert = `${action === "h1" ? "#" : "##"} ${text}`;
    return { from: line.from, to: line.to, insert, anchor: line.from + insert.length };
  }

  if (action === "divider") {
    const insert = "\n---\n";
    return { from, to, insert, anchor: from + insert.length };
  }

  let before: string;
  let after: string;
  let fallback: string;

  if (action === "codeBlock") {
    before = "\n```text\n";
    after = "\n```\n";
    fallback = "code";
  } else if (action === "math" && selected.includes("\n")) {
    before = "\n$$\n";
    after = "\n$$\n";
    fallback = "formula";
  } else {
    const wrappers = {
      bold: { before: "**", after: "**", fallback: "bold text" },
      italic: { before: "_", after: "_", fallback: "italic text" },
      link: { before: "[", after: "](url)", fallback: "link text" },
      image: { before: "![", after: "](url)", fallback: "image description" },
      inlineCode: { before: "`", after: "`", fallback: "code" },
      math: { before: "$", after: "$", fallback: "formula" }
    }[action];
    before = wrappers.before;
    after = wrappers.after;
    fallback = wrappers.fallback;
  }

  const insert = before + (selected || fallback) + after;
  return {
    from,
    to,
    insert,
    anchor: selected ? from + insert.length : from + before.length
  };
}
````

- [ ] **Step 4: Run the formatter tests and verify they pass**

```powershell
npm test -- tests/unit/markdown-format.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 5: Delegate CodeMirror edits to the pure builder**

In `src/components/mdez/EditorPane.tsx`:

```tsx
import { createMarkdownFormatEdit } from "@/lib/markdown-format";

const line = action === "h1" || action === "h2"
  ? view.state.doc.lineAt(selection.from)
  : undefined;
const edit = createMarkdownFormatEdit({
  action,
  from: selection.from,
  to: selection.to,
  selected,
  line
});

view.dispatch({
  changes: { from: edit.from, to: edit.to, insert: edit.insert },
  selection: { anchor: edit.anchor }
});
view.focus();
```

Remove the old inline wrapper map from `EditorPane`; keep the existing `Mod-b`, `Mod-i`, and `Mod-k` keymaps pointing to the same action names.

- [ ] **Step 6: Run formatter and existing editor regression tests**

```powershell
npm test -- tests/unit/markdown-format.test.ts tests/unit/production-readiness.test.tsx
```

Expected: all tests pass.

- [ ] **Step 7: Commit the formatting model**

```powershell
git add src/lib/markdown-format.ts tests/unit/markdown-format.test.ts src/components/mdez/EditorPane.tsx
git commit -m "feat: add explicit markdown format edits"
```

---

### Task 5: Replace More With One Scrollable Formatting Row

**Files:**
- Modify: `src/components/mdez/EditorToolbar.tsx`
- Modify: `src/app/styles/workspace.css`
- Modify: `tests/unit/production-readiness.test.tsx`
- Modify: `tests/e2e/mdez.spec.ts`

**Interfaces:**
- Consumes: `MarkdownFormatAction` from Task 4.
- Produces: ten visible format buttons inside `.editor-format-actions` and no disclosure state.
- Preserves: `.editor-document-actions`, Quick Share, export controls, shortcut metadata, toolbar accessible name.

- [ ] **Step 1: Strengthen the toolbar component test before changing production code**

Replace the formatting portion of `keeps formatting and document actions working in EditorToolbar` in `tests/unit/production-readiness.test.tsx` with:

```tsx
const formattingActions = [
  "Bold", "Italic", "Insert link", "Insert image", "Inline code",
  "Code block", "Math", "Heading 1", "Heading 2", "Divider"
];

for (const action of formattingActions) {
  expect(screen.getByRole("button", { name: action })).toBeVisible();
}

expect(screen.queryByRole("button", { name: "More formatting" })).not.toBeInTheDocument();
fireEvent.click(screen.getByRole("button", { name: "Inline code" }));
expect(onFormat).toHaveBeenCalledWith("inlineCode");
```

Keep the existing Quick Share and Export assertions.

- [ ] **Step 2: Run the component test and verify it fails on hidden/missing actions**

```powershell
npm test -- tests/unit/production-readiness.test.tsx
```

Expected: FAIL because Insert image and the new explicit actions are not visible until More is opened.

- [ ] **Step 3: Flatten the toolbar configuration**

In `src/components/mdez/EditorToolbar.tsx`:

```tsx
import { Share2 } from "lucide-react";
import React, { type ReactNode } from "react";
import type { MarkdownFormatAction } from "@/lib/markdown-format";

export type FormatAction = MarkdownFormatAction;

const actions: FormatActionConfig[] = [
  { action: "bold", label: "Bold", glyph: "B", ariaKeyShortcuts: "Control+B Meta+B", shortcutLabel: "Ctrl/⌘ B" },
  { action: "italic", label: "Italic", glyph: "I", ariaKeyShortcuts: "Control+I Meta+I", shortcutLabel: "Ctrl/⌘ I" },
  { action: "link", label: "Insert link", glyph: "↗", ariaKeyShortcuts: "Control+K Meta+K", shortcutLabel: "Ctrl/⌘ K" },
  { action: "image", label: "Insert image", glyph: "▧" },
  { action: "inlineCode", label: "Inline code", glyph: "`" },
  { action: "codeBlock", label: "Code block", glyph: "</>" },
  { action: "math", label: "Math", glyph: "∑" },
  { action: "h1", label: "Heading 1", glyph: "H1" },
  { action: "h2", label: "Heading 2", glyph: "H2" },
  { action: "divider", label: "Divider", glyph: "---" }
];
```

Remove `MoreHorizontal`, `useState`, `primaryActions`, `secondaryActions`, the More button, and `editor-secondary-actions`. Render:

```tsx
<div role="toolbar" aria-label="Markdown toolbar" className="editor-toolbar">
  <div className="editor-format-actions">
    {actions.map((item) => (
      <FormatButton key={item.action} item={item} onFormat={onFormat} />
    ))}
  </div>
  <div className="editor-document-actions">
    {/* existing Quick Share and documentActions remain unchanged */}
  </div>
</div>
```

- [ ] **Step 4: Make the format strip a single overflow boundary**

In `src/app/styles/workspace.css`, remove `.editor-format-groups` and `.editor-secondary-actions`, then replace `.editor-format-actions` with:

```css
.editor-format-actions {
  display: flex;
  min-width: 0;
  flex-wrap: nowrap;
  gap: var(--space-1);
  overflow-x: auto;
  overflow-y: hidden;
  overscroll-behavior-inline: contain;
  scrollbar-width: thin;
}
```

Keep the existing mobile `.workspace-icon-button` 44px sizing and `.editor-toolbar` single-column media rule. Do not put `.editor-document-actions` inside the scroller.

- [ ] **Step 5: Run the toolbar component test and verify it passes**

```powershell
npm test -- tests/unit/production-readiness.test.tsx
```

Expected: all ten actions are visible, More is absent, and Quick Share/export remain callable.

- [ ] **Step 6: Update browser tests for the new contract**

In `tests/e2e/mdez.spec.ts`:

- Rename the old disclosure test to `editor exposes formatting in one row without a disclosure`.
- Assert all ten formatting buttons and Export `.md` are visible.
- Assert `More formatting` has count zero.
- Change the mobile `formatNames` list to all ten formatting labels.
- Change `formatScrolls` from `false` to `true` at the 390px viewport.
- Preserve `pageScrollWidth === pageClientWidth` and the assertion that document actions are below the formatting strip.

Add an integration test:

````ts
test("editor toolbar inserts inline math and fenced code", async ({ page }) => {
  await page.getByRole("button", { name: "Create page", exact: true }).last().click();
  const editor = page.locator(".cm-content");
  const toolbar = page.getByRole("toolbar", { name: "Markdown toolbar" });

  await editor.click();
  await editor.press("Control+A");
  await page.keyboard.insertText("x + y");
  await editor.press("Control+A");
  await toolbar.getByRole("button", { name: "Math" }).click();
  await expect(editor).toContainText("$x + y$");

  await editor.click();
  await editor.press("Control+A");
  await page.keyboard.insertText("const value = 1;");
  await editor.press("Control+A");
  await toolbar.getByRole("button", { name: "Code block" }).click();
  await expect(editor).toContainText("```text");
  await expect(editor).toContainText("const value = 1;");
});
````

- [ ] **Step 7: Run focused desktop and mobile browser checks**

```powershell
cmd /c npm run test:e2e -- tests/e2e/mdez.spec.ts -g "editor exposes formatting|editor toolbar inserts|mobile editor follows"
```

Expected: 6 checks pass across the `chromium` and `mobile` Playwright projects. The document has no horizontal overflow.

- [ ] **Step 8: Commit the one-row toolbar**

```powershell
git add src/components/mdez/EditorToolbar.tsx src/app/styles/workspace.css tests/unit/production-readiness.test.tsx tests/e2e/mdez.spec.ts
git commit -m "feat: flatten markdown formatting toolbar"
```

---

### Task 6: Verify the Complete Reader and Editor Experience

**Files:**
- Modify: `tests/e2e/mdez.spec.ts`
- Review: all files changed in Tasks 1-5.

**Interfaces:**
- Exercises the public user contract through paste import, Read mode, CodeMirror, and responsive layout.
- Produces no new runtime interface.

- [ ] **Step 1: Add the final reader integration test**

Append to `tests/e2e/mdez.spec.ts` near the existing reader typography test:

````ts
test("reader renders compatibility math and enhanced code blocks", async ({ page }) => {
  await page.getByRole("button", { name: "Import Markdown", exact: true }).last().click();
  await page.getByLabel("Paste Markdown").fill(
    "# Technical notes\n\n\\[\n\\frac{8!}{6!}=56\n\\]\n\n```ts\nconst value = 1;\n```"
  );
  await page.getByRole("button", { name: "Import pasted text", exact: true }).click();
  await page.getByRole("tab", { name: "Read" }).click();

  const preview = page.locator(".markdown-preview");
  await expect(preview.locator(".katex-display")).toBeVisible();
  await expect(preview.getByText("ts", { exact: true })).toBeVisible();
  await expect(preview.getByRole("button", { name: "Copy code" })).toBeVisible();
  await expect(preview.locator("pre code")).toContainText("const value = 1;");
});
````

- [ ] **Step 2: Run the focused reader test in both browser projects**

```powershell
cmd /c npm run test:e2e -- tests/e2e/mdez.spec.ts -g "reader renders compatibility"
```

Expected: 2 checks pass, one in `chromium` and one in `mobile`.

- [ ] **Step 3: Inspect the diff for scope and whitespace errors**

```powershell
git diff --check
git status --short
git diff --stat main...HEAD
git diff main...HEAD -- src/components/mdez src/lib src/app/styles tests
```

Expected: no whitespace errors; only the files named in this plan changed; no sidebar or data-layer files appear.

- [ ] **Step 4: Run lint and typecheck**

```powershell
npm run lint
npm run typecheck
```

Expected: both commands exit 0 with no ESLint errors or TypeScript diagnostics.

- [ ] **Step 5: Run the complete unit suite**

```powershell
npm test
```

Expected: every Vitest file passes with zero failures and no unhandled render errors.

- [ ] **Step 6: Run the production build**

```powershell
npm run build
```

Expected: Next.js compiles, generates route types, renders all static pages, and exits 0.

- [ ] **Step 7: Run the complete browser suite**

```powershell
cmd /c npm run test:e2e
```

Expected: every Playwright check passes in both configured projects with zero retries caused by this change.

- [ ] **Step 8: Request a read-only code review**

Use `superpowers:requesting-code-review` with:

```text
Description: LaTeX compatibility delimiters, enhanced copyable Markdown code blocks, pure Markdown format edits, and one-row responsive formatting toolbar.
Requirements: This plan plus docs/superpowers/specs/2026-08-12-markdown-math-rendering-design.md.
Base: main
Head: codex/markdown-rendering
```

Fix all Critical and Important findings using a new failing test before changing production behavior. Re-run the relevant focused checks after every fix.

- [ ] **Step 9: Run a fresh post-review verification**

```powershell
npm run lint
npm run typecheck
npm test
npm run build
cmd /c npm run test:e2e
git diff --check
```

Expected: every command exits 0 after review fixes.

- [ ] **Step 10: Commit final browser coverage or review corrections**

If Task 6 changed only E2E coverage:

```powershell
git add tests/e2e/mdez.spec.ts
git commit -m "test: cover enhanced markdown workflow"
```

If review corrections changed production files, stage only the exact reviewed files and use a message describing the behavior corrected. Do not squash or merge unless the user requests it.

---

## Acceptance Checklist

- [ ] `$...$` still renders inline KaTeX.
- [ ] `$$...$$` still renders display KaTeX.
- [ ] `\(...\)` renders inline KaTeX.
- [ ] `\[...\]` renders display KaTeX.
- [ ] Plain `[text]` stays ordinary text.
- [ ] Math-looking text inside inline, backtick-fenced, and tilde-fenced code stays code.
- [ ] Raw HTML remains suppressed in workspace and public readers.
- [ ] Highlighted fenced code shows a language label and Copy control.
- [ ] Copy writes exact source without the Markdown-added trailing newline.
- [ ] Clipboard success and failure are visible and announced.
- [ ] Long code and display math scroll inside the reader without widening the page.
- [ ] All ten formatting controls are visible in one ordered row.
- [ ] More formatting no longer exists.
- [ ] Inline code, fenced code, and math actions insert the correct Markdown and cursor position.
- [ ] Quick Share and export controls remain separate and usable.
- [ ] Mobile targets are at least 44px and the formatting strip scrolls without document overflow.
- [ ] Workspace preview and public shared pages render through the same implementation.
- [ ] No sidebar or persistence behavior changes are included.
- [ ] Lint, typecheck, full unit tests, production build, and full Playwright suite all pass after code review.
