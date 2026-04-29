import { describe, expect, it } from 'vitest';
import {
  buildCompanyCompetenciesFromIndividuals,
  calculateOverallScores,
  derivePotentialFromGaps,
  deriveStrengthsAndDevelopment,
} from './feedback360Derivations';
import type { Feedback360IndividualReport } from '../types';

const individualsFixture: Feedback360IndividualReport[] = [
  {
    id: 'emp_1',
    name: 'Alica',
    competencies: [
      {
        id: 'strategy',
        label: 'Koncepčné riadenie',
        averages: {
          subordinate: 0,
          manager: 0,
          peer: 0,
          average: 4.2,
          self: 5.1,
        },
        statements: [
          {
            id: 's1',
            statement: 'Má strategické myslenie.',
            competencyId: 'strategy',
            competencyLabel: 'Koncepčné riadenie',
            averages: {
              subordinate: 0,
              manager: 0,
              peer: 0,
              average: 4.2,
              self: 5,
            },
            frequencyDistribution: {
              na: 0,
              one: 0,
              two: 0,
              three: 1,
              four: 2,
              five: 3,
              six: 2,
            },
          },
        ],
      },
      {
        id: 'execution',
        label: 'Orientácia na výsledok',
        averages: {
          subordinate: 0,
          manager: 0,
          peer: 0,
          average: 5.3,
          self: 5.7,
        },
        statements: [],
      },
    ],
    overestimatedPotential: [],
    hiddenPotential: [],
  },
  {
    id: 'emp_2',
    name: 'Boris',
    competencies: [
      {
        id: 'strategy',
        label: 'Koncepčné riadenie',
        averages: {
          subordinate: 0,
          manager: 0,
          peer: 0,
          average: 5.0,
          self: 4.2,
        },
        statements: [
          {
            id: 's1',
            statement: 'Má strategické myslenie.',
            competencyId: 'strategy',
            competencyLabel: 'Koncepčné riadenie',
            averages: {
              subordinate: 0,
              manager: 0,
              peer: 0,
              average: 5.0,
              self: 4.2,
            },
            frequencyDistribution: {
              na: 0,
              one: 0,
              two: 0,
              three: 0,
              four: 1,
              five: 4,
              six: 3,
            },
          },
          {
            id: 's2',
            statement: 'Zvažuje riziká pred rozhodnutím.',
            competencyId: 'strategy',
            competencyLabel: 'Koncepčné riadenie',
            averages: {
              subordinate: 0,
              manager: 0,
              peer: 0,
              average: 4.7,
              self: 4.4,
            },
          },
        ],
      },
    ],
    overestimatedPotential: [],
    hiddenPotential: [],
  },
];

describe('buildCompanyCompetenciesFromIndividuals', () => {
  it('aggregates competency averages and merges statement distributions', () => {
    const result = buildCompanyCompetenciesFromIndividuals(individualsFixture);

    expect(result).toHaveLength(2);

    const strategy = result.find((item) => item.id === 'strategy');
    expect(strategy).toBeTruthy();
    expect(strategy?.averages.average).toBe(4.6);
    expect(strategy?.averages.self).toBe(4.65);
    expect(strategy?.statements).toHaveLength(2);

    const strategicThinking = strategy?.statements.find((item) => item.id === 's1');
    expect(strategicThinking?.averages.average).toBe(4.6);
    expect(strategicThinking?.frequencyDistribution).toEqual({
      na: 0,
      one: 0,
      two: 0,
      three: 1,
      four: 3,
      five: 7,
      six: 5,
    });
  });
});

describe('deriveStrengthsAndDevelopment', () => {
  it('returns top and bottom items sorted by average', () => {
    const competencies = buildCompanyCompetenciesFromIndividuals(individualsFixture);
    const result = deriveStrengthsAndDevelopment(competencies, 2);

    expect(result.strengths).toHaveLength(2);
    expect(result.developmentNeeds).toHaveLength(2);
    expect(result.strengths[0].average).toBeGreaterThanOrEqual(result.strengths[1].average);
    expect(result.developmentNeeds[0].average).toBeLessThanOrEqual(
      result.developmentNeeds[1].average
    );
  });
});

describe('derivePotentialFromGaps', () => {
  it('splits positive and negative diffs and keeps the strongest differences', () => {
    const competencies = buildCompanyCompetenciesFromIndividuals(individualsFixture);
    const result = derivePotentialFromGaps(
      [
        {
          statement: 'Overuje ciele tímu. (Orientácia na výsledok)',
          selfScore: 6,
          othersScore: 4.9,
          diff: 1.1,
        },
        {
          statement: 'Je inovatívny. (Koncepčné riadenie)',
          selfScore: 3.5,
          othersScore: 5.2,
          diff: -1.7,
        },
      ],
      competencies,
      3
    );

    expect(result.overestimatedPotential).toHaveLength(1);
    expect(result.hiddenPotential).toHaveLength(1);
    expect(result.overestimatedPotential[0].diff).toBe(1.1);
    expect(result.hiddenPotential[0].diff).toBe(-1.7);
  });
});

describe('calculateOverallScores', () => {
  it('computes mean scores from competency averages', () => {
    const strategy = individualsFixture[0].competencies[0];
    const execution = individualsFixture[0].competencies[1];

    const result = calculateOverallScores([strategy, execution]);
    expect(result.overallAverage).toBe(4.75);
    expect(result.overallSelf).toBe(5.4);
  });
});
