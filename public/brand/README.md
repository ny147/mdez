# Prism Pages brand assets

## Portable logo exports

- `prism-pages.svg`: standalone full-color silhouette/book mark.
- `prism-pages-wordmark-ink.svg`: full-color mark with ink lettering for light backgrounds.
- `prism-pages-wordmark-white.svg`: full-color book with white silhouette and lettering for dark backgrounds. The hair clip uses brand ink (`#211A3D`); use that background for a seamless cutout appearance.

All SVGs are self-contained paths with transparent backgrounds and an accessible
Mdez label. They contain no external images, scripts, or font dependencies.
Keep their aspect ratio and allow clear space around the mark.

Regenerate logo and application-icon exports with `node scripts/export-brand-icons.mjs`.
The symbol comes from `src/components/mdez/brand-mark.json`. Letter outlines in
`scripts/brand-wordmark.json` derive from the application's Manrope Latin font at
weight 800, with -0.04em tracking, matching the live wordmark's styling. The JSON
records the source font SHA-256, units per em, glyph positions, and paths.
Extraction used fontTools 4.65.0 from the existing Next.js font build; rebuilding
these exports only requires the checked-in paths and the existing Sharp package.

Both lockups were rasterized and visually checked, including the white version
against brand ink. Existing app icons remain byte-identical after regeneration.

## Mascot provenance and exports

Prepared 2026-09-09 with the built-in imagegen tool, following the approved
`docs/superpowers/specs/2026-09-09-prism-pages-brand-design.md`.

- Style reference: `docs/design-assets/prism-pages/mascot-redraw-reference.png`.
  Its grey checkerboard is baked RGB and is not shipped as production art.
- Pose and identity reference: the user-supplied character board, originally
  `codex-clipboard-0fb0b9e1-48ac-40eb-9e0b-394caaf442c6.png`.
- Generated source directory (local provenance):
  `C:/Users/Neary/.codex/generated_images/01a08628-2267-76d1-b371-26cd9cc02ab7/`.
- Writing source: `exec-5394f02c-d132-4bbb-abc3-fdd39c13e529.png`.
- Peeking source: `exec-6dd609d7-4182-41a9-9ff4-a4cbaa88fcad.png`.

| Production asset | Dimensions | Bytes | Format | Fully transparent pixels | Partially transparent pixels |
| --- | --- | ---: | --- | ---: | ---: |
| `mascot-writing.png` | 384 × 256 | 138,328 | RGBA PNG | 49,722 | 47,214 |
| `mascot-peeking.png` | 416 × 277 | 144,391 | RGBA PNG | 55,133 | 58,667 |

Both exports are below 200 KB. Sharp performed proportional resizing and lossless
PNG compression at level 9, preserving the generated alpha. No programmatic
background removal was used. Raw-channel inspection confirms four channels and
alpha zero at all four corners. Each image was visually inspected after flattening
onto white (`#FFFFFF`) and panel lavender (`#F2EEFA`): no checkerboard, rectangular
backdrop, visible halo, or clipped silhouette. Earlier opaque generated candidates
were rejected and are not included in production assets.

## Generation prompts

Writing final prompt, with the approved redraw as edit target:

> Recreate this mascot writing illustration as a transparent-background PNG sticker asset. The checkerboard in the input is an ERROR, do not copy any checkerboard pixels. Use actual alpha transparency for all empty background. Output MUST have RGBA channels and transparent corners. Faithfully redraw the exact character and pose, including lavender bob with pink/cyan ends, book clip, closed-eye smile, cape, pen in hand writing into open book, and two stacked books. Clean simplified chibi illustration, full uncropped silhouette, no text. Remove the checkerboard completely. No background, no grid, no white backdrop. Actual transparent PNG.

Peeking pose prompt, using the approved redraw and supplied board as references:

> Create ONE isolated transparent PNG mascot sticker. Image 1 is drawing style and identity reference ONLY; IGNORE its checkerboard. Image 2 bottom-right peeking character is the exact pose reference. Faithfully redraw the peeking pose in Image 1 simplified chibi style: same lavender bob with pink ends on left and cyan on right, book-shaped hair clip, big violet eyes, tiny nose and mouth, both hands gripping the top edge of a large open upright book with pink left cover, lavender spine, cyan right cover, small book emblem; small stacked books to left and plant to right as original peeking pose. Whole silhouette fully contained. No full-body character, no writing pose, no logos outside book, no text, no decorative floating marks. Background must be genuinely transparent with alpha channel, not white or checkerboard. No glow or haze. Clean transparent cutout.

The resulting pose (`exec-1de5255c-4217-413d-9daa-52d140510410.png`) required a
final background edit with the prompt:

> Remove the background. Transparent background PNG cutout.

The production files are decorative assets. Display them at the sizes and states
defined in the approved specification; do not embed full reference boards in the UI.
