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
  count: number; // Received/Filled count
  sentCount: number; // Sent count
}

export interface SatisfactionMetric {
  category: string;
  score: number;
}

export interface TeamWorkSituation {
  teamName: string;
  metrics: SatisfactionMetric[];
}

export interface EmployeeSatisfactionData {
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
