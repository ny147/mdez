import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MarkdownReader } from "@/components/mdez/MarkdownReader";

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");

afterEach(() => {
  if (originalClipboard) {
    Object.defineProperty(navigator, "clipboard", originalClipboard);
  } else {
    Reflect.deleteProperty(navigator, "clipboard");
  }
});

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
    expect(screen.getByText("Code copied to clipboard")).toHaveAttribute("aria-live", "polite");
  });

  it("copies an empty fenced source exactly", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });

    render(<MarkdownReader title="Empty" markdown={"```text\n```"} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy code" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(""));
  });

  it("copies multiline fenced source exactly", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });

    render(<MarkdownReader title="Multiline" markdown={"```text\nfirst\nsecond\n```"} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy code" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("first\nsecond"));
  });

  it("preserves a source trailing blank line while removing the Markdown-added newline", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });

    render(<MarkdownReader title="Trailing blank" markdown={"```text\nfirst\n\n```"} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy code" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("first\n"));
  });

  it("reports when copying a code block fails", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("Clipboard unavailable")) }
    });

    render(<MarkdownReader title="Failure" markdown={"```text\ncopy me\n```"} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy code" }));
    expect(await screen.findByRole("button", { name: "Copy failed" })).toBeVisible();
    expect(screen.getByText("Unable to copy code")).toHaveAttribute("aria-live", "polite");
  });

  it("reports a missing Clipboard API through the failure announcement", async () => {
    Reflect.deleteProperty(navigator, "clipboard");

    render(<MarkdownReader title="No clipboard" markdown={"```text\ncopy me\n```"} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy code" }));

    expect(await screen.findByRole("button", { name: "Copy failed" })).toBeVisible();
    expect(screen.getByText("Unable to copy code")).toHaveAttribute("aria-live", "polite");
  });

  it("leaves inline code outside the enhanced fenced-code wrapper", () => {
    const { container } = render(
      <MarkdownReader title="Inline code" markdown="Use `const value = 1;` in prose." />
    );

    expect(container.querySelector(".markdown-code-block")).toBeNull();
    expect(container.querySelector("p > code")).toHaveTextContent("const value = 1;");
  });
});
