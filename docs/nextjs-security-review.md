# Next.js security review

Checked on October 25, 2026 against the [maintainer advisories](https://github.com/vercel/next.js/security/advisories), the [October 14 security release](https://nextjs.org/blog/nextjs-security-update-october-14-2026), and npm's stable release tag.

The upgrade moves `next` and `eslint-config-next` from locked version **15.5.18** to **16.4.3**, the [latest stable release](https://github.com/vercel/next.js/releases/tag/v16.4.3) at review time. The lockfile also resolves Next.js's image dependency `sharp` to **0.35.5**.

## Latest security release

| Advisory | Severity | Trigger | Fixed releases |
| --- | --- | --- | --- |
| [CVE-2026-96889 / GHSA-2464-fhr4-w9xw](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw) | Critical | SVG processing in the Image Optimization API on glibc Linux can allow remote code execution. | Next.js 15.5.28 / 16.4.1; patched upstream dependency is sharp 0.35.5. |
| [GHSA-673q-mjm6-r5xr](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr) | Critical | App Router Cache Components functions returning multiple typed arrays can allow unauthenticated remote code execution. | Next.js 16.4.1. |
| [GHSA-p3m5-59mp-jv5r](https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r) | High | Crafted requests to an App Router application with Server Actions can exhaust CPU. | Next.js 15.5.28 / 16.4.1. |

The latter two advisories had no CVE ID assigned on their maintainer pages at review time. Mdez currently has no `use cache` or `use server` directives, and its mascot uses unoptimized PNG images. These observations describe current feature usage; they do not replace upgrading the framework.

## Compatibility and follow-up

- Migrate the preview sharing boundary from `src/middleware.ts` to Next.js 16's `src/proxy.ts`, retaining its matchers and responses. Existing unit and preview browser tests cover that boundary.
- Use Next.js 16's native flat ESLint configurations and generated TypeScript settings. New React Compiler diagnostics have file-specific exceptions for existing findings in state, refs, and memoization. Rules of Hooks and exhaustive dependency checks remain enabled. Refactoring those existing components and hooks is deferred.
- `npm audit` after the upgrade reports no advisory for `next`. It still reports **17 findings in other packages: 2 critical, 6 high, 5 moderate, and 4 low**. The critical findings are in the Vitest/Tinypool development toolchain. Other findings include transitive KaTeX, Vite, and build/test dependencies. They require a separate dependency review; no blanket `npm audit fix --force` was applied.
- `npm audit --omit=dev` reports **6 findings: 1 high, 1 moderate, and 4 low**, including `source-map-js`, `baseline-browser-mapping`, and the transitive KaTeX chain. The upgrade does not produce a clean overall dependency audit.

This review does not deploy the upgrade. Production receives the fixes only after the pull request is manually merged and the updated application is deployed.
