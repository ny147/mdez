import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import ErrorPage from "@/app/error";
import NotFound from "@/app/not-found";

describe("recovery pages", () => {
  it("keeps local-library reassurance and retries the failed view", () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error("failed")} reset={reset} />);

    expect(screen.getByRole("heading", { name: "Mdez could not open this view" })).toBeInTheDocument();
    expect(screen.getByText(/local library stays in this browser/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try opening Mdez again" }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it("returns a missing route to the Library", () => {
    render(<NotFound />);
    expect(screen.getByRole("heading", { name: "This page is not in your Library" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to Library" })).toHaveAttribute("href", "/");
  });
});
