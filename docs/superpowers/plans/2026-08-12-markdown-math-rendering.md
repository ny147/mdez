# Markdown Math Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render standard `$...$` inline math and `$$...$$` display math in every Mdez Markdown reader surface.

**Architecture:** Extend the shared `MarkdownReader` unified pipeline with `remark-math` and `rehype-katex`, so workspace previews and public shared pages inherit one implementation. Load KaTeX CSS globally and scope responsive overflow styling to `.markdown-preview` while preserving `skipHtml`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, react-markdown, remark-math, rehype-katex, KaTeX, Vitest, Testing Library

## Global Constraints

- Use `$...$` for inline math and `$$...$$` for display math.
- Do not interpret `[ ... ]` as math.
- Keep `skipHtml` enabled and do not add `rehype-raw` or KaTeX trust mode.
- Configure KaTeX with `throwOnError: false`.
- Apply rendering to both workspace preview and public shared pages through `MarkdownReader`.
- Long display formulas must not widen or break the page layout.

---

### Task 1: Shared Markdown Math Rendering

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `tests/unit/markdown-reader.test.tsx`
- Modify: `src/components/mdez/MarkdownReader.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/styles/markdown.css`

**Interfaces:**
- Consumes: `MarkdownReaderProps` with `title: string`, `markdown: string`, and optional `showTableOfContents`.
- Produces: rendered KaTeX DOM with `.katex` for inline math and `.katex-display` for display math; no new public TypeScript API.

- [x] **Step 1: Add the math dependencies**

Run:

```powershell
npm install remark-math rehype-katex katex
```

Expected: `package.json` and `package-lock.json` include compatible versions of all three packages.

- [x] **Step 2: Write failing component tests**

Create `tests/unit/markdown-reader.test.tsx` with real `MarkdownReader` renders and assertions that:

```tsx
it("renders standard inline math with KaTeX", () => {
  const { container } = render(
    <MarkdownReader title="Factorials" markdown={"Value: $n! = n(n-1)\\cdots1$"} />
  );

  expect(container.querySelector(".katex")).toBeInTheDocument();
  expect(container.querySelector(".katex-display")).toBeNull();
});

it("renders standard display math with KaTeX", () => {
  const { container } = render(
    <MarkdownReader title="Fractions" markdown={"$$\\frac{8!}{6!}=56$$"} />
  );

  expect(container.querySelector(".katex-display")).toBeInTheDocument();
});

it("leaves square-bracket prose as ordinary text", () => {
  const { container } = render(
    <MarkdownReader title="Notes" markdown={"[n! = 120]"} />
  );

  expect(screen.getByText("[n! = 120]")).toBeVisible();
  expect(container.querySelector(".katex")).toBeNull();
});

it("continues to suppress raw HTML", () => {
  const { container } = render(
    <MarkdownReader title="Safety" markdown={"$n!$<script>alert(1)</script>"} />
  );

  expect(container.querySelector(".katex")).toBeInTheDocument();
  expect(container.querySelector("script")).toBeNull();
});
```

- [x] **Step 3: Run the tests and verify the math assertions fail**

Run:

```powershell
npm test -- tests/unit/markdown-reader.test.tsx
```

Expected: the inline and display tests fail because `.katex` and `.katex-display` do not exist; the square-bracket and raw-HTML safety assertions remain valid.

- [x] **Step 4: Implement the minimal math pipeline**

In `MarkdownReader.tsx`, import `remark-math` and `rehype-katex`, then configure:

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
```

In `src/app/layout.tsx`, import the KaTeX stylesheet once:

```tsx
import "katex/dist/katex.min.css";
```

In `src/app/styles/markdown.css`, add scoped display behavior:

```css
.markdown-preview .katex-display {
  margin-block: 1.25rem;
  overflow-x: auto;
  overflow-y: hidden;
  padding-block: 0.125rem;
}
```

- [x] **Step 5: Run focused tests and verify they pass**

Run:

```powershell
npm test -- tests/unit/markdown-reader.test.tsx tests/unit/public-shared-page.test.tsx
```

Expected: all targeted tests pass with no unhandled render errors.

- [x] **Step 6: Run project verification**

Run:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: every command exits with code 0.

- [x] **Step 7: Inspect the production diff and commit**

Run:

```powershell
git diff --check
git status --short
git diff -- package.json package-lock.json tests/unit/markdown-reader.test.tsx src/components/mdez/MarkdownReader.tsx src/app/layout.tsx src/app/styles/markdown.css
git add package.json package-lock.json tests/unit/markdown-reader.test.tsx src/components/mdez/MarkdownReader.tsx src/app/layout.tsx src/app/styles/markdown.css docs/superpowers/plans/2026-08-12-markdown-math-rendering.md
git commit -m "feat: render markdown math with katex"
```

Expected: the diff contains only the planned dependency, renderer, style, test, and plan changes; commit succeeds.
