# Markdown Math Rendering Design

## Overview

Mdez currently renders GitHub-flavored Markdown and highlighted code, but it displays LaTeX formulas as plain text. Add standards-based math rendering to the shared `MarkdownReader` so formulas appear correctly in both the workspace preview and public shared pages.

## Goals

- Render inline math written as `$...$`.
- Render display math written as `$$...$$`.
- Support common LaTeX notation such as factorials, fractions, multiplication, and spacing commands.
- Apply the same rendering behavior to private previews and public shared pages.
- Keep long formulas readable on narrow screens.
- Preserve the current raw-HTML safety boundary.

## Non-Goals

- Do not interpret `[ ... ]` as math; square brackets retain their ordinary Markdown meaning.
- Do not add equation numbering, cross-references, macros, or an interactive formula editor.
- Do not change the CodeMirror editing experience beyond allowing users to type the standard delimiters.
- Do not render arbitrary raw HTML from Markdown.

## Syntax

Inline math uses single dollar delimiters:

```md
$n! = n(n-1)(n-2)\cdots 1,\qquad 0! = 1$
```

Display math uses double dollar delimiters on their own lines:

```md
$$
\frac{8!}{6!}
= \frac{8\times7\times6!}{6!}
= 8\times7
= 56
$$
```

Normal prose and Markdown links that use square brackets remain unchanged.

## Architecture

Extend the existing unified pipeline inside `MarkdownReader`:

```txt
Markdown source
  -> remark-gfm
  -> remark-math
  -> rehype-highlight
  -> rehype-katex
  -> React elements
```

`remark-math` recognizes inline and display math nodes. `rehype-katex` converts those nodes into accessible KaTeX markup without requiring client-side script execution. The existing `skipHtml` option remains enabled, so adding math support does not broaden the raw-HTML surface.

KaTeX's stylesheet will be loaded once from the application root layout. Math-specific presentation rules will remain scoped under `.markdown-preview` in the existing Markdown stylesheet.

## Rendering And Responsive Behavior

- Inline formulas flow with surrounding Thai or English prose.
- Display formulas receive vertical spacing and remain visually distinct from paragraphs.
- Display formulas may scroll horizontally within the reader when their intrinsic width exceeds the available space.
- Math inherits the reader's foreground color while KaTeX controls mathematical glyph metrics and layout.
- The implementation must not alter existing code-block highlighting or prose typography.

## Error Handling

Malformed or unsupported LaTeX must not crash the reader. Configure KaTeX with `throwOnError: false` so it renders a visible error representation during normal Markdown rendering. The surrounding document must remain usable.

## Security

- Continue using `react-markdown` with `skipHtml`.
- Do not enable KaTeX trust mode or user-defined HTML commands.
- Do not add `rehype-raw`.
- Public shared pages use the same `MarkdownReader`, so they inherit the same constrained rendering path.

## Testing Strategy

Component tests for `MarkdownReader` will verify that:

- `$...$` produces inline KaTeX output.
- `$$...$$` produces display KaTeX output.
- representative factorial and fraction notation renders without exposing raw LaTeX as ordinary prose.
- raw HTML remains disabled after math plugins are added.

A targeted browser check will verify formula readability and horizontal overflow behavior in the live preview at desktop and narrow viewport widths.

## Acceptance Criteria

- A Markdown document containing `$n! = n(n-1)\cdots1$` shows a typeset inline formula.
- A Markdown document containing a `$$...$$` fraction shows a typeset display formula.
- The result is consistent in the workspace preview and public shared page.
- Ordinary square-bracket text is not treated as math.
- Long display formulas do not widen or break the page layout.
- Existing Markdown features, code highlighting, and raw-HTML suppression continue to work.
