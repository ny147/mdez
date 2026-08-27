import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarkdownReader } from "@/components/mdez/MarkdownReader";

describe("MarkdownReader math rendering", () => {
  it("renders standard inline math with KaTeX", () => {
    const { container } = render(
      <MarkdownReader
        title="Factorials"
        markdown={"Value: $n! = n(n-1)\\cdots1$"}
      />
    );

    expect(container.querySelector(".katex")).toBeInTheDocument();
    expect(container.querySelector(".katex-display")).toBeNull();
  });

  it("renders standard display math with KaTeX", () => {
    const { container } = render(
      <MarkdownReader
        title="Fractions"
        markdown={"$$\n\\frac{8!}{6!}=56\n$$"}
      />
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
      <MarkdownReader
        title="Safety"
        markdown={"$n!$<script>alert(1)</script>"}
      />
    );

    expect(container.querySelector(".katex")).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
  });

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
});
