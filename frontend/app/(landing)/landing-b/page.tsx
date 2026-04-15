"use client";

import { useEffect, useMemo, useState } from "react";

import { LandingANavBar, LandingATickerBar } from "../landing-a/_components";
import {
  buildFallbackPrograms,
  initialAnswers,
  previewPrograms,
  resultCounts,
  type QuizAnswers,
} from "./_content";
import { LandingBQuizSection, LandingBResultSection, LandingBSupportSection } from "./_components";
import { landingBStyles, landingBThemeVars } from "./_styles";

export default function LandingBPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [showResult, setShowResult] = useState(false);
  const [answers, setAnswers] = useState<QuizAnswers>(initialAnswers);

  const effectiveInterest = answers.directInterest.trim() || answers.interest;
  const canGoNext = Boolean(answers.situation);
  const canShowStep3 = Boolean(answers.mode);
  const canShowResult = Boolean(effectiveInterest.trim());

  const totalCount = resultCounts[effectiveInterest] ?? 14;
  const programs = previewPrograms[effectiveInterest] ?? buildFallbackPrograms(effectiveInterest);

  const resultTag = useMemo(() => {
    const tags = [
      answers.situation,
      effectiveInterest,
      answers.mode === "상관없음" ? "" : answers.mode,
      "마감 임박순",
    ].filter(Boolean);

    return tags.join(" · ");
  }, [answers.mode, answers.situation, effectiveInterest]);

  useEffect(() => {
    if (showResult) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [showResult]);

  const progressWidth = step === 1 ? "33%" : step === 2 ? "66%" : "100%";
  const progressLabel = step === 1 ? "상황 확인" : step === 2 ? "방식 확인" : "분야 확인";

  const selectSituation = (label: string) => {
    setAnswers((current) => ({ ...current, situation: label }));
  };

  const selectMode = (label: string) => {
    setAnswers((current) => ({ ...current, mode: label }));
  };

  const selectInterest = (label: string) => {
    setAnswers((current) => ({
      ...current,
      interest: label,
      directInterest: "",
    }));
  };

  const handleDirectInterestFocus = () => {
    setAnswers((current) => ({ ...current, interest: "" }));
  };

  const handleDirectInterestChange = (value: string) => {
    setAnswers((current) => ({
      ...current,
      interest: "",
      directInterest: value,
    }));
  };

  const resetQuiz = () => {
    setAnswers(initialAnswers);
    setStep(1);
    setShowResult(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--ink)]" style={landingBThemeVars}>
      <LandingATickerBar />
      <LandingANavBar />
      {showResult ? (
        <LandingBResultSection programs={programs} resultTag={resultTag} totalCount={totalCount} />
      ) : (
        <LandingBQuizSection
          answers={answers}
          step={step}
          progressLabel={progressLabel}
          progressWidth={progressWidth}
          canGoNext={canGoNext}
          canShowStep3={canShowStep3}
          canShowResult={canShowResult}
          onStepChange={setStep}
          onShowResult={() => setShowResult(true)}
          onSelectSituation={selectSituation}
          onSelectMode={selectMode}
          onSelectInterest={selectInterest}
          onDirectInterestFocus={handleDirectInterestFocus}
          onDirectInterestChange={handleDirectInterestChange}
        />
      )}

      <LandingBSupportSection onReset={resetQuiz} />

      <style jsx>{landingBStyles}</style>
    </main>
  );
}
