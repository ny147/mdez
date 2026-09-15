# README update plan

## Agreed direction

- Primary audience: people who want to use Mdez.
- No public demo: lead with a local quick start.
- Use the supplied Mdez illustration as the README banner, preserving the image as provided.
- Move deployment and database operations into linked guides under docs/.
- License is undecided: do not add a license file, license badge, or claim a specific license.
- Use grill-me and i-have-adhd guidance; do not use Superpowers.

## 1. Verify the public-facing facts

Check the current implementation before writing feature claims. Search, bookmarks, and resume behavior exist in the code; the existing README's search exclusion is stale. Confirm the flat top-level book model, import/export formats, editing and reading modes, Markdown rendering, and sharing limitations.

Verify that a fresh local installation can run core browser-local features without Supabase environment variables. Use Node.js 22 as the documented baseline because CI uses it. Check the repository remote before writing a clone URL. Document any sharing configuration requirements separately from the basic quick start.

## 2. Add the supplied banner

Copy the original image from:
C:/Users/Neary/AppData/Local/Temp/codex-clipboard-268435b7-8a47-400c-8ceb-11f02f14626e.png

Proposed repository destination: docs/assets/mdez-banner.png.

Place a relative Markdown image link at the top of README.md. Provide descriptive alt text and repeat the essential project description in ordinary text below the image. Do not regenerate or modify the illustration. Treat the banner's "OPEN SOURCE" text as supplied branding; licensing remains an unresolved release decision.

## 3. Rewrite README.md for new users

Proposed section order:

1. Banner, project name, and a short description: a local-first Markdown workspace for reading, editing, organizing, and optional sharing.
2. Why Mdez: a short list of verified user benefits. Include an explicit distinction between local library storage and server-backed sharing.
3. Quick start: Node.js 22 and npm prerequisites, verified clone instructions, npm ci, npm run dev, and http://localhost:3000. Include a short first-use path such as importing a Markdown file, editing it, and exporting it.
4. Storage and sharing: explain browser-specific IndexedDB storage, export/backups, and optional Quick Share and Key Groups. Keep meaningful limitations visible; link detailed GitHub import limits and hosting setup.
5. Development and contributing: verified checks, a small contribution workflow consistent with the repository, links to detailed guides, and a plain statement that the project license is not yet selected.

Keep the voice friendly, direct, and easy to scan. Avoid an unavailable demo link, unsupported badges, invented contribution policies, and unverified feature promises.

## 4. Extract detailed guides

- docs/self-hosting.md: optional Supabase configuration, all three migrations in dependency order, all five server-only environment variables, sharing behavior, and links to operations guidance.
- docs/operations.md: deployment settings, verification and smoke checks, cron endpoints and schedules, recovery and rollback procedures, and secret-rotation constraints.
- docs/github-import.md: supported repository URLs and Markdown formats, archive limits, refresh behavior, and unsupported features.

Preserve the operational details already present in README.md. Verify them against code and configuration before carrying them over. Fix relative links for their new locations. Remove historical approval-process wording from public onboarding unless it represents an actual documented maintainer policy.

## 5. Verify the documentation change

- Check commands against package.json and CI; verify a local startup where practical and report what was actually tested.
- Check every local link and image path, including migration links moved into docs/.
- Review Markdown rendering for banner sizing, heading order, readable code blocks, and concise sections.
- Review the diff for accuracy and scope. Preserve existing unrelated changes, including CONTEXT.md and untracked design/review files.
- Confirm no license, demo URL, or unsupported functionality has been invented. Documentation-only edits do not require new application tests.

## Deliverables

Updated README.md, the unchanged supplied banner stored in the repository, and three linked guides. This planning step does not edit the README or publish/deploy the project.

## Open decision

The maintainer will choose a project license separately. No license choice is inferred from the banner or the request to prepare an open-source README.
