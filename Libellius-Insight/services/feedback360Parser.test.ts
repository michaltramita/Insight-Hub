import { describe, expect, it } from 'vitest';
import { parseFeedback360Report } from './feedback360Parser';

describe('parseFeedback360Report', () => {
  it('parses normalized feedback360 payload in wrapper format', () => {
    const parsed = parseFeedback360Report({
      mode: '360_FEEDBACK',
      reportMetadata: {
        date: '2026-04-10',
        company: 'Libellius',
        scaleMax: 6,
      },
      feedback360: {
        companyName: 'Libellius',
        surveyName: '360 Test',
        scaleMax: 6,
        companyReport: {
          respondentCounts: {
            subordinate: 12,
            manager: 3,
            peer: 10,
            self: 4,
          },
          competencies: [
            {
              id: 'strategy',
              label: 'Koncepčné riadenie',
              averages: {
                subordinate: 5.2,
                manager: 4.8,
                peer: 5.1,
                average: 5.03,
                self: 5,
              },
              statements: [
                {
                  id: 's1',
                  statement: 'Má strategický prístup.',
                  averages: {
                    average: 5.1,
                    self: 5,
                  },
                },
              ],
            },
          ],
        },
        individuals: [
          {
            id: 'person_1',
            name: 'Test User',
            competencies: [
              {
                id: 'strategy',
                label: 'Koncepčné riadenie',
                averages: {
                  average: 5.1,
                  self: 5,
                },
                statements: [],
              },
            ],
            overestimatedPotential: [
              {
                statementId: 's1',
                statement: 'Má strategický prístup.',
                competencyId: 'strategy',
                competencyLabel: 'Koncepčné riadenie',
                average: 4.8,
                self: 5.5,
                diff: 0.7,
              },
            ],
            hiddenPotential: [],
          },
        ],
      },
    });

    expect(parsed.mode).toBe('360_FEEDBACK');
    expect(parsed.feedback360?.companyName).toBe('Libellius');
    expect(parsed.feedback360?.companyReport.competencies).toHaveLength(1);
    expect(parsed.feedback360?.individuals).toHaveLength(1);
    expect(parsed.feedback360?.individuals[0].name).toBe('Test User');
  });

  it('parses top-level feedback360 fields without wrapper', () => {
    const parsed = parseFeedback360Report({
      reportMetadata: {
        date: '2026-04-10',
        company: 'Libellius',
      },
      companyName: 'Libellius',
      surveyName: 'Top-level test',
      scaleMax: 6,
      individuals: [
        {
          id: 'emp_1',
          name: 'Alica',
          competencies: [
            {
              id: 'execution',
              label: 'Orientácia na výsledok',
              averages: {
                average: 5.2,
                self: 5.4,
              },
            },
          ],
          overestimatedPotential: [],
          hiddenPotential: [],
        },
      ],
      companyReport: {
        respondentCounts: {
          subordinate: 1,
          manager: 1,
          peer: 1,
        },
        competencies: [],
      },
    });

    expect(parsed.feedback360?.surveyName).toBe('Top-level test');
    expect(parsed.feedback360?.individuals[0].id).toBe('emp_1');
    expect(parsed.feedback360?.companyReport.competencies.length).toBeGreaterThan(0);
  });

  it('converts legacy employees payload and derives feedback360 structure', () => {
    const parsed = parseFeedback360Report({
      mode: '360_FEEDBACK',
      reportMetadata: {
        date: '2026-04-10',
        company: 'Legacy Co',
        scaleMax: 6,
      },
      employees: [
        {
          id: 'legacy_1',
          name: 'Legacy User',
          competencies: [
            {
              name: 'Koncepčné riadenie',
              selfScore: 5.5,
              othersScore: 4.8,
            },
          ],
          topStrengths: [],
          topWeaknesses: [],
          recommendations: '',
          gaps: [
            {
              statement: 'Má strategický prístup. (Koncepčné riadenie)',
              selfScore: 5.5,
              othersScore: 4.8,
              diff: 0.7,
            },
          ],
        },
      ],
    });

    expect(parsed.mode).toBe('360_FEEDBACK');
    expect(parsed.feedback360?.companyName).toBe('Legacy Co');
    expect(parsed.feedback360?.individuals).toHaveLength(1);
    expect(parsed.feedback360?.companyReport.participants).toHaveLength(1);
    expect(parsed.feedback360?.individuals[0].overestimatedPotential).toHaveLength(1);
  });

  it('throws when payload is not object or has unknown shape', () => {
    expect(() => parseFeedback360Report(null)).toThrow('Neplatná štruktúra 360 reportu.');
    expect(() => parseFeedback360Report({ foo: 'bar' })).toThrow(
      '360 report má neznámy formát.'
    );
  });
});
