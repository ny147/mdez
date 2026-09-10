# Prism Pages Brand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task in this session. Steps use checkbox (`- [x]`) syntax for tracking. Subagent execution is an alternative only if selected by the user.

**Goal:** Apply the approved Prism Pages identity, silhouette logo reveal, and faithful chibi redraws to the current Mdez workspace.

**Architecture:** Keep MdezWorkspace as the existing coordinator. Introduce a reusable static logo component with a separate client animation wrapper, replace the unused CSS mascot with local image assets, and update semantic theme tokens and Shelf presentation. Persistence and server behavior remain untouched.

**Tech Stack:** Existing Next.js 15, React 19, TypeScript, CSS custom properties, Vitest/Testing Library, and Playwright. No animation library or new font dependency.

**Spec:** `docs/superpowers/specs/2026-09-09-prism-pages-brand-design.md`

## Global Constraints

- Preserve workspace-scoped search/bookmarks/resume, keyboard shortcuts, local persistence, exports, and group isolation.
- No database migration, network protocol, storage schema, library projection, draft queue, or import/refresh semantic changes.
- At least 44px interactive targets, visible keyboard focus, and explicit accessible names.
- Normal text targets 4.5:1 contrast; large text 3:1.
- Keep the established 1024px desktop sidebar and 768px mobile navigation boundaries.
- The mascot is decorative. Full illustrations appear only on approved Shelf states; the compact brand symbol may appear in other view headers.
- Keep the book stationary; reveal the silhouette gently from behind it during the first 360ms, then reveal one sparkle and settle by 600ms.
- Reduced-motion users receive the settled mark immediately.
- Generated avatars, theme controls, slogans, and extra actions in reference boards are not product requirements.
- No deployment in this plan. Read applicable repository instructions and preserve unrelated working changes before execution. Use the worktree skill if isolation is needed, ensuring the approved uncommitted docs and references are carried into that checkout.

## Task 1: Production brand assets

**Files:**
- Read: `docs/design-assets/prism-pages/mascot-redraw-reference.png`, `combined-logo-storyboard.png`, `shelf-theme-concept.png`.
- Create: `public/brand/mascot-writing.png`, `public/brand/mascot-peeking.png`, `public/brand/prism-pages.svg`.
- Create: `public/brand/README.md` recording reference provenance, export dimensions, byte sizes, and alpha verification.

**Interfaces:** Later tasks use `/brand/mascot-writing.png` and `/brand/mascot-peeking.png`; the SVG is a reusable export of the combined static symbol. The writing reference's checkerboard is baked RGB, not transparency.

- [x] Use the image-generation skill to edit the approved writing redraw: remove the checkerboard, preserve the character, return genuine alpha, include the whole pen/book silhouette. Do not use the uncorrected concept as a production asset.
- [x] Generate the peeking pose in the same approved redraw style, using the original supplied peeking pose and the approved writing reference together. Keep lavender bob, pink/cyan ends, book clip, white cape, and pink/cyan book. Request transparent background and no text.
- [x] Inspect both returned files using image viewing and an alpha-capable image inspector. Confirm transparent corners and partially transparent edge pixels, then inspect on white and lavender. If a generated output remains opaque, retry the editing step; do not relabel RGB as transparent.
- [x] Export at about twice display size, targeting 200KB per image; measure quality and actual bytes. Native resize/export tools are allowed; visual background editing uses imagegen. Keep full reference images in docs and optimized deliverables in public.
- [x] Author the combined logo as flat SVG using the approved storyboard as geometry reference: three book planes, compact bob silhouette behind the book, book-clip negative space, and one sparkle. Define separate named groups for `mascot`, `book`, and `sparkle`; ensure the book paints over the mascot. Use a fixed viewBox shared by component and export, avoiding external SVG resources.
- [x] Inspect logo at 16/24/32/128px. The 16px variant omits silhouette/sparkle; 32px includes a legible silhouette. Record measurements in the asset README. No tests asserting individual vector paths.

## Task 2: Accessible logo and once-per-session motion

**Files:**
- Create: `src/components/mdez/BrandLogo.tsx`, `src/components/mdez/AnimatedBrandLogo.tsx`.
- Modify: `src/components/mdez/MdezWorkspace.tsx`, `src/app/styles/workspace.css`.
- Create: `tests/unit/animated-brand-logo.test.tsx`.

**Interfaces:**

```tsx
type BrandLogoProps = {
  showWordmark?: boolean;
  className?: string;
};
// BrandLogo renders one accessible name, "Mdez", with decorative inner SVG.
// Its default state is fully visible. It has no client-only hooks.
// AnimatedBrandLogo accepts the same props and wraps BrandLogo.
```

- [x] Add a test for remounting without replay, using controlled matchMedia/sessionStorage mocks and React StrictMode. Include reduced-motion and storage-denied cases. Example behavioral assertion:

```tsx
const first = render(<AnimatedBrandLogo />);
expect(screen.getByRole('img', { name: 'Mdez' })).toBeVisible();
expect(first.container.firstElementChild).toHaveAttribute('data-reveal', 'true');
first.unmount();
const second = render(<AnimatedBrandLogo />);
expect(second.container.firstElementChild).toHaveAttribute('data-reveal', 'false');
```

- [x] Run `npx vitest run tests/unit/animated-brand-logo.test.tsx`; expect failure before the component exists.
- [x] Implement the static logo with lowercase Manrope wordmark and an accessible outer `role="img" aria-label="Mdez"`. Hide the inner SVG and wordmark from duplicate accessibility announcements. Keep the wordmark visible if SVG is unavailable.
- [x] Implement the client wrapper with default static markup and an effect that opts into animation once. Use sessionStorage key `mdez-brand-reveal-v1` and a per-instance ref to prevent StrictMode's repeated effect setup from changing the first decision. Set the session flag when considering the first reveal, including reduced-motion visits. Catch storage access failures and keep the static mark; no persistence error notification for decoration. A browser tab session is the concrete meaning of application session, so reload does not replay.
- [x] Add CSS using mascot translation/opacity and sparkle scale/opacity only, not container size. The final mark is the default; `data-reveal="true"` opts in. Use 360ms mascot and delayed sparkle finishing at 600ms. Under `prefers-reduced-motion: reduce`, disable both animations and force final transforms/opacity. Do not add animation to saving or loading events.
- [x] Replace only the existing workspace wordmark with AnimatedBrandLogo. Keep the independent sidebar toggle and its accessibility attributes.
- [x] Rerun focused tests. Inspect no replay on view changes and reload, final static state under reduced motion, and no logo-induced layout shift. A failed asset must not affect navigation.

## Task 3: Shelf illustrations and first-use behavior

**Files:**
- Modify: `src/components/mdez/Mascot.tsx`, `src/components/mdez/ShelfPane.tsx`, `src/app/styles/workspace.css`.
- Extend: `tests/unit/library-view-ui.test.tsx`.

**Interfaces:**

```tsx
type MascotProps = {
  pose: 'writing' | 'peeking';
  className?: string;
};
// Mascot: decorative local image with empty alt and actual export dimensions.
```

- [x] Extend the existing ShelfPane fixture in the unit test. Assert a single welcome heading for ready, root, All, empty library; assert no welcome while loading, querying, filtering, inside an empty book, or when any folder/document exists. Preserve the existing metadata-error and Create page checks. Use rerender to exercise loading -> ready and empty -> populated transitions.
- [x] Run `npx vitest run tests/unit/library-view-ui.test.tsx`; confirm new welcome assertions fail.
- [x] Replace the CSS mascot with the local pose image component. Keep fixed intrinsic dimensions, CSS-scaled width, empty alt, no focus target, and no click behavior. An image failure hides artwork while retaining its reserved layout space.
- [x] Add this derived condition directly in ShelfPane, without new persistence or projection code:

```tsx
const isFirstUse = isReady && !query.trim() && filter === 'all'
  && selectedFolderId === null && folders.length === 0
  && documents.length === 0;
```

- [x] For isFirstUse, render the peeking mascot and exact copy from the spec. Keep the top action row. Add `!isFirstUse` to both existing books and pages section conditions, suppressing only redundant empty panels. Keep metadata errors visible.
- [x] Replace resume CSS book spans with the writing mascot. Search suppresses resume as before. Add one peeking image to no-search-results or empty-bookmarks panels; contextual empty books keep their functional copy.
- [x] Reserve about 208px desktop art column and 184px minimum resume height; clamp art to 160–192px. Below 768px use 96px; below 430px hide resume art. Keep first-use art above text at 112px on mobile. Preserve title truncation/full title access and real button labels.
- [x] Run the focused test file again; expect all assertions to pass. Check no duplicate mascot on any one Shelf view and no illustration in CodeMirror or MarkdownReader.

## Task 4: Semantic palette and identity across routes

**Files:**
- Modify: `src/app/styles/tokens.css`, `src/app/styles/workspace.css`, `src/components/mdez/BookCover.tsx` if decorative geometry needs adjustment.
- Modify: `src/components/mdez/PublicSharedPage.tsx`, `src/components/mdez/RecoveryPage.tsx`.
- Modify: `src/app/icon.svg`, `src/app/metadata.ts`, `src/app/manifest.ts`.
- Create: `public/brand/apple-touch-icon.png`, `public/brand/icon-192.png`, `public/brand/icon-512.png`.
- Extend if needed: `tests/unit/production-readiness.test.tsx`.

**Interfaces:** Reuse BrandLogo statically outside the main workspace. Preserve all existing semantic custom-property names and stable getCoverVariant IDs.

- [x] Set base semantic tokens to the approved table, including canvas `#FBFAFE`, panel `#F2EEFA`, ink `#211A3D`, muted `#6C627D`, Edit `#6845AC`, hover `#563691`, Shelf `#A63771`, Read `#086C82`, and rule `#E4DDEC`. Add named brand pink/lavender/cyan tokens for decorative art.
- [x] Map the four existing cover variants to lavender/pink/cyan/blue with readable dark cover text. Preserve the stable ID hash and book semantics. Do not recolor warning/error/success tokens as decorative accents. Check and adjust derived selected/hover/search/resume tokens against actual backgrounds for contrast.
- [x] Keep existing typefaces, layout boundaries, and action labels. Keep buttons solid action violet with white text; ensure focus rings remain distinguishable. Retain content-white editor and reader surfaces.
- [x] Replace existing textual brand locations on recovery and public-share pages with static BrandLogo. Keep snapshot description, expiry, read-only status, error text, and recovery actions intact. Do not imply shared snapshots are browser-only.
- [x] Use the simplified book-only SVG favicon. Rasterize the combined icon for 180/192/512px files using an SVG-capable renderer available in the runtime; inspect edges and safe padding. Register Apple icon through metadata and PNG icons through manifest. Keep SVG icon registration and accurate app description. Do not declare maskable without validating its safe zone.
- [x] Set manifest background/theme colors to canvas/action violet. Extend metadata test to verify new icon references resolve, while keeping existing application name, start URL, display, and description assertions.
- [x] Run `npx vitest run tests/unit/production-readiness.test.tsx tests/unit/recovery-pages.test.tsx tests/unit/public-shared-page.test.tsx` and inspect contrast pairs. No new color snapshot tests.

## Task 5: Integration verification and handoff

**Files:**
- Extend if necessary: `tests/e2e/mdez.spec.ts` for reduced-motion/no-replay and first-use transitions.
- Update after verification: `design.md`, asset README, and this plan's checkboxes.

- [x] Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. Inspect each result; historical results are not evidence for these changes.
- [x] Run `npm run test:e2e` with the existing configured server and both projects. Preserve tests for local save/reload, search/bookmark/resume isolation, long unsaved drafts, import, GitHub refresh, Markdown/ZIP export, groups, and Quick Share.
- [ ] Remaining release check: actual 200% browser zoom. Completed batched visual inspection at 390, 430, 768, 1024, and 1440px. Include populated, first-use, search/no-results, empty bookmarks/book, Edit/Read/Split, shared-page and recovery states. Use representative multilingual and long titles. Check horizontal overflow, 44px targets, focus-managed drawer, clear image edges, image-failure layout, and actual byte sizes.
- [x] Verify the logo animates once in a fresh tab session, remains still on mode changes and reload, and is static when reduced motion is enabled. Verify denied sessionStorage does not break rendering. Record any environment limits precisely.
- [x] Run the Impeccable mechanical detector once on changed UI files using `node C:/Users/Neary/.agents/skills/impeccable/scripts/detect.mjs --json` followed by the actual changed UI paths. Review design findings in the context of the pinned palette and approved references.
- [x] Fix observed issues in one batch and perform at most one confirmation visual pass, unless unresolved material defects justify more work. Re-run only checks affected by fixes.
- [x] Update design.md to describe the delivered system and actual checks. Keep the old architecture guarantees and identify any unresolved asset or browser limitations. Record user approval and implemented behavior separately from mockups.
- [x] Review `git diff --check`, changed-file scope, and asset sizes. Present the working preview, concise change summary, and actual verification results. Do not deploy or silently stage unrelated changes.

## Plan self-review

Coverage: Task 1 owns asset identity/alpha/performance; Task 2 owns logo accessibility/session motion; Task 3 owns first-use and all mascot placements; Task 4 owns tokens/icons/shared/recovery branding; Task 5 owns regression, responsive, accessibility, and documentation checks. Existing data flow stays unchanged. No new accounts, assistant, theme toggle, or marketing page are introduced.

