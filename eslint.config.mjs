import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "dist/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      ".claude/**",
      ".codex/**",
      ".github/skills/**",
      ".impeccable/**",
      ".superpowers/**",
      ".worktrees/**",
      "next-env.d.ts"
    ]
  },
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      "@next/next/no-html-link-for-pages": "off"
    }
  },
  // Next.js 16 adds React Compiler diagnostics. Defer existing findings to a
  // separate refactor; retain the new checks elsewhere, Rules of Hooks, and
  // exhaustive dependency checks throughout the project.
  {
    files: [
      "src/components/mdez/AnimatedBrandLogo.tsx",
      "src/components/mdez/GroupSettingsDialog.tsx",
      "src/components/mdez/MdezWorkspace.tsx",
      "src/components/mdez/MovePageDialog.tsx",
      "src/components/mdez/PublicSharedPage.tsx",
      "src/components/mdez/QuickShareDialog.tsx",
      "src/components/mdez/SharedLinksDialog.tsx",
      "src/components/mdez/ThemeProvider.tsx",
      "src/hooks/useKeyGroupLibrary.ts",
      "src/hooks/usePageBookmarks.ts",
      "src/hooks/useReaderPreferences.ts",
      "src/hooks/useWorkspaceResume.ts"
    ],
    rules: { "react-hooks/set-state-in-effect": "off" }
  },
  {
    files: [
      "src/components/mdez/EditorPane.tsx",
      "src/components/mdez/LibraryTree.tsx",
      "src/hooks/useDocumentDrafts.ts",
      "src/hooks/useGroupRefresh.ts"
    ],
    rules: { "react-hooks/refs": "off" }
  },
  {
    files: ["src/hooks/useDocumentDrafts.ts"],
    rules: { "react-hooks/preserve-manual-memoization": "off" }
  }
];

export default eslintConfig;
