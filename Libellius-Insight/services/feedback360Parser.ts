import type {
  EmployeeProfile,
  Feedback360CompanyReport,
  Feedback360CompetencyResult,
  Feedback360Data,
  Feedback360FrequencyDistribution,
  Feedback360IndividualReport,
  Feedback360ImplementationPlan,
  Feedback360PotentialItem,
  Feedback360RaterAverages,
  Feedback360RespondentCounts,
  Feedback360StatementResult,
  Feedback360StrengthWeaknessItem,
  FeedbackAnalysisResult,
  GapData,
} from '../types';
import {
  buildCompanyCompetenciesFromIndividuals,
  calculateOverallScores,
  derivePotentialFromGaps,
  deriveStrengthsAndDevelopment,
} from './feedback360Derivations';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const clampNumber = (value: unknown, fallback = 0, min = 0, max = 6) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  if (numeric < min) return min;
  if (numeric > max) return max;
  return Number(numeric.toFixed(4));
};

const toText = (value: unknown, fallback = '') => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

const toIdToken = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'item';

const readNumber = (
  source: Record<string, unknown>,
  keys: string[],
  fallback = 0
) => {
  for (const key of keys) {
    if (!(key in source)) continue;
    const numeric = Number(source[key]);
    if (Number.isFinite(numeric)) return numeric;
  }
  return fallback;
};

const normalizeRaterAverages = (value: unknown): Feedback360RaterAverages => {
  const raw = isRecord(value) ? value : {};
  return {
    subordinate: clampNumber(
      readNumber(raw, ['subordinate', 'podriadeny', 'podriadený'], 0)
    ),
    manager: clampNumber(readNumber(raw, ['manager', 'nadriadeny', 'nadriadený'], 0)),
    peer: clampNumber(readNumber(raw, ['peer', 'kolega'], 0)),
    average: clampNumber(readNumber(raw, ['average', 'priemer'], 0)),
    self: clampNumber(readNumber(raw, ['self', 'sebahodnotenie'], 0)),
  };
};

const normalizeFrequencyDistribution = (
  value: unknown
): Feedback360FrequencyDistribution | undefined => {
  if (!isRecord(value)) return undefined;
  return {
    na: clampNumber(readNumber(value, ['na', 'n/a'], 0), 0, 0, Number.MAX_SAFE_INTEGER),
    one: clampNumber(readNumber(value, ['one', '1'], 0), 0, 0, Number.MAX_SAFE_INTEGER),
    two: clampNumber(readNumber(value, ['two', '2'], 0), 0, 0, Number.MAX_SAFE_INTEGER),
    three: clampNumber(
      readNumber(value, ['three', '3'], 0),
      0,
      0,
      Number.MAX_SAFE_INTEGER
    ),
    four: clampNumber(
      readNumber(value, ['four', '4'], 0),
      0,
      0,
      Number.MAX_SAFE_INTEGER
    ),
    five: clampNumber(
      readNumber(value, ['five', '5'], 0),
      0,
      0,
      Number.MAX_SAFE_INTEGER
    ),
    six: clampNumber(readNumber(value, ['six', '6'], 0), 0, 0, Number.MAX_SAFE_INTEGER),
  };
};

const normalizeRespondentCounts = (value: unknown): Feedback360RespondentCounts => {
  const raw = isRecord(value) ? value : {};
  return {
    subordinate: clampNumber(
      readNumber(raw, ['subordinate', 'podriadeny', 'podriadený'], 0),
      0,
      0,
      Number.MAX_SAFE_INTEGER
    ),
    manager: clampNumber(
      readNumber(raw, ['manager', 'nadriadeny', 'nadriadený'], 0),
      0,
      0,
      Number.MAX_SAFE_INTEGER
    ),
    peer: clampNumber(
      readNumber(raw, ['peer', 'kolega'], 0),
      0,
      0,
      Number.MAX_SAFE_INTEGER
    ),
    self: clampNumber(readNumber(raw, ['self', 'seba'], 0), 0, 0, Number.MAX_SAFE_INTEGER),
  };
};

const normalizeStatement = (
  value: unknown,
  competencyId: string,
  competencyLabel: string,
  index: number
): Feedback360StatementResult | null => {
  const raw = isRecord(value) ? value : {};
  const statement = toText(raw.statement ?? raw.text ?? raw.name, '');
  if (!statement) return null;

  const statementId = toText(
    raw.id ?? raw.statementId,
    `${competencyId}_statement_${index + 1}`
  );
  const averages =
    'averages' in raw
      ? normalizeRaterAverages(raw.averages)
      : normalizeRaterAverages(raw);

  return {
    id: statementId,
    statement,
    competencyId,
    competencyLabel,
    averages,
    frequencyDistribution: normalizeFrequencyDistribution(
      raw.frequencyDistribution ?? raw.distribution
    ),
  };
};

const normalizeCompetency = (
  value: unknown,
  index: number
): Feedback360CompetencyResult | null => {
  const raw = isRecord(value) ? value : {};
  const label = toText(raw.label ?? raw.title ?? raw.name, '');
  if (!label) return null;

  const id = toText(raw.id ?? raw.key, toIdToken(label) || `competency_${index + 1}`);
  const statementsRaw = Array.isArray(raw.statements) ? raw.statements : [];
  const statements = statementsRaw
    .map((statement, statementIndex) =>
      normalizeStatement(statement, id, label, statementIndex)
    )
    .filter((statement): statement is Feedback360StatementResult => statement !== null);

  const averages =
    'averages' in raw
      ? normalizeRaterAverages(raw.averages)
      : normalizeRaterAverages(raw);
  const hasAverageData = averages.average > 0 || averages.self > 0;

  let resolvedAverages = averages;
  if (!hasAverageData && statements.length > 0) {
    const statementAverage =
      statements.reduce((sum, statement) => sum + statement.averages.average, 0) /
      statements.length;
    const statementSelf =
      statements.reduce((sum, statement) => sum + statement.averages.self, 0) /
      statements.length;
    resolvedAverages = {
      ...averages,
      average: Number(statementAverage.toFixed(2)),
      self: Number(statementSelf.toFixed(2)),
    };
  }

  return {
    id,
    label,
    averages: resolvedAverages,
    statements,
    respondentCounts: normalizeRespondentCounts(raw.respondentCounts),
  };
};

const normalizeStrengthWeaknessItem = (
  value: unknown,
  index: number
): Feedback360StrengthWeaknessItem | null => {
  const raw = isRecord(value) ? value : {};
  const statement = toText(raw.statement ?? raw.text ?? raw.name, '');
  if (!statement) return null;

  const competencyLabel = toText(raw.competencyLabel ?? raw.area, 'Nezaradené');
  const competencyId = toText(raw.competencyId, toIdToken(competencyLabel));
  const statementId = toText(
    raw.statementId,
    `${competencyId}_${toIdToken(statement)}_${index + 1}`
  );

  return {
    statementId,
    statement,
    competencyId,
    competencyLabel,
    average: clampNumber(raw.average, 0),
  };
};

const normalizePotentialItem = (
  value: unknown,
  index: number
): Feedback360PotentialItem | null => {
  const raw = isRecord(value) ? value : {};
  const statement = toText(raw.statement ?? raw.text ?? raw.name, '');
  if (!statement) return null;

  const competencyLabel = toText(raw.competencyLabel ?? raw.area, 'Nezaradené');
  const competencyId = toText(raw.competencyId, toIdToken(competencyLabel));
  const average = clampNumber(raw.average ?? raw.othersScore, 0);
  const self = clampNumber(raw.self ?? raw.selfScore, 0);
  const diff = Number(clampNumber(raw.diff, self - average, -6, 6).toFixed(2));

  return {
    statementId: toText(raw.statementId, `${competencyId}_${toIdToken(statement)}_${index}`),
    statement,
    competencyId,
    competencyLabel,
    average,
    self,
    diff,
  };
};

const normalizeImplementationPlan = (
  value: unknown,
  participantName: string
): Feedback360ImplementationPlan => {
  const raw = isRecord(value) ? value : {};
  const prioritiesRaw = Array.isArray(raw.priorities) ? raw.priorities : [];
  const priorities = prioritiesRaw
    .map((priority) => toText(priority))
    .filter(Boolean)
    .slice(0, 10);

  return {
    participantName: toText(raw.participantName, participantName),
    date: toText(raw.date, ''),
    priorities,
  };
};

const mapLegacyCompetencies = (value: unknown): Feedback360CompetencyResult[] => {
  if (!Array.isArray(value)) return [];
  const mapped: Feedback360CompetencyResult[] = [];

  value.forEach((entry, index) => {
    const raw = isRecord(entry) ? entry : {};
    const label = toText(raw.name, '');
    if (!label) return;

    const self = clampNumber(raw.selfScore, 0);
    const average = clampNumber(raw.othersScore, 0);

    mapped.push({
      id: toIdToken(label) || `competency_${index + 1}`,
      label,
      averages: {
        subordinate: 0,
        manager: 0,
        peer: 0,
        average,
        self,
      },
      statements: [],
    });
  });

  return mapped;
};

const mapLegacyEmployee = (value: unknown, index: number): Feedback360IndividualReport | null => {
  const raw = isRecord(value) ? value : {};
  const name = toText(raw.name, '');
  if (!name) return null;

  const id = toText(raw.id, `employee_${index + 1}`);
  const competencies = mapLegacyCompetencies(raw.competencies);
  const legacyGaps = Array.isArray(raw.gaps) ? (raw.gaps as GapData[]) : [];
  const derivedPotential = derivePotentialFromGaps(legacyGaps, competencies, 3);

  return {
    id,
    name,
    competencies,
    overestimatedPotential: derivedPotential.overestimatedPotential,
    hiddenPotential: derivedPotential.hiddenPotential,
    implementationPlan: {
      participantName: name,
      date: '',
      priorities: [],
    },
  };
};

const mapNormalizedIndividual = (
  value: unknown,
  index: number
): Feedback360IndividualReport | null => {
  const raw = isRecord(value) ? value : {};
  const name = toText(raw.name, '');
  if (!name) return null;

  const id = toText(raw.id, `employee_${index + 1}`);
  const competenciesRaw = Array.isArray(raw.competencies) ? raw.competencies : [];
  const competencies = competenciesRaw
    .map((competency, competencyIndex) =>
      normalizeCompetency(competency, competencyIndex)
    )
    .filter((competency): competency is Feedback360CompetencyResult => competency !== null);

  const overestimatedPotentialRaw = Array.isArray(raw.overestimatedPotential)
    ? raw.overestimatedPotential
    : [];
  const hiddenPotentialRaw = Array.isArray(raw.hiddenPotential)
    ? raw.hiddenPotential
    : [];

  let overestimatedPotential = overestimatedPotentialRaw
    .map((item, itemIndex) => normalizePotentialItem(item, itemIndex))
    .filter((item): item is Feedback360PotentialItem => item !== null);
  let hiddenPotential = hiddenPotentialRaw
    .map((item, itemIndex) => normalizePotentialItem(item, itemIndex))
    .filter((item): item is Feedback360PotentialItem => item !== null);

  if (!overestimatedPotential.length && !hiddenPotential.length && Array.isArray(raw.gaps)) {
    const derived = derivePotentialFromGaps(raw.gaps as GapData[], competencies, 3);
    overestimatedPotential = derived.overestimatedPotential;
    hiddenPotential = derived.hiddenPotential;
  }

  return {
    id,
    name,
    competencies,
    overestimatedPotential,
    hiddenPotential,
    implementationPlan: normalizeImplementationPlan(raw.implementationPlan, name),
  };
};

const normalizeParticipantsFromIndividuals = (
  individuals: Feedback360IndividualReport[]
) =>
  individuals.map((individual) => {
    const { overallAverage, overallSelf } = calculateOverallScores(individual.competencies);
    return {
      id: individual.id,
      name: individual.name,
      competencies: individual.competencies,
      overallAverage,
      overallSelf,
    };
  });

const normalizeCompanyReport = (
  value: unknown,
  individuals: Feedback360IndividualReport[]
): Feedback360CompanyReport => {
  const raw = isRecord(value) ? value : {};

  const competenciesRaw = Array.isArray(raw.competencies) ? raw.competencies : [];
  const explicitCompetencies = competenciesRaw
    .map((competency, index) => normalizeCompetency(competency, index))
    .filter((competency): competency is Feedback360CompetencyResult => competency !== null);
  const competencies = explicitCompetencies.length
    ? explicitCompetencies
    : buildCompanyCompetenciesFromIndividuals(individuals);

  const strengthsRaw = Array.isArray(raw.strengths) ? raw.strengths : [];
  const developmentRaw = Array.isArray(raw.developmentNeeds)
    ? raw.developmentNeeds
    : Array.isArray(raw.weaknesses)
    ? raw.weaknesses
    : [];

  let strengths = strengthsRaw
    .map((item, index) => normalizeStrengthWeaknessItem(item, index))
    .filter((item): item is Feedback360StrengthWeaknessItem => item !== null);
  let developmentNeeds = developmentRaw
    .map((item, index) => normalizeStrengthWeaknessItem(item, index))
    .filter((item): item is Feedback360StrengthWeaknessItem => item !== null);

  if (!strengths.length && !developmentNeeds.length) {
    const derived = deriveStrengthsAndDevelopment(competencies, 5);
    strengths = derived.strengths;
    developmentNeeds = derived.developmentNeeds;
  }

  const participantsRaw = Array.isArray(raw.participants) ? raw.participants : [];
  const participants =
    participantsRaw.length > 0
      ? participantsRaw
          .map((participant, index) => {
            const participantRecord = isRecord(participant) ? participant : {};
            const name = toText(participantRecord.name, '');
            if (!name) return null;

            const participantCompetenciesRaw = Array.isArray(
              participantRecord.competencies
            )
              ? participantRecord.competencies
              : [];
            const participantCompetencies = participantCompetenciesRaw
              .map((competency, competencyIndex) =>
                normalizeCompetency(competency, competencyIndex)
              )
              .filter(
                (competency): competency is Feedback360CompetencyResult => competency !== null
              );
            const overall = calculateOverallScores(participantCompetencies);

            return {
              id: toText(participantRecord.id, `participant_${index + 1}`),
              name,
              competencies: participantCompetencies,
              overallAverage: clampNumber(participantRecord.overallAverage, overall.overallAverage),
              overallSelf: clampNumber(participantRecord.overallSelf, overall.overallSelf),
            };
          })
          .filter((participant) => participant !== null)
      : normalizeParticipantsFromIndividuals(individuals);

  return {
    respondentCounts: normalizeRespondentCounts(raw.respondentCounts),
    competencies,
    strengths,
    developmentNeeds,
    participants,
  };
};

const normalizeFeedback360Data = (
  value: unknown,
  reportMetadata: FeedbackAnalysisResult['reportMetadata'],
  fallbackIndividuals: Feedback360IndividualReport[] = []
): Feedback360Data => {
  const raw = isRecord(value) ? value : {};
  const individualsRaw = Array.isArray(raw.individuals) ? raw.individuals : [];
  const explicitIndividuals = individualsRaw
    .map((individual, index) => mapNormalizedIndividual(individual, index))
    .filter((individual): individual is Feedback360IndividualReport => individual !== null);
  const individuals = explicitIndividuals.length ? explicitIndividuals : fallbackIndividuals;

  return {
    companyName: toText(
      raw.companyName ?? raw.company ?? reportMetadata.company,
      reportMetadata.company || 'Neznáma firma'
    ),
    surveyName: toText(raw.surveyName ?? raw.survey, '360 spätná väzba'),
    scaleMax: clampNumber(raw.scaleMax, clampNumber(reportMetadata.scaleMax, 6), 1, 10),
    companyReport: normalizeCompanyReport(raw.companyReport, individuals),
    individuals,
  };
};

const normalizeReportMetadata = (
  value: unknown,
  fallbackCompany: string
): FeedbackAnalysisResult['reportMetadata'] => {
  const raw = isRecord(value) ? value : {};
  return {
    date: toText(raw.date, new Date().getFullYear().toString()),
    company: toText(raw.company, fallbackCompany),
    scaleMax: clampNumber(raw.scaleMax, 6, 1, 10),
  };
};

export const parseFeedback360Report = (input: unknown): FeedbackAnalysisResult => {
  if (!isRecord(input)) {
    throw new Error('Neplatná štruktúra 360 reportu.');
  }

  const fallbackCompany = toText(input.company, 'Neznáma firma');
  const reportMetadata = normalizeReportMetadata(input.reportMetadata, fallbackCompany);

  if (isRecord(input.feedback360)) {
    const feedback360 = normalizeFeedback360Data(input.feedback360, reportMetadata);
    return {
      mode: '360_FEEDBACK',
      reportMetadata,
      feedback360,
    };
  }

  if (Array.isArray(input.individuals) || isRecord(input.companyReport)) {
    const feedback360 = normalizeFeedback360Data(input, reportMetadata);
    return {
      mode: '360_FEEDBACK',
      reportMetadata,
      feedback360,
    };
  }

  if (Array.isArray(input.employees)) {
    const legacyEmployees = input.employees
      .map((employee, index) => mapLegacyEmployee(employee, index))
      .filter((employee): employee is Feedback360IndividualReport => employee !== null);

    if (!legacyEmployees.length) {
      throw new Error('V 360 reporte chýbajú validní účastníci.');
    }

    const feedback360 = normalizeFeedback360Data(
      {
        companyName: reportMetadata.company || fallbackCompany,
        surveyName: '360 spätná väzba',
        scaleMax: reportMetadata.scaleMax,
        individuals: legacyEmployees,
      },
      reportMetadata,
      legacyEmployees
    );

    return {
      mode: '360_FEEDBACK',
      reportMetadata,
      employees: input.employees as EmployeeProfile[],
      feedback360,
    };
  }

  throw new Error(
    '360 report má neznámy formát. Očakáva sa "feedback360", "individuals/companyReport" alebo legacy "employees".'
  );
};
