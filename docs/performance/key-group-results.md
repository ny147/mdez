# Key Group implementation results

This implements the profiling foundation requested by PR #39. Performance acceptance and selection of Tasks 5–7 remain open; the implementation PR stays draft.

The changes add exact synthetic fixtures, nearest-rank percentiles, allowlisted metric serialization, a production-only Playwright measurement harness, shared version-aware API characterization, and opt-in isolated server attribution with disposable-database preflight. Existing page selection, autosave delay, polling interval, structural mutation acknowledgement, conflict handling and book-delete refresh behavior are retained.

The independent review identified empty populated-book fixtures, page-cap create failures, incomplete open readiness, development-runtime acceptance, unfinished/failed request loss, ambiguous PATCH attribution and accepted-input boundaries. Regression tests and the harness now address these. Raw reports identify view mode and creation collection; feedback is measured when a recognized pending status exists.

The full production browser regression run passed **218 tests with 12 existing conditional skips**. The unit suite passed **450 tests**. Lint, TypeScript and the production build passed. Reduced performance diagnostics and their limits are documented in [the baseline](key-group-baseline.md).

The isolated small-fixture mock smoke passed all four desktop/mobile × Local/group tests (56 recorded actions). The real-server creation diagnostic also passed all four tests (72 samples across book and Unsorted cells, zero failures). The raw files retain the desktop Key Group book-creation outlier; no sample was discarded to improve a percentile.

One earlier diagnostic run overlapped the full six-worker browser regression suite and had a failed Local Edit-switch sample. Its four sanitized reports are retained under `data/key-group-baseline/contended-diagnostic/`; they are excluded from any representative latency claim. The failed sample has no latency rather than being replaced with zero or silently removed. The isolated rerun follows a loaded editor/body readiness check.

Remaining work includes the full sampling matrix, validated frame/CPU attribution, pending/failed draft scenarios, detailed SQL/pool/lock attribution, and numeric product-owner budgets. No before/after improvement or ready-to-release performance claim is made. The user merges manually.
