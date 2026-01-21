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
  sentCount: number; 
}

export interface SatisfactionMetric {
  category: string;
  score: number;
}

export interface TeamWorkSituation {
  teamName: string;
  metrics: SatisfactionMetric[];
}

// --- NOVÝ INTERFACE PRE DYNAMICKÉ KATEGÓRIE ---
export interface SatisfactionCategory {
  categoryName: string; // Tu bude napr. "Pracovná situácia", "Benefity" atď.
  teams: TeamWorkSituation[];
}

// --- UPRAVENÝ INTERFACE PRE SPOKOJNOSŤ ---
export interface EmployeeSatisfactionData {
  clientName: string;
  totalSent: number;
  totalReceived: number;
  successRate: string;
  teamEngagement: EngagementTeam[];
  // Odstránili sme fixné polia a nahradili ich týmto:
  categories: SatisfactionCategory[]; 
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
