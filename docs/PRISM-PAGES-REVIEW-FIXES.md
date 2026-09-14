# Prism Pages review fixes

Implemented on `codex/prism-pages-brand` from reviewed commit `1df8100` on 2026-09-14. This report records implementation and verification only; it does not authorize merging, deployment, or production migrations.

## Finding coverage

| Finding | Fix | Regression evidence |
| --- | --- | --- |
| 1. Selected page pinned virtual scrolling | `dbc9e62` separates scroll-derived virtualization from sequenced page reveal and retains isolated interactive rows. | `library-virtual-window.test.ts`; the large-library Playwright case manually scrolls to Page 500 while Page 0 remains selected, then explicitly reveals Page 999. |
| 2. Unsorted opened My library | `20772a2` makes Unsorted a distinct filter/selection and removes nested-book content from a selected flat book. | `library-view-ui.test.tsx`, `sidebar-library.test.tsx`, and flat-library browser coverage. |
| 3. Refresh omitted local collision names | `174d18b` reserves every folder not owned by the refreshed source. | `repository.test.ts` covers local and imported collision reservations across refresh. |
| 4. Shared deletion lock inversion | `1ac89e9` acquires the group revision lock before folder/page locks. | `key-group-mutations.test.ts` verifies query order; `key-group-concurrency.test.ts` is the live-database regression. |
| 5. Generated imports exceeded 300 characters | `a045c54` allocates suffix-aware names by Unicode code point and applies the shared 300-character limit. | `library-tree.test.ts` and `key-group-flat-books.test.ts`. |
| 6. Migration renamed top-level duplicates | `a045c54` reserves roots unchanged and allocates names only for nested rows in JavaScript and SQL. | Unit fixtures cover duplicate roots, collisions, cycles, missing parents, stable ordering, and long names; the PostgreSQL integration fixture covers SQL roots and generated names. |
| 7. Flat-book Shelf advertised nesting | `20772a2` renders a selected book's pages without a nested-book section. | `library-view-ui.test.tsx`. |
| 8. Escape closed two layers | `e2c649b` consumes Escape in the active Library layer and makes the drawer handler respect handled events. | `sidebar-library.test.tsx` verifies dismissal and restored focus. |

## Sidebar usability follow-ups

`d45fb7c` keeps the Library heading and Create book action outside the single scrolling region, protects full-width names beside 44px controls, and introduces a searchable, focus-trapped move dialog with an explicit destination and submit action. The current book is excluded; hidden filtered selections are cleared; rejected moves preserve the dialog and source state.

The follow-up virtualized-menu race fix defers focus retention until the pointer activation sequence completes. Its large-library browser regression passed five concurrent repetitions. The existing tablet Split test now waits for asynchronous page creation before changing modes and also passed five concurrent repetitions.

## Verification evidence

- Focused virtual-window, sidebar, and move-dialog unit tests: 3 files / 14 tests passed.
- Virtualized large-library Playwright stress run: 5/5 passed with five workers.
- Tablet Split Playwright stress run: 5/5 passed with five workers.
- `npm test`: 49 files / 323 tests passed.
- `npm run lint`: passed with zero warnings.
- `npm run typecheck`: Next.js route generation and TypeScript checking passed.
- `npm run build`: optimized Next.js production build passed.
- `npm run test:e2e`: 170/170 tests passed across Chromium desktop and mobile projects.
- Impeccable mechanical detector: zero findings on changed interface markup.
- Responsive browser coverage exercises desktop and mobile projects plus 390, 430, 768, 1024, and 1440 CSS-pixel viewports.

## Open verification gates

- `npm run test:postgres` reached its environment guard and requires `MDEZ_TEST_DATABASE_URL` for a disposable database whose name ends in `_test`. No such URL was available in this session, so both integration files were skipped and live migration and lock-concurrency behavior remain **unverified**, not passed.
- Repository history shows the flat-books migration first appearing in reviewed commit `1df8100`, but production migration history and backups were not accessible. Confirm that the migration has never run before deploying the edited migration in place; otherwise use a forward migration based on verified historical data.
- The prior brand review recorded a real Chromium 200% zoom pass on 2026-09-11. This review-fix session did not repeat the manual browser-zoom inspection, so that check remains pending for the changed sidebar and move dialog.

Because these gates remain open, this branch is not yet declared merge-ready.
