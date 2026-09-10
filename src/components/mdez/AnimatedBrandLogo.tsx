"use client";

import React, { useEffect, useRef, useState } from "react";
import { BrandLogo, type BrandLogoProps } from "./BrandLogo";

const REVEAL_SESSION_KEY = "mdez-brand-reveal-v1";

export function AnimatedBrandLogo(props: BrandLogoProps) {
  const considered = useRef(false);
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    if (considered.current) return;
    considered.current = true;
    try {
      if (window.sessionStorage.getItem(REVEAL_SESSION_KEY)) return;
      window.sessionStorage.setItem(REVEAL_SESSION_KEY, "seen");
      setReveal(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch {
      // Branding remains visible and static when browser capabilities are unavailable.
    }
  }, []);

  return (
    <span className="brand-reveal" data-reveal={reveal} onAnimationEnd={(event) => {
      if (event.animationName === "brand-sparkle") setReveal(false);
    }}>
      <BrandLogo {...props} />
    </span>
  );
}
