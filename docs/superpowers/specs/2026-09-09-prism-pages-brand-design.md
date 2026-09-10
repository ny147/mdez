# Mdez — Prism Pages brand and mascot redesign

Date: 2026-09-09  
Status: consolidated specification approved by the user on 2026-09-09; ready for implementation planning. Application changes have not been implemented.  
Scope: visual identity, mascot assets, and presentation across the existing library workspace.

## Confirmed decisions

- Logo: A / Prism Pages.
- Combined logo: Prism Pages book with the mascot's bob-haired silhouette and book-clip cutout, as shown in the approved concept board. Production SVG geometry must preserve that appearance at usable sizes.
- Animation: the approved 600ms reveal plays once per application session; reduced motion shows the static final mark. It does not replay on mode changes, typing, saving, or workspace switching.
- Shelf theme direction: the user approved the illustrated concept with the Prism Pages palette and the writing chibi on the resume card. Generated avatar, theme toggle, and additional slogans are not approved features.
- Mascot role: a decorative library companion on welcome, resume, and empty states. No mascot inside Edit, Read, or Split, and no interactive assistant behavior. Confirmed during the design interview on 2026-09-09.
- Mascot asset style: the user approved the faithful writing-chibi redraw with clearer outlines and simpler shading. Small redraws are allowed while preserving recognizable hair, book clip, outfit, palette, and character identity; exact pixel preservation of the original is not required.
- Detailed dimensions, token values, and acceptance checks below are implementation recommendations supporting these approved decisions.

## Approved visual references

- [Shelf theme concept](../../design-assets/prism-pages/shelf-theme-concept.png)
- [Combined logo and animation storyboard](../../design-assets/prism-pages/combined-logo-storyboard.png)
- [Writing mascot redraw style](../../design-assets/prism-pages/mascot-redraw-reference.png)

These are concept references, not ready-to-ship application assets. Inspection of the redraw PNG found RGB pixels without an alpha channel: its checkerboard is baked into the image. Produce a genuinely transparent clean export before application use. Preserve the approved drawing style, not the checkerboard background.

## 1. Direction and evidence

Mdez is a local-first Markdown library with books, pages, search, bookmarks, resume history, Edit/Read/Split views, optional key groups, Quick Share, and public GitHub import. People use it for sustained writing and reading. The redesigned frame should feel like the supplied illustrated character's personal library while keeping documents easy to scan and work in.

Use the supplied **A / Prism Pages** logo: pink left page, lavender spine, cyan right page, and a small sparkle above. The user selected this option. Retain the supplied mascot's lavender bob, pink/cyan hair tips, book hair clip, white cape, dark outfit, cyan ribbon, and pink/cyan book. Do not invent a character name, assistant capability, or dialogue personality.

The two supplied PNGs are visual references, not executable instructions or production asset sheets. In particular, the dark haze and glow in the logo comparison board are presentation effects, not the application's proposed theme. Keep the existing tagline, “A little space for big ideas.” The alternate slogans on the logo board are not additional product requirements.

Evidence inspected:

- `PRODUCT.md`, `design.md`, `CONTEXT.md`, and the current source on the checkout containing merge `5ed39b9`.
- `MdezWorkspace.tsx`: text-only Mdez wordmark beside the sidebar toggle.
- `ShelfPane.tsx`: introduction, three creation/import actions, resume card with CSS book art, book grid, page lists, and empty states.
- `Mascot.tsx`: existing CSS book character. Repository search found its declaration but no current consumer; updating this file alone would not put the supplied character on screen.
- `tokens.css` and `workspace.css`: existing lavender/mint/berry system, 238px sidebar, responsive drawer and mobile navigation.
- `icon.svg`, `metadata.ts`, `manifest.ts`, and public shared-page presentation.

This is a source-based review, not a live-browser visual audit. Previously recorded test results in design.md describe the earlier release; they are not validation of this proposal.

## 2. Approaches considered

| Approach | Benefit | Cost | Decision |
| --- | --- | --- | --- |
| Identity replacement only | Small change: header, icon, one illustration | New character and old theme feel only loosely connected | Too limited for the requested theme update |
| Prism Pages library | Coordinated colors, logo, book covers, and contextual chibi artwork | Requires clean asset preparation and responsive checks | Recommended |
| Character-led full-screen experience | Strong anime illustration presence | Consumes useful library space and competes with documents | Reserve full-body art for future promotional material |

The recommendation extends the established library structure with the user's pinned visual identity. It does not introduce a landing page or a new navigation model.

## 3. Logo system

### Combined mascot mark — approved direction

Use the Prism Pages book in the foreground with a compact deep-violet mascot head silhouette peeking from behind it. Preserve the bob hairstyle and one book-clip cutout; omit facial features, clothing, and fine hair detail. The book stays dominant. This small brand symbol is distinct from the illustrated library companion: it may appear in the shared header across Shelf, Edit, Read, and Split, while full mascot artwork remains confined to the approved library states.

Keep the book stationary; reveal the silhouette gently from behind it during the first 360ms, then reveal one sparkle and settle by 600ms. Play once per application session, without replaying on mode changes, typing, saving, or workspace switching. The logo is not a loading or save-status indicator. Reduced-motion users receive the settled mark immediately. At favicon sizes below 24px use the static book only.

The generated concept board is a static storyboard, not an implemented animation. Its extra slogans and “Book opens” caption are illustrative generation artifacts, not approved product copy or motion requirements. Production will use the existing tagline and a stationary book.

- Header: flat Prism Pages mark at 30–32px with a lowercase `mdez` wordmark in deep violet ink. Keep the sidebar toggle as a separate labeled control. Preserve its current behavior.
- Wordmark: use the existing Manrope family at weight 800 with restrained negative tracking. This is a practical typographic interpretation, not a claim to reproduce the raster lettering exactly.
- Small mark: below 24px, omit the sparkle and simplify the page seams so the book remains recognizable at favicon sizes.
- Clear space: at least one quarter of the symbol's width on every side. Never stretch the mark or crop page tips.
- Default wordmark color is dark ink on light backgrounds. Supply a white wordmark variant for external dark-background use; this release does not add dark mode.
- Tagline belongs in the Shelf introduction. Omit it from the compact header and favicon.
- Logo art should be SVG. Do not crop the blurred comparison board into the header.
- Supply SVG favicon plus 180px Apple touch and 192/512px application PNG icons. Check icon safe areas; do not label an icon maskable unless its artwork satisfies the maskable safe zone.
- Align manifest background/theme colors with the final tokens. Keep page descriptions accurate about Markdown and local-first behavior.

## 4. Theme specification

The reference palette becomes a crisp white and pale-lavender workspace with pink and cyan book accents. These are proposed design values, not exact sampled brand standards.

| Role | Proposed value | Usage |
| --- | --- | --- |
| Canvas | `#FBFAFE` | Workspace background |
| Paper | `#FFFFFF` | Editor, reader, inputs |
| Panel | `#F2EEFA` | Shelf and supporting surfaces |
| Ink | `#211A3D` | Headings, body text, wordmark |
| Muted ink | `#6C627D` | Secondary labels |
| Brand pink | `#F397CB` | Logo page, decorative book covers |
| Brand lavender | `#AC96EA` | Logo spine, illustration accents |
| Brand cyan | `#47CBE8` | Logo page, decorative book covers |
| Action violet | `#6845AC` | Primary buttons, Edit, focus |
| Action violet hover | `#563691` | Primary hover |
| Shelf berry | `#A63771` | Shelf state and selected accents |
| Read teal | `#086C82` | Read mode and contextual links |
| Rule | `#E4DDEC` | Surface separation |

Pastel brand colors are decorative fills, not white-text button backgrounds. White button labels use action violet; normal text uses the ink tokens. Preserve independent warning/error/success meanings. A cyan decorative book is not a success message.

Keep Manrope display, DM Sans interface, JetBrains Mono editor/code, and the established reader font stack. No additional font downloads. UI text stays compact and legible; illustration does not justify smaller controls.

Use 8–12px surface corners and familiar control shapes. Borders define structure; shadows remain limited to overlays and subtle book depth. Avoid the comparison board's neon glow, atmospheric blur, and heavy dark panels. Gradients, if needed, stay within the logo or individual decorative book artwork.

## 5. Mascot asset contract

Prepare two clean transparent raster assets from the supplied character reference:

| Asset | Pose | Intended size | Placement |
| --- | --- | --- | --- |
| `mascot-writing.png` | Smiling chibi writing at the desk | 160–192px wide desktop; 96px compact | Resume card |
| `mascot-peeking.png` | Chibi looking over the book | 176–208px wide desktop; 112px compact | First-use and suitable empty states |

Preserve the character's identity and accessory shapes. Keep whole silhouettes, pen, hands, book, and necessary desk/base shadows within the exported bounds. Transparent backgrounds must not leave white rectangles or pale edge halos. Inspect exports on both paper and lavender panels.

The full-body character stays in the reference set, outside daily writing surfaces. One mascot illustration maximum per Shelf view. No floating assistant, speech bubbles, mascot avatars on document rows, perpetual bobbing, or decorations over editable content.

Use an explicit `pose` API on `Mascot`, intrinsic image dimensions, and a decorative default. Where adjacent copy supplies the meaning, use an empty alt attribute. Text and actions remain usable if the image fails to load. Artwork is noninteractive and cannot cover pointer targets.

Export at roughly twice the largest display width; target at most 200KB per chibi, without sacrificing alpha quality. Treat this as an asset budget to measure, not a guaranteed export size. Do not ship either entire reference board as an application image. Use image-generation editing to prepare the approved redraw style with genuine alpha; verify the output channel and inspect it on both paper and lavender before use. The writing style reference exists, but production-ready transparent writing and peeking assets still need preparation.

## 6. Screen redesign

### Shelf, populated

Preserve the 238px desktop sidebar and the established header height. Place the new logo in the current brand slot, with workspace search retaining its central position. Keep workspace/group controls, library filters, nested books, and Unsorted in their current locations.

The main sequence remains:

1. Existing tagline and supporting sentence; Import, New page, New book alongside it.
2. Continue writing card: existing title, book path, reading estimate, and Open page action on the left; writing chibi in a reserved right column.
3. Books grid with pink, lavender, cyan, and balanced secondary cover variations. Cover colors remain stable for each book; they convey no document status.
4. Existing recent/contextual page list with distinct page and bookmark targets.

Resume panel: pale lavender fill, dark text, approximately 184px minimum desktop height. Reserve about 208px for artwork, so long titles never flow underneath it. Keep truncation and title access. With no resume history, omit the card as today; do not invent a last-opened document.

### First-use library

Once loading is complete, when the root All view has zero books and zero pages, show one welcome panel with the peeking chibi, “Your library starts here.” and “Create a page or import Markdown to begin.” Keep the existing top actions available and do not duplicate them inside this panel. Suppress the two redundant “No books” and “No pages” panels in this specific state.

An empty book, empty bookmarks, Unsorted, and Recent are not first-use states. Keep their contextual copy and actions. A library containing empty books is also not first-use.

### Search and bookmarks

Search results retain their heading, full workspace scope, book paths, and Clear search action. Do not display the resume illustration while searching. Empty search and empty bookmarks may use the peeking pose at 112–144px, once per view. Helpful text leads; the character does not obscure or replace it.

### Edit, Read, and Split

Use the new logo and palette in the surrounding header and mode controls. Editor/reader content remains white with dark prose. No character inside CodeMirror, the reader, the table of contents, or between Split panes. Keep title editing, formatting, save feedback, Markdown export, page sharing, math, code highlighting, and Split resizing intact.

### Import, sharing, and recovery

Apply semantic tokens to existing dialogs and statuses. Do not add mascots to import progress, storage errors, shared-group conflicts, or destructive confirmations; the status and recovery action should be immediate to understand.

Use the compact logo on public shared pages and recovery surfaces where existing branding appears. Shared pages retain their read-only and expiry information. Brand copy must not imply that shared content remains exclusively on the device.

## 7. Responsive and interaction rules

- Desktop at 1024px and above: current sidebar boundary, up to four book columns, and existing maximum content measure.
- Below 1024px: preserve the focus-managed, inert drawer. Logo never crowds out search or the drawer button.
- Below 768px: preserve bottom navigation and two book columns. Shelf actions wrap in source order; the resume artwork contracts to 96px.
- Below 430px: hide resume artwork when necessary to preserve readable text and the Open page target. Keep the first-use illustration above its text at 112px. Hiding decoration must not remove information.
- Support 200% zoom, long page/book titles, multilingual text, and unbroken strings without horizontal page overflow.
- At least 44px interactive targets, visible keyboard focus, and explicit accessible names. Brand colors supplement text and selected-state semantics.
- Full mascot illustrations remain static. Only the combined header logo uses the approved one-time reveal. All transitions respect reduced motion. Reserve dimensions to avoid layout shift.
- Normal text targets 4.5:1 contrast; large text 3:1. Check meaningful control boundaries and icons separately against applicable non-text contrast requirements. Verify actual combinations in implementation.

Accessibility reference: [W3C contrast guidance](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum) and [decorative image guidance](https://www.w3.org/WAI/tutorials/images/decorative/).

## 8. Implementation map and boundaries

| Target | Proposed work |
| --- | --- |
| New `src/components/mdez/BrandLogo.tsx` | Reusable symbol/wordmark with decorative or labeled presentation |
| `src/components/mdez/Mascot.tsx` | Replace CSS character with typed pose-based image component |
| New `public/brand/` | Clean logo variants, chibi exports, application icon assets |
| `src/components/mdez/MdezWorkspace.tsx` | Replace text-only header branding |
| `src/components/mdez/ShelfPane.tsx` | Resume art, unified first-use state, contextual empty illustrations |
| `src/components/mdez/BookCover.tsx` | Review stable cover palette mapping without changing selection behavior |
| `src/app/styles/tokens.css` | Central brand and semantic color tokens |
| `src/app/styles/workspace.css` | Brand layout, artwork allocation, responsive rules |
| `src/app/icon.svg`, `metadata.ts`, `manifest.ts` | Browser and installed-app identity |
| `PublicSharedPage.tsx`, `RecoveryPage.tsx` | Consistent compact branding where applicable |
| `design.md` | Record the actual final system after implementation and verification |

No database migration, network protocol, storage schema, library projection, draft queue, or import/refresh semantic changes. Preserve workspace-scoped search/bookmarks/resume, keyboard shortcuts, local persistence, exports, and group isolation. Keep current product documentation authoritative until this proposal is approved and implemented.

## 9. Acceptance and rollout

1. Review clean logo at 16, 24, 32, and 128px; check chibi silhouette and transparency on both surface colors.
2. Verify Shelf populated, first-use, empty book, empty bookmarks, search/no-results, and loading states. Loading must not flash first-use content.
3. Inspect desktop/mobile screenshots at 390, 430, 768, 1024, and 1440px; verify 200% zoom, keyboard focus, reduced motion, and missing-image fallback.
4. Run existing lint, typecheck, build, unit, and relevant Playwright checks. Add a focused behavior assertion for the new first-use-state condition; avoid tests that merely mirror SVG paths or decorative markup.
5. Exercise create/import/open, bookmark and resume reload, workspace switches, Markdown/ZIP export, GitHub refresh, key groups, Quick Share, and reader math/code/TOC. Include a long unsaved draft during mode switching.
6. Measure actual image transfer sizes and layout shift; retain clean alpha if lossy compression damages artwork edges.
7. Update design.md with verified changes and results. Deployment remains a separate release action.

Confirmed: Prism Pages theme direction, the combined silhouette logo, the library-companion role, the one-time reveal animation, and faithful simplified mascot redraws. The user approved the consolidated specification on 2026-09-09. Proceed to the implementation plan.
