import type { TypologyAdminResult, TypologyStyleCode } from "./typologyTest";
import {
  buildCombinationSummary,
  getRankedTypologyStyles,
  TYPOLOGY_MAX_SCORE,
  type RankedTypologyStyle,
} from "./typologyProfile";

export type TypologyReportMode = "interactive" | "print";

export type TypologyReportScoreItem = {
  code: TypologyStyleCode;
  label: string;
  name: string;
  score: number;
  percentage: number;
  isPrimary: boolean;
  isSecondary: boolean;
};

export type TypologyReportStyleSection = {
  code: TypologyStyleCode;
  name: string;
  title: string;
  summary: string;
  manifests: string[];
};

export type TypologyReportViewModel = {
  personName: string;
  email: string;
  companyName: string | null;
  completedAtLabel: string;
  dominantStyleName: string;
  reportTypeLabel: string;
  reportTitle: string;
  reportSubtitle: string;
  summary: string;
  scores: TypologyReportScoreItem[];
  primary: TypologyReportStyleSection;
  secondary: TypologyReportStyleSection | null;
  drivers: string[];
  blockers: string[];
  communication: string[];
  leadershipFocus: string[];
  developmentActions: string[];
  reflectionQuestions: string[];
  profileReadingNote: string;
};

const REFLECTION_QUESTIONS = [
  "V čom sa v tomto profile najviac spoznávam?",
  "Kedy mi môj prirodzený štýl pomáha vo vedení ľudí?",
  "V akej situácii ma môže tento štýl brzdiť?",
  "Čo chcem vedome robiť inak ako líder?",
];

const PROFILE_READING_NOTE =
  "Profil nie je nálepka ani hodnotenie osobnosti. Popisuje preferovaný štýl správania, ktorý sa môže meniť podľa situácie, roly, skúseností a aktuálneho tlaku.";

const formatDate = (value: string | null) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
};

const toStyleSection = (style: RankedTypologyStyle): TypologyReportStyleSection => ({
  code: style.code,
  name: style.content.name,
  title: style.content.title,
  summary: style.content.summary,
  manifests: style.content.manifests,
});

export const buildTypologyReportModel = (
  result: TypologyAdminResult
): TypologyReportViewModel | null => {
  if (!result.scores) return null;

  const rankedStyles = getRankedTypologyStyles(result.scores);
  const primary = rankedStyles[0] || null;
  const secondary = rankedStyles[1] || null;

  if (!primary) return null;

  const personName = result.fullName || result.userEmail;

  return {
    personName,
    email: result.userEmail,
    companyName: result.companyName || null,
    completedAtLabel: formatDate(result.completedAt),
    dominantStyleName: primary.content.name,
    reportTypeLabel: "Individuálna správa",
    reportTitle: "Profil osobnostnej typológie",
    reportSubtitle:
      "Správa sumarizuje preferovaný spôsob správania v pracovnom a líderskom kontexte. Slúži ako podklad pre sebareflexiu a ďalší rozvoj.",
    summary: buildCombinationSummary(primary, secondary),
    scores: rankedStyles.map((style) => ({
      code: style.code,
      label: style.content.label,
      name: style.content.name,
      score: style.score,
      percentage: Math.min(
        100,
        Math.round((style.score / TYPOLOGY_MAX_SCORE) * 100)
      ),
      isPrimary: style.code === primary.code,
      isSecondary: style.code === secondary?.code,
    })),
    primary: toStyleSection(primary),
    secondary: secondary ? toStyleSection(secondary) : null,
    drivers: primary.content.drivers,
    blockers: primary.content.blockers,
    communication: primary.content.communication,
    leadershipFocus: primary.content.leadershipFocus,
    developmentActions: primary.content.developmentActions,
    reflectionQuestions: REFLECTION_QUESTIONS,
    profileReadingNote: PROFILE_READING_NOTE,
  };
};
