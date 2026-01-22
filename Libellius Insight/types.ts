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
  count: number; // Počet prijatých
}

export interface SatisfactionMetric {
  category: string; // Otázka
  score: number;   // Hodnota
}

export interface TeamWorkSituation {
  teamName: string;
  metrics: SatisfactionMetric[];
}

// Nový interface pre dynamickú kartu
export interface SatisfactionCard {
  title: string; // Dynamický názov z Excelu (stĺpec 'oblast')
  teams: TeamWorkSituation[];
}

export interface EmployeeSatisfactionData {
  clientName: string;
  totalSent: number;
  totalReceived: number;
  successRate: string;
  teamEngagement: EngagementTeam[];
  // Anonymné karty namiesto fixných názvov
  card1: SatisfactionCard;
  card2: SatisfactionCard;
  card3: SatisfactionCard;
  card4: SatisfactionCard;
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
