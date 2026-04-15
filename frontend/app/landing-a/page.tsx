"use client";

import { useState } from "react";

import {
  LandingACtaSection,
  LandingAComparisonSection,
  LandingAFilterBar,
  LandingAFooter,
  LandingAFlowSection,
  LandingAHeroSection,
  LandingANavBar,
  LandingAProgramsSection,
  LandingATickerBar,
} from "./_components";
import { landingAStyles, landingAThemeVars } from "./_styles";

export default function LandingAPage() {
  const [activeChip, setActiveChip] = useState("전체");
  const [keyword, setKeyword] = useState("");

  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--ink)]" style={landingAThemeVars}>
      <LandingATickerBar />
      <LandingANavBar />
      <LandingAHeroSection />
      <LandingAFilterBar
        activeChip={activeChip}
        keyword={keyword}
        onActiveChipChange={setActiveChip}
        onKeywordChange={setKeyword}
      />
      <LandingAProgramsSection />
      <LandingAComparisonSection />
      <LandingAFlowSection />
      <LandingACtaSection />
      <LandingAFooter />

      <style jsx>{landingAStyles}</style>
    </main>
  );
}
