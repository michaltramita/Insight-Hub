// Application Status Enum
export enum AppStatus {
  HOME = 'HOME',
  READY_TO_UPLOAD = 'READY_TO_UPLOAD',
  ANALYZING = 'ANALYZING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

// Analysis Mode Type
export type AnalysisMode = '360_FEEDBACK' | 'ZAMESTNANECKA_SPOKOJNOST';

// ===== New Cell-First Architecture Interfaces =====

// Represents a single extracted data cell
export interface RawCell {
  sectionName: string;
  teamName: string;
  questionText: string;
  score: number | null;
}

// Represents a record of missing/unparseable data
export interface MissingCellRecord {
  sectionName: string;
  teamName: string;
  questionText: string;
  reason: string;
}

// Team metadata
export interface TeamMetadata {
  id: string;
  name: string;
}

// Generic analysis result for satisfaction mode (cell-first architecture)
export interface GenericAnalysisResult {
  mode: AnalysisMode;
  reportMetadata: ReportMetadata;
  metadata: {
    clientName: string;
    totalSent: number;
    totalReceived: number;
    successRate: string;
    teamEngagement: EngagementTeam[];
  };
  teams: TeamMetadata[];
  cells: RawCell[];
  missingCells: MissingCellRecord[];
}

// ===== Existing Interfaces =====

// Report metadata common to all modes
export interface ReportMetadata {
  date: string;
  scaleMax: number;
}

// Team engagement data
export interface EngagementTeam {
  name: string;
  count: number;
  sentCount: number;
}

// Single metric in a team section
export interface TeamMetric {
  category: string;
  score: number;
}

// Team work situation data (used for backward compatibility in frontend)
export interface TeamWorkSituation {
  teamName: string;
  metrics: TeamMetric[];
}

// Satisfaction data structure (legacy nested format for frontend compatibility)
export interface SatisfactionData {
  clientName: string;
  totalSent: number;
  totalReceived: number;
  successRate: string;
  teamEngagement: EngagementTeam[];
  workSituationByTeam: TeamWorkSituation[];
  supervisorByTeam: TeamWorkSituation[];
  workTeamByTeam: TeamWorkSituation[];
  companySituationByTeam: TeamWorkSituation[];
}

// Employee competency for 360 feedback
export interface Competency {
  name: string;
  selfScore: number;
  othersScore: number;
}

// Strength/Weakness item
export interface StrengthWeakness {
  text: string;
  score: number;
}

// Gap analysis item
export interface Gap {
  statement: string;
  selfScore: number;
  othersScore: number;
  diff: number;
}

// Employee data for 360 feedback
export interface Employee {
  id: string;
  name: string;
  competencies: Competency[];
  topStrengths?: StrengthWeakness[];
  topWeaknesses?: StrengthWeakness[];
  gaps?: Gap[];
  recommendations: string;
}

// Main result interface (union of both modes)
export interface FeedbackAnalysisResult {
  mode: AnalysisMode;
  reportMetadata: ReportMetadata;
  // For 360 feedback mode
  employees?: Employee[];
  // For satisfaction mode (legacy nested format, transformed from GenericAnalysisResult)
  satisfaction?: SatisfactionData;
  // For new cell-first architecture (raw data before transformation)
  genericData?: {
    metadata: GenericAnalysisResult['metadata'];
    teams: TeamMetadata[];
    cells: RawCell[];
    missingCells: MissingCellRecord[];
  };
}
