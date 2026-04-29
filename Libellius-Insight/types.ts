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

export interface Feedback360RaterAverages {
  subordinate: number;
  manager: number;
  peer: number;
  average: number;
  self: number;
}

export interface Feedback360FrequencyDistribution {
  na: number;
  one: number;
  two: number;
  three: number;
  four: number;
  five: number;
  six: number;
}

export interface Feedback360RespondentCounts {
  subordinate: number;
  manager: number;
  peer: number;
  self?: number;
}

export interface Feedback360StatementResult {
  id: string;
  statement: string;
  competencyId: string;
  competencyLabel: string;
  averages: Feedback360RaterAverages;
  frequencyDistribution?: Feedback360FrequencyDistribution;
}

export interface Feedback360CompetencyResult {
  id: string;
  label: string;
  averages: Feedback360RaterAverages;
  statements: Feedback360StatementResult[];
  respondentCounts?: Feedback360RespondentCounts;
}

export interface Feedback360StrengthWeaknessItem {
  statementId: string;
  statement: string;
  competencyId: string;
  competencyLabel: string;
  average: number;
}

export interface Feedback360PotentialItem {
  statementId: string;
  statement: string;
  competencyId: string;
  competencyLabel: string;
  average: number;
  self: number;
  diff: number;
}

export interface Feedback360ImplementationPlan {
  participantName: string;
  date?: string;
  priorities: string[];
}

export interface Feedback360ParticipantSummary {
  id: string;
  name: string;
  competencies: Feedback360CompetencyResult[];
  overallAverage: number;
  overallSelf: number;
}

export interface Feedback360CompanyReport {
  respondentCounts: Feedback360RespondentCounts;
  competencies: Feedback360CompetencyResult[];
  strengths: Feedback360StrengthWeaknessItem[];
  developmentNeeds: Feedback360StrengthWeaknessItem[];
  participants: Feedback360ParticipantSummary[];
}

export interface Feedback360IndividualReport {
  id: string;
  name: string;
  competencies: Feedback360CompetencyResult[];
  overestimatedPotential: Feedback360PotentialItem[];
  hiddenPotential: Feedback360PotentialItem[];
  implementationPlan?: Feedback360ImplementationPlan;
}

export interface Feedback360Data {
  companyName: string;
  surveyName: string;
  scaleMax: number;
  companyReport: Feedback360CompanyReport;
  individuals: Feedback360IndividualReport[];
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

export interface OpenQuestionResponse {
  text: string;
  theme?: string;
}

export interface OpenQuestionItem {
  questionText: string;
  themeCloud: OpenQuestionThemeCloudItem[]; // themeCloud je na úrovni otázky
  responses?: OpenQuestionResponse[];
  recommendations?: OpenQuestionRecommendation[];
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
  questionId?: string;
  frequencyDistribution?: FrequencyDistribution;
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

export interface FrequencyDistribution {
  na: number;
  one: number;
  two: number;
  three: number;
  four: number;
  five: number;
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
  surveyGroups?:
    | SatisfactionSurveyGroup[]
    | Record<string, SatisfactionSurveyGroup>;
}

export interface SatisfactionSurveyGroup {
  id?: string;
  key?: string;
  name?: string;
  title?: string;
  label?: string;
  masterTeams?: string[];
  teamEngagement?: EngagementTeam[];
  openQuestions?: OpenQuestionTeam[];
  areas?: SatisfactionArea[];
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
  feedback360?: Feedback360Data;
}

export enum AppStatus {
  HOME = 'HOME',
  READY_TO_UPLOAD = 'READY_TO_UPLOAD',
  ANALYZING = 'ANALYZING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}
