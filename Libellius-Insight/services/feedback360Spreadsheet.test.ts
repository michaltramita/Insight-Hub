import { describe, expect, it } from 'vitest';
import { parseFeedback360Spreadsheet } from './feedback360Spreadsheet';

const createTextFile = (name: string, content: string, type = 'text/csv'): File => {
  const blob = new Blob([content], { type });
  return {
    name,
    size: blob.size,
    type,
    text: async () => content,
    arrayBuffer: async () => blob.arrayBuffer(),
  } as unknown as File;
};

describe('parseFeedback360Spreadsheet', () => {
  it('parses csv input and maps rows to feedback360 payload', async () => {
    const csv = [
      [
        'participant',
        'competency',
        'statement',
        'subordinate',
        'manager',
        'peer',
        'average',
        'self',
        'subordinatecount',
        'managercount',
        'peercount',
        'selfcount',
        'company',
        'survey',
        'date',
      ].join(','),
      [
        'Jana Nova',
        'Komunikacia',
        'Aktivne pocuva tim',
        '4.5',
        '4.4',
        '4.6',
        '4.5',
        '4.8',
        '8',
        '2',
        '6',
        '1',
        'GU Slovensko',
        '360 Pilot',
        '2026-04-10',
      ].join(','),
      [
        'Jana Nova',
        'Komunikacia',
        'Zdiela informacie nacas',
        '4.2',
        '4.3',
        '4.1',
        '4.2',
        '4.7',
        '8',
        '2',
        '6',
        '1',
        'GU Slovensko',
        '360 Pilot',
        '2026-04-10',
      ].join(','),
    ].join('\n');

    const file = createTextFile('feedback360.csv', csv);
    const parsed = await parseFeedback360Spreadsheet(file);

    expect(parsed.mode).toBe('360_FEEDBACK');
    expect(parsed.feedback360?.companyName).toBe('GU Slovensko');
    expect(parsed.feedback360?.surveyName).toBe('360 Pilot');
    expect(parsed.feedback360?.individuals).toHaveLength(1);
    expect(parsed.feedback360?.companyReport.respondentCounts).toEqual({
      subordinate: 8,
      manager: 2,
      peer: 6,
      self: 1,
    });

    const individual = parsed.feedback360?.individuals[0];
    expect(individual?.name).toBe('Jana Nova');
    expect(individual?.competencies).toHaveLength(1);
    expect(individual?.competencies[0].statements).toHaveLength(2);
  });

  it('throws when csv does not contain participant and competency data', async () => {
    const csv = ['foo,bar', 'a,b'].join('\n');
    const file = createTextFile('invalid.csv', csv);

    await expect(parseFeedback360Spreadsheet(file)).rejects.toThrow(
      'V Excel/CSV pre 360 neboli nájdené validné riadky.'
    );
  });

  it('throws for unsupported extension', async () => {
    const file = createTextFile('report.pdf', 'participant,competency\nA,B', 'application/pdf');

    await expect(parseFeedback360Spreadsheet(file)).rejects.toThrow(
      'Pre 360 analýzu sú podporované iba súbory .xlsx a .csv.'
    );
  });
});
