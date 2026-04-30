import React, { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Send,
} from "lucide-react";
import {
  loadTypologyTest,
  saveTypologyProgress,
  submitTypologyTest,
  TypologyAnswerMap,
  TypologyQuestionGroup,
  TypologyTest,
} from "../../services/typologyTest";
import {
  loadCurrentUserProfile,
  updateCurrentUserProfileDetails,
} from "../../services/accessControl";

type TypologyTestViewProps = {
  user: User;
  canViewResults?: boolean;
  onOpenResults?: () => void;
  onBack: () => void;
};

type TestViewMode = "single" | "all";

type QuestionGroupCardProps = {
  group: TypologyQuestionGroup;
  answers: TypologyAnswerMap;
  variant?: "standard" | "focus";
  onScoreSelect: (
    group: TypologyQuestionGroup,
    optionId: string,
    score: number
  ) => void;
};

type TypologyResultsActionProps = {
  canViewResults?: boolean;
  onOpenResults?: () => void;
};

const REQUIRED_SCORES = [1, 2, 3, 4];

const isGroupComplete = (
  group: TypologyQuestionGroup,
  answers: TypologyAnswerMap
) => {
  const selected = group.options
    .map((option) => answers[option.id])
    .filter((score): score is number => typeof score === "number")
    .sort((left, right) => left - right);

  return (
    selected.length === REQUIRED_SCORES.length &&
    selected.every((score, index) => score === REQUIRED_SCORES[index])
  );
};

const findResumeGroupIndex = (
  groups: TypologyQuestionGroup[],
  answers: TypologyAnswerMap
) => {
  const firstIncompleteIndex = groups.findIndex(
    (group) => !isGroupComplete(group, answers)
  );

  return firstIncompleteIndex === -1
    ? Math.max(groups.length - 1, 0)
    : firstIncompleteIndex;
};

const TypologyResultsAction: React.FC<TypologyResultsActionProps> = ({
  canViewResults,
  onOpenResults,
}) => {
  if (!canViewResults || !onOpenResults) return null;

  return (
    <button
      type="button"
      onClick={onOpenResults}
      className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-brand text-white font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all"
    >
      <BarChart3 className="w-4 h-4" />
      Zobraziť výsledky
    </button>
  );
};

const QuestionGroupCard: React.FC<QuestionGroupCardProps> = ({
  group,
  answers,
  variant = "standard",
  onScoreSelect,
}) => {
  const isComplete = isGroupComplete(group, answers);
  const isFocus = variant === "focus";

  return (
    <section
      className={`rounded-[2rem] border border-black/5 bg-[#f9f9f9] shadow-xl shadow-black/5 ${
        isFocus ? "p-5 md:p-8" : "p-5 md:p-7"
      }`}
    >
      <div className="flex items-center justify-between gap-4 mb-5">
        <h2
          className={`font-black tracking-tight ${
            isFocus ? "text-2xl md:text-3xl" : "text-xl md:text-2xl"
          }`}
        >
          Otázka {group.questionNo}
        </h2>
        <div
          className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
            isComplete ? "bg-brand text-white" : "bg-black/5 text-black/45"
          }`}
        >
          {isComplete ? "Hotovo" : "Vyberte 1-4"}
        </div>
      </div>

      <div className="space-y-4">
        {group.options.map((option) => (
          <div
            key={option.id}
            className={`grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 lg:items-center rounded-2xl bg-white border border-black/5 px-4 py-4 ${
              isFocus ? "md:px-6 md:py-5" : "md:px-5"
            }`}
          >
            <p
              className={`text-left font-bold leading-relaxed ${
                isFocus ? "text-lg md:text-xl" : "text-base md:text-lg"
              }`}
            >
              {option.statement}
            </p>
            <div className="grid grid-cols-4 gap-2 min-w-[220px]">
              {REQUIRED_SCORES.map((score) => {
                const isSelected = answers[option.id] === score;
                return (
                  <button
                    key={score}
                    type="button"
                    onClick={() => onScoreSelect(group, option.id, score)}
                    className={`h-11 rounded-xl font-black text-sm transition-all ${
                      isSelected
                        ? "bg-black text-white shadow-lg"
                        : "bg-black/5 text-black/50 hover:bg-black/10"
                    }`}
                  >
                    {score}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

const TypologyTestView: React.FC<TypologyTestViewProps> = ({
  user,
  canViewResults = false,
  onOpenResults,
  onBack,
}) => {
  const [test, setTest] = useState<TypologyTest | null>(null);
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [hasConfirmedProfile, setHasConfirmedProfile] = useState(false);
  const [answers, setAnswers] = useState<TypologyAnswerMap>({});
  const [viewMode, setViewMode] = useState<TestViewMode>("single");
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [lastTouchedQuestionNo, setLastTouchedQuestionNo] = useState<number | null>(
    null
  );
  const [hasAnswerChanges, setHasAnswerChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [autosaveError, setAutosaveError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    setIsLoading(true);
    setError(null);

    void Promise.all([loadTypologyTest(user), loadCurrentUserProfile(user)])
      .then(([loadedTest, loadedProfile]) => {
        if (!isMounted) return;
        const savedAnswers = loadedTest?.savedAnswers || {};

        setTest(loadedTest);
        setAnswers(savedAnswers);
        setCurrentGroupIndex(
          loadedTest ? findResumeGroupIndex(loadedTest.groups, savedAnswers) : 0
        );
        setLastSavedAt(loadedTest?.savedAt || null);
        setAutosaveError(null);
        setHasAnswerChanges(false);
        setFullName(loadedProfile?.fullName || "");
        setCompanyName(loadedProfile?.companyName || "");
        setHasConfirmedProfile(
          Boolean(loadedProfile?.fullName?.trim() && loadedProfile?.companyName?.trim())
        );
        setIsSubmitted(Boolean(loadedTest?.completedAt));
      })
      .catch((loadError: unknown) => {
        if (!isMounted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Test sa nepodarilo načítať."
        );
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  const completedGroups = useMemo(() => {
    if (!test) return 0;
    return test.groups.filter((group) => isGroupComplete(group, answers)).length;
  }, [answers, test]);

  useEffect(() => {
    if (!test || currentGroupIndex < test.groups.length) return;
    setCurrentGroupIndex(Math.max(test.groups.length - 1, 0));
  }, [currentGroupIndex, test]);

  const currentGroup = test?.groups[currentGroupIndex] || null;
  const currentGroupComplete = Boolean(
    currentGroup && isGroupComplete(currentGroup, answers)
  );
  const stepProgress = test?.groups.length
    ? ((currentGroupIndex + 1) / test.groups.length) * 100
    : 0;
  const groupCount = test?.groups.length || 0;
  const isComplete = Boolean(test && completedGroups === test.groups.length);
  const isProfileComplete = Boolean(fullName.trim() && companyName.trim());
  const answeredCount = Object.keys(answers).length;
  const saveStatusText = isAutosaving
    ? "Ukladám priebeh..."
    : autosaveError
      ? autosaveError
      : answeredCount > 0 && lastSavedAt
        ? "Priebeh je uložený."
        : "Priebeh sa uloží automaticky.";

  useEffect(() => {
    if (
      !test ||
      !hasConfirmedProfile ||
      !hasAnswerChanges ||
      isSubmitted ||
      isSubmitting ||
      answeredCount === 0
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setIsAutosaving(true);
      setAutosaveError(null);

      void saveTypologyProgress(user, test, answers)
        .then(() => {
          setLastSavedAt(new Date().toISOString());
        })
        .catch((saveError: unknown) => {
          setAutosaveError(
            saveError instanceof Error
              ? saveError.message
              : "Priebeh testu sa nepodarilo uložiť."
          );
        })
        .finally(() => {
          setIsAutosaving(false);
        });
    }, 650);

    return () => window.clearTimeout(timeout);
  }, [
    answeredCount,
    answers,
    hasAnswerChanges,
    hasConfirmedProfile,
    isSubmitted,
    isSubmitting,
    test,
    user,
  ]);

  useEffect(() => {
    if (
      viewMode !== "single" ||
      !currentGroup ||
      !currentGroupComplete ||
      lastTouchedQuestionNo !== currentGroup.questionNo ||
      currentGroupIndex >= groupCount - 1
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setCurrentGroupIndex((index) => Math.min(index + 1, groupCount - 1));
      setLastTouchedQuestionNo(null);
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [
    currentGroup,
    currentGroupComplete,
    currentGroupIndex,
    groupCount,
    lastTouchedQuestionNo,
    viewMode,
  ]);

  const handleModeChange = (nextMode: TestViewMode) => {
    setViewMode(nextMode);
    setLastTouchedQuestionNo(null);

    if (nextMode === "single" && test) {
      const firstIncompleteIndex = test.groups.findIndex(
        (group) => !isGroupComplete(group, answers)
      );
      setCurrentGroupIndex(
        firstIncompleteIndex === -1
          ? Math.max(test.groups.length - 1, 0)
          : firstIncompleteIndex
      );
    }
  };

  const handleProfileSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isProfileComplete) return;

    setIsSavingProfile(true);
    setError(null);

    try {
      await updateCurrentUserProfileDetails(user, {
        fullName,
        companyName,
      });
      setHasConfirmedProfile(true);
    } catch (profileError: unknown) {
      setError(
        profileError instanceof Error
          ? profileError.message
          : "Profil sa nepodarilo uložiť."
      );
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleScoreSelect = (
    group: TypologyQuestionGroup,
    optionId: string,
    score: number
  ) => {
    setLastTouchedQuestionNo(group.questionNo);
    setHasAnswerChanges(true);
    setAnswers((current) => {
      const next = { ...current };

      group.options.forEach((option) => {
        if (option.id !== optionId && next[option.id] === score) {
          delete next[option.id];
        }
      });

      next[optionId] = score;
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!test || !isComplete) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await submitTypologyTest(user, test, answers);
      setHasAnswerChanges(false);
      setIsSubmitted(true);
    } catch (submitError: unknown) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Odpovede sa nepodarilo odoslať."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-180px)] flex items-center justify-center">
        <div className="flex items-center gap-3 text-black/50 font-black uppercase tracking-widest text-sm">
          <LoaderCircle className="w-5 h-5 animate-spin" />
          Načítavam test
        </div>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="min-h-[calc(100vh-180px)] flex flex-col items-center justify-center text-center px-4">
        <div className="w-full max-w-4xl bg-white border border-black/5 rounded-[2rem] shadow-2xl px-7 py-10 md:px-12 md:py-14">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-brand/10 text-brand flex items-center justify-center mb-7">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <p className="text-[10px] md:text-xs font-black uppercase tracking-widest text-black/35 mb-4">
            Test bol odoslaný
          </p>
          <h1 className="text-[clamp(2rem,4vw,3.8rem)] font-black tracking-tight leading-tight">
            Ďakujeme za vyplnenie.
          </h1>
          <p className="mt-6 text-black/55 font-semibold text-base md:text-xl leading-relaxed max-w-2xl mx-auto">
            Vaše odpovede boli uložené. Výsledok bude súčasťou rozvojového
            programu a dozviete sa ho počas spoločnej práce s konzultantom.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="px-8 py-4 rounded-full bg-black text-white font-black text-xs uppercase tracking-widest hover:bg-brand transition-all"
            >
              Späť na prehľad
            </button>
            <TypologyResultsAction
              canViewResults={canViewResults}
              onOpenResults={onOpenResults}
            />
          </div>
        </div>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="w-full max-w-5xl mx-auto animate-fade-in">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-black/40 font-black uppercase tracking-widest text-xs hover:text-black transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Späť na prehľad
          </button>
          <TypologyResultsAction
            canViewResults={canViewResults}
            onOpenResults={onOpenResults}
          />
        </div>

        <div className="min-h-[calc(100vh-240px)] flex flex-col items-center justify-center text-center px-4">
          <div className="w-full max-w-4xl bg-[#f9f9f9] border border-black/5 rounded-[2rem] px-7 py-10 md:px-12 md:py-14">
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">
              Test zatiaľ nie je dostupný
            </h1>
            <p className="mt-5 text-black/55 font-semibold">
              Organizátor ho sprístupní pred začiatkom programu.
            </p>
            <button
              type="button"
              onClick={onBack}
              className="mt-8 px-8 py-4 rounded-full bg-black text-white font-black text-xs uppercase tracking-widest hover:bg-brand transition-all"
            >
              Späť
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!hasConfirmedProfile) {
    return (
      <div className="w-full max-w-5xl mx-auto animate-fade-in">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-black/40 font-black uppercase tracking-widest text-xs hover:text-black transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Späť na prehľad
          </button>
          <TypologyResultsAction
            canViewResults={canViewResults}
            onOpenResults={onOpenResults}
          />
        </div>

        <div className="rounded-[2rem] border border-black/5 bg-white shadow-2xl shadow-black/5 overflow-hidden">
          <div className="bg-black text-white px-6 py-8 md:px-10 md:py-10">
            <p className="text-[10px] md:text-xs font-black uppercase tracking-widest text-white/45 mb-3">
              Údaje účastníka
            </p>
            <h1 className="text-[clamp(2rem,5vw,4rem)] font-black tracking-tight leading-tight">
              Pred vyplnením testu doplňte svoje údaje
            </h1>
            <p className="mt-5 text-white/60 font-semibold text-base md:text-lg leading-relaxed max-w-3xl">
              Tieto údaje použijeme iba na správne označenie výsledku a profilu,
              ktorý bude pripravený pre rozvojový program.
            </p>
          </div>

          <form onSubmit={handleProfileSubmit} className="p-6 md:p-10 space-y-5">
            {error && (
              <div className="rounded-2xl border border-brand/20 bg-brand/5 px-5 py-4 text-brand font-bold">
                {error}
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <label
                  htmlFor="typology-full-name"
                  className="block text-[10px] uppercase tracking-widest font-black text-black/40 mb-3"
                >
                  Meno a priezvisko
                </label>
                <input
                  id="typology-full-name"
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Napr. Michal Tramita"
                  className="w-full rounded-2xl border border-black/10 bg-[#fbfaf7] px-5 py-4 text-base font-bold outline-none focus:ring-2 focus:ring-brand/25"
                />
              </div>

              <div>
                <label
                  htmlFor="typology-company-name"
                  className="block text-[10px] uppercase tracking-widest font-black text-black/40 mb-3"
                >
                  Spoločnosť
                </label>
                <input
                  id="typology-company-name"
                  type="text"
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  placeholder="Napr. Libellius"
                  className="w-full rounded-2xl border border-black/10 bg-[#fbfaf7] px-5 py-4 text-base font-bold outline-none focus:ring-2 focus:ring-brand/25"
                />
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pt-3">
              <p className="text-sm font-semibold text-black/45 max-w-2xl">
                Údaje môžete neskôr zmeniť pred opätovným spustením testu, ak vám
                administrátor test resetuje.
              </p>
              <button
                type="submit"
                disabled={!isProfileComplete || isSavingProfile}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-brand text-white font-black text-xs uppercase tracking-widest hover:bg-black transition-all disabled:opacity-45 disabled:cursor-not-allowed"
              >
                {isSavingProfile ? (
                  <LoaderCircle className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Pokračovať na test
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto animate-fade-in">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-black/40 font-black uppercase tracking-widest text-xs hover:text-black transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Späť na prehľad
        </button>
        <TypologyResultsAction
          canViewResults={canViewResults}
          onOpenResults={onOpenResults}
        />
      </div>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5 mb-8 md:mb-10">
        <div>
          <p className="text-[10px] md:text-xs font-black uppercase tracking-widest text-brand mb-3">
            Rozvojový dotazník
          </p>
          <h1 className="text-[clamp(2rem,5vw,4.2rem)] font-black tracking-tight leading-tight">
            {test.title}
          </h1>
          <p className="mt-5 text-black/55 font-semibold text-base md:text-xl leading-relaxed max-w-3xl">
            Pri každej štvorici tvrdení prideľte body 1 až 4. Hodnota 4 znamená,
            že vás tvrdenie vystihuje najviac, hodnota 1 najmenej. Každú hodnotu
            použite v jednej štvorici iba raz.
          </p>
          <div className="mt-7 inline-grid grid-cols-2 rounded-full border border-black/10 bg-white p-1 shadow-sm">
            <button
              type="button"
              aria-pressed={viewMode === "single"}
              onClick={() => handleModeChange("single")}
              className={`rounded-full px-5 py-3 text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${
                viewMode === "single"
                  ? "bg-black text-white shadow-lg"
                  : "text-black/40 hover:text-black"
              }`}
            >
              Po otázkach
            </button>
            <button
              type="button"
              aria-pressed={viewMode === "all"}
              onClick={() => handleModeChange("all")}
              className={`rounded-full px-5 py-3 text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${
                viewMode === "all"
                  ? "bg-black text-white shadow-lg"
                  : "text-black/40 hover:text-black"
              }`}
            >
              Všetky naraz
            </button>
          </div>
        </div>
        <div className="rounded-2xl bg-[#f9f9f9] border border-black/5 px-5 py-4 text-left md:text-right shrink-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-black/35">
            Vyplnené
          </p>
          <p className="text-2xl font-black mt-1">
            {completedGroups}/{test.groups.length}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-7 rounded-2xl border border-brand/20 bg-brand/5 px-5 py-4 text-brand font-bold">
          {error}
        </div>
      )}

      {viewMode === "single" && currentGroup ? (
        <div className="space-y-6">
          <div className="rounded-[1.5rem] border border-black/5 bg-white px-5 py-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
              <p className="text-[10px] md:text-xs font-black uppercase tracking-widest text-brand">
                Otázka {currentGroupIndex + 1} z {test.groups.length}
              </p>
              <div className="text-left sm:text-right">
                <p className="text-[10px] md:text-xs font-black uppercase tracking-widest text-black/35">
                  {currentGroupComplete ? "Otázka dokončená" : "Doplňte hodnoty 1-4"}
                </p>
                <p
                  className={`mt-1 text-[10px] font-black uppercase tracking-widest ${
                    autosaveError ? "text-brand" : "text-black/30"
                  }`}
                >
                  {saveStatusText}
                </p>
              </div>
            </div>
            <div
              className="h-2.5 rounded-full bg-black/5 overflow-hidden"
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={test.groups.length}
              aria-valuenow={currentGroupIndex + 1}
              aria-label="Postup v teste"
            >
              <div
                className="h-full rounded-full bg-brand transition-all duration-500 ease-out"
                style={{ width: `${stepProgress}%` }}
              />
            </div>
          </div>

          <QuestionGroupCard
            group={currentGroup}
            answers={answers}
            variant="focus"
            onScoreSelect={handleScoreSelect}
          />

          <div className="rounded-[1.5rem] bg-white/90 backdrop-blur border border-black/10 shadow-2xl px-4 py-4 md:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <button
              type="button"
              onClick={() =>
                setCurrentGroupIndex((index) => Math.max(index - 1, 0))
              }
              disabled={currentGroupIndex === 0}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full border border-black/10 bg-white text-black font-black text-xs uppercase tracking-widest hover:border-black/30 transition-all disabled:opacity-35 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              Predchádzajúca
            </button>

            <p className="text-sm font-bold text-black/50 text-center">
              {currentGroupComplete
                ? currentGroupIndex < test.groups.length - 1
                  ? "Ďalšia otázka sa zobrazí automaticky."
                  : "Test je pripravený na odoslanie."
                : "Každú hodnotu 1, 2, 3 a 4 použite iba raz."}
            </p>

            {currentGroupIndex < test.groups.length - 1 ? (
              <button
                type="button"
                onClick={() =>
                  setCurrentGroupIndex((index) =>
                    Math.min(index + 1, test.groups.length - 1)
                  )
                }
                disabled={!currentGroupComplete}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-black text-white font-black text-xs uppercase tracking-widest hover:bg-brand transition-all disabled:opacity-45 disabled:cursor-not-allowed"
              >
                Ďalšia otázka
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!isComplete || isSubmitting}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-black text-white font-black text-xs uppercase tracking-widest hover:bg-brand transition-all disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                {isSubmitting ? "Odosielam..." : "Odoslať test"}
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-6">
            {test.groups.map((group) => (
              <QuestionGroupCard
                key={group.questionNo}
                group={group}
                answers={answers}
                onScoreSelect={handleScoreSelect}
              />
            ))}
          </div>

          <div className="sticky bottom-4 mt-8 z-30">
            <div className="w-full rounded-[1.5rem] bg-white/90 backdrop-blur border border-black/10 shadow-2xl px-4 py-4 md:px-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-black/55">
                  Pred odoslaním musia byť všetky štvorice vyplnené hodnotami 1, 2, 3 a 4.
                </p>
                <p
                  className={`mt-1 text-[10px] font-black uppercase tracking-widest ${
                    autosaveError ? "text-brand" : "text-black/30"
                  }`}
                >
                  {saveStatusText}
                </p>
              </div>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!isComplete || isSubmitting}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-black text-white font-black text-xs uppercase tracking-widest hover:bg-brand transition-all disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                {isSubmitting ? "Odosielam..." : "Odoslať test"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TypologyTestView;
