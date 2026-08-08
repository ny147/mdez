import React from "react";
import Link from "next/link";

import { RecoveryPage } from "@/components/mdez/RecoveryPage";

export default function NotFound() {
  return (
    <RecoveryPage
      title="This page is not in your Library"
      description="Your Markdown library remains available in this browser. Return to keep reading or writing locally."
      action={
        <Link href="/" className="primary-button inline-flex px-5 py-3">
          Return to Library
        </Link>
      }
    />
  );
}
