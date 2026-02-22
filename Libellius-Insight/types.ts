export interface CompetencyData {
  name: string;
  selfScore: number;
  othersScore: number;
}

export interface StatementData {
  text: string;
  score: number;
}

export interface GapData {
  statement: string;
  selfScore: number;
  othersScore: number;
  diff: number;
}

export interface EmployeeProfile {
  id: string;
  name: string;
  competencies: CompetencyData[];
  topStrengths: StatementData[];
  topWeaknesses: StatementData[];
  gaps: GapData[];
  recommendations: string;
}

export interface EngagementTeam {
  name: string;
  count: number;
}

// --- NOVÉ TYPY PRE OTVORENÉ OTÁZKY (AI) ---

export interface OpenQuestionThemeCloudItem {
  theme: string;
  count: number;
  percentage: number;
}

export interface OpenQuestionRecommendation {
  title: string;
  description: string;
  quotes: string[]; // themeCloud už nie je tu
}

export interface OpenQuestionItem {
  questionText: string;
  themeCloud: OpenQuestionThemeCloudItem[]; // themeCloud je na úrovni otázky
  recommendations: OpenQuestionRecommendation[];
}

export interface OpenQuestionTeam {
  teamName: string;
  questions: OpenQuestionItem[];
}

// --- NOVÉ/UPRAVENÉ TYPY PRE ZAMESTNANECKÚ SPOKOJNOSŤ ---

export interface SatisfactionMetric {
  category: string;
  score: number;
  questionType?: string; // Prierezova / Specificka
}

export interface SatisfactionTeam {
  teamName: string;
  metrics: SatisfactionMetric[];
}

export interface SatisfactionArea {
  id: string;
  title: string;
  teams: SatisfactionTeam[];
}

export interface EmployeeSatisfactionData {
  clientName: string;
  surveyName: string;
  totalSent: number;
  totalReceived: number;
  successRate: string;
  teamEngagement: EngagementTeam[];
  openQuestions: OpenQuestionTeam[];
  areas: SatisfactionArea[];
}

// --- SPOLOČNÉ TYPY ---

export type AnalysisMode = '360_FEEDBACK' | 'ZAMESTNANECKA_SPOKOJNOST';

export interface FeedbackAnalysisResult {
  mode: AnalysisMode;
  reportMetadata: {
    date: string;
    company?: string;
    scaleMax: number;
  };
  employees?: EmployeeProfile[];
  satisfaction?: EmployeeSatisfactionData;
}

export enum AppStatus {
  HOME = 'HOME',
  READY_TO_UPLOAD = 'READY_TO_UPLOAD',
  ANALYZING = 'ANALYZING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}
