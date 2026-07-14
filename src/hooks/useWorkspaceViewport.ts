"use client";

import { useMediaQuery } from "@/hooks/useMediaQuery";

export const TABLET_LAYOUT_QUERY = "(max-width: 1023px)";
export const MOBILE_LAYOUT_QUERY = "(max-width: 767px)";

export function useWorkspaceViewport() {
  return {
    isTabletLayout: useMediaQuery(TABLET_LAYOUT_QUERY),
    isMobileLayout: useMediaQuery(MOBILE_LAYOUT_QUERY)
  };
}
