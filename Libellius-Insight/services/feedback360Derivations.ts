import type {
  Feedback360CompetencyResult,
  Feedback360FrequencyDistribution,
  Feedback360IndividualReport,
  Feedback360PotentialItem,
  Feedback360RaterAverages,
  Feedback360StrengthWeaknessItem,
  GapData,
} from '../types';

const clampNumber = (value: unknown, fallback = 0, min = 0, max = 6) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  if (numeric < min) return min;
  if (numeric > max) return max;
  return Number(numeric.toFixed(4));
};

const toIdToken = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'item';

const createZeroAverages = (): Feedback360RaterAverages => ({
  subordinate: 0,
  manager: 0,
  peer: 0,
  average: 0,
  self: 0,
});

const mergeDistribution = (
  target: Feedback360FrequencyDistribution | undefined,
  source: Feedback360FrequencyDistribution | undefined
) => {
  if (!source) return target;
  if (!target) {
    return {
      na: source.na,
      one: source.one,
      two: source.two,
      three: source.three,
      four: source.four,
      five: source.five,
      six: source.six,
    };
  }

  return {
    na: target.na + source.na,
    one: target.one + source.one,
    two: target.two + source.two,
    three: target.three + source.three,
    four: target.four + source.four,
    five: target.five + source.five,
    six: target.six + source.six,
  };
};

const normalizeAverages = (
  averages: Partial<Feedback360RaterAverages> | undefined
): Feedback360RaterAverages => ({
  subordinate: clampNumber(averages?.subordinate),
  manager: clampNumber(averages?.manager),
  peer: clampNumber(averages?.peer),
  average: clampNumber(averages?.average),
  self: clampNumber(averages?.self),
});

export const calculateOverallScores = (
  competencies: Feedback360CompetencyResult[]
) => {
  if (!competencies.length) {
    return { overallAverage: 0, overallSelf: 0 };
  }

  const totalAverage = competencies.reduce(
    (sum, competency) => sum + clampNumber(competency.averages?.average),
    0
  );
  const totalSelf = competencies.reduce(
    (sum, competency) => sum + clampNumber(competency.averages?.self),
    0
  );

  return {
    overallAverage: Number((totalAverage / competencies.length).toFixed(2)),
    overallSelf: Number((totalSelf / competencies.length).toFixed(2)),
  };
};

export const buildCompanyCompetenciesFromIndividuals = (
  individuals: Feedback360IndividualReport[]
): Feedback360CompetencyResult[] => {
  const competencyMap = new Map<
    string,
    {
      id: string;
      label: string;
      count: number;
      sums: Feedback360RaterAverages;
      statements: Map<
        string,
        {
          id: string;
          statement: string;
          count: number;
          sums: Feedback360RaterAverages;
          distribution?: Feedback360FrequencyDistribution;
        }
      >;
    }
  >();

  for (const individual of individuals) {
    for (const competency of individual.competencies || []) {
      const competencyKey = competency.id || toIdToken(competency.label);
      if (!competencyMap.has(competencyKey)) {
        competencyMap.set(competencyKey, {
          id: competency.id || competencyKey,
          label: competency.label || competency.id || 'Kompetencia',
          count: 0,
          sums: createZeroAverages(),
          statements: new Map(),
        });
      }

      const bucket = competencyMap.get(competencyKey)!;
      const averages = normalizeAverages(competency.averages);
      bucket.count += 1;
      bucket.sums.subordinate += averages.subordinate;
      bucket.sums.manager += averages.manager;
      bucket.sums.peer += averages.peer;
      bucket.sums.average += averages.average;
      bucket.sums.self += averages.self;

      for (const statement of competency.statements || []) {
        const statementKey =
          statement.id ||
          `${competencyKey}:${toIdToken(statement.statement || '')}`;
        if (!bucket.statements.has(statementKey)) {
          bucket.statements.set(statementKey, {
            id: statement.id || statementKey,
            statement: statement.statement || '',
            count: 0,
            sums: createZeroAverages(),
            distribution: undefined,
          });
        }

        const statementBucket = bucket.statements.get(statementKey)!;
        const statementAverages = normalizeAverages(statement.averages);

        statementBucket.count += 1;
        statementBucket.sums.subordinate += statementAverages.subordinate;
        statementBucket.sums.manager += statementAverages.manager;
        statementBucket.sums.peer += statementAverages.peer;
        statementBucket.sums.average += statementAverages.average;
        statementBucket.sums.self += statementAverages.self;
        statementBucket.distribution = mergeDistribution(
          statementBucket.distribution,
          statement.frequencyDistribution
        );
      }
    }
  }

  return Array.from(competencyMap.values())
    .map((bucket): Feedback360CompetencyResult => {
      const divisor = Math.max(1, bucket.count);
      const statements = Array.from(bucket.statements.values()).map((statementBucket) => {
        const statementDivisor = Math.max(1, statementBucket.count);
        return {
          id: statementBucket.id,
          statement: statementBucket.statement,
          competencyId: bucket.id,
          competencyLabel: bucket.label,
          averages: {
            subordinate: Number(
              (statementBucket.sums.subordinate / statementDivisor).toFixed(2)
            ),
            manager: Number((statementBucket.sums.manager / statementDivisor).toFixed(2)),
            peer: Number((statementBucket.sums.peer / statementDivisor).toFixed(2)),
            average: Number((statementBucket.sums.average / statementDivisor).toFixed(2)),
            self: Number((statementBucket.sums.self / statementDivisor).toFixed(2)),
          },
          frequencyDistribution: statementBucket.distribution,
        };
      });

      return {
        id: bucket.id,
        label: bucket.label,
        averages: {
          subordinate: Number((bucket.sums.subordinate / divisor).toFixed(2)),
          manager: Number((bucket.sums.manager / divisor).toFixed(2)),
          peer: Number((bucket.sums.peer / divisor).toFixed(2)),
          average: Number((bucket.sums.average / divisor).toFixed(2)),
          self: Number((bucket.sums.self / divisor).toFixed(2)),
        },
        statements,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, 'sk'));
};

export const deriveStrengthsAndDevelopment = (
  competencies: Feedback360CompetencyResult[],
  limit = 5
) => {
  const statementPool = competencies.flatMap((competency) =>
    (competency.statements || []).map((statement) => ({
      statementId: statement.id || `${competency.id}_${toIdToken(statement.statement)}`,
      statement: statement.statement,
      competencyId: competency.id,
      competencyLabel: competency.label,
      average: clampNumber(statement.averages?.average),
    }))
  );

  const fallbackCompetencyPool = competencies.map((competency) => ({
    statementId: `${competency.id}_summary`,
    statement: competency.label,
    competencyId: competency.id,
    competencyLabel: competency.label,
    average: clampNumber(competency.averages?.average),
  }));

  const basePool = statementPool.length > 0 ? statementPool : fallbackCompetencyPool;

  const strengths: Feedback360StrengthWeaknessItem[] = [...basePool]
    .sort((a, b) => b.average - a.average)
    .slice(0, limit);

  const developmentNeeds: Feedback360StrengthWeaknessItem[] = [...basePool]
    .sort((a, b) => a.average - b.average)
    .slice(0, limit);

  return { strengths, developmentNeeds };
};

const extractCompetencyFromStatement = (statement: string) => {
  const text = String(statement || '').trim();
  const match = text.match(/\(([^()]+)\)\s*$/);
  if (!match?.[1]) return '';
  return match[1].trim();
};

export const derivePotentialFromGaps = (
  gaps: GapData[],
  competencies: Feedback360CompetencyResult[],
  limit = 3
) => {
  const mapped: Feedback360PotentialItem[] = (gaps || []).map((gap) => {
    const inferredCompetencyLabel = extractCompetencyFromStatement(gap.statement);
    const matchedCompetency = competencies.find(
      (competency) =>
        competency.label === inferredCompetencyLabel ||
        competency.label.includes(inferredCompetencyLabel)
    );

    const competencyLabel =
      inferredCompetencyLabel || matchedCompetency?.label || 'Nezaradené';
    const competencyId =
      matchedCompetency?.id || toIdToken(competencyLabel || 'competency');
    const statementId = toIdToken(gap.statement || `${competencyId}_statement`);
    const average = clampNumber(gap.othersScore);
    const self = clampNumber(gap.selfScore);
    const diff = Number((self - average).toFixed(2));

    return {
      statementId,
      statement: gap.statement,
      competencyId,
      competencyLabel,
      average,
      self,
      diff,
    };
  });

  const overestimatedPotential = mapped
    .filter((item) => item.diff > 0)
    .sort((a, b) => b.diff - a.diff)
    .slice(0, limit);

  const hiddenPotential = mapped
    .filter((item) => item.diff < 0)
    .sort((a, b) => a.diff - b.diff)
    .slice(0, limit);

  return { overestimatedPotential, hiddenPotential };
};
