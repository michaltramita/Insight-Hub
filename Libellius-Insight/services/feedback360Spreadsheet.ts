import { CellValue, Workbook } from 'exceljs';
import * as Papa from 'papaparse';
import { MAX_EXCEL_FILE_BYTES, MAX_HEADER_LENGTH } from './gemini/constants';
import {
  clampErrorMessage,
  clampString,
  ensureSpreadsheetLimits,
  normalizeHeaderName,
  toPlainCellValue,
} from './gemini/shared';
import type {
  Feedback360FrequencyDistribution,
  Feedback360RaterAverages,
  FeedbackAnalysisResult,
} from '../types';
import { parseFeedback360Report } from './feedback360Parser';

type SpreadsheetRow = Record<string, unknown>;
type NormalizedRow = Record<string, unknown>;

type NumericAggregation = {
  sum: number;
  count: number;
};

type StatementAggregation = {
  id: string;
  statement: string;
  averages: {
    subordinate: NumericAggregation;
    manager: NumericAggregation;
    peer: NumericAggregation;
    average: NumericAggregation;
    self: NumericAggregation;
  };
  frequencyDistribution: Feedback360FrequencyDistribution;
};

type CompetencyAggregation = {
  id: string;
  label: string;
  averages: {
    subordinate: NumericAggregation;
    manager: NumericAggregation;
    peer: NumericAggregation;
    average: NumericAggregation;
    self: NumericAggregation;
  };
  statements: Map<string, StatementAggregation>;
};

type ParticipantAggregation = {
  id: string;
  name: string;
  competencies: Map<string, CompetencyAggregation>;
};

const KEY_ALIASES = {
  participant: [
    'participant',
    'participantname',
    'person',
    'personname',
    'meno',
    'zamestnanec',
    'hodnoteny',
    'hodnotenyclovek',
    'employee',
    'employeeid',
    'employee_name',
    'name',
  ],
  competency: [
    'competency',
    'competencyname',
    'kompetencia',
    'oblast',
    'oblasthodnotenia',
    'area',
    'category',
  ],
  statement: [
    'statement',
    'statementtext',
    'tvrdenie',
    'otazka',
    'question',
    'questiontext',
    'item',
    'prejav',
  ],
  subordinate: [
    'subordinate',
    'subordinates',
    'podriadeny',
    'podriadeni',
    'subordinateavg',
    'podriadenypriemer',
  ],
  manager: [
    'manager',
    'superior',
    'nadriadeny',
    'nadriadeni',
    'manageravg',
    'nadriadenypriemer',
  ],
  peer: ['peer', 'colleague', 'kolega', 'kolegovia', 'peeravg', 'kolegapriemer'],
  average: ['average', 'avg', 'priemer', 'overallaverage', 'mean'],
  self: ['self', 'selfscore', 'sebahodnotenie', 'selfevaluation', 'seba'],
  subordinateCount: [
    'subordinatecount',
    'subordinatescount',
    'podriadenypocet',
    'podriadenipocet',
    'subordinate_n',
  ],
  managerCount: [
    'managercount',
    'superiorcount',
    'nadriadenypocet',
    'nadriadenipocet',
    'manager_n',
  ],
  peerCount: ['peercount', 'colleaguecount', 'kolegapocet', 'kolegoviapocet', 'peer_n'],
  selfCount: ['selfcount', 'sebapocet', 'self_n'],
  company: ['company', 'companyname', 'firma', 'nazovfirmy', 'nazov_firmy'],
  survey: ['survey', 'surveyname', 'prieskum', 'nazovprieskumu', 'nazov_prieskumu'],
  date: ['date', 'datum', 'reportdate'],
  scaleMax: ['scalemax', 'maxscale', 'max_skala', 'maxskala'],
  frequencyNA: ['na', 'n/a', 'neviem', 'freqna', 'countna'],
  frequencyOne: ['1', 'one', 'freq1', 'count1', 'na1', 'value1'],
  frequencyTwo: ['2', 'two', 'freq2', 'count2', 'na2', 'value2'],
  frequencyThree: ['3', 'three', 'freq3', 'count3', 'na3', 'value3'],
  frequencyFour: ['4', 'four', 'freq4', 'count4', 'na4', 'value4'],
  frequencyFive: ['5', 'five', 'freq5', 'count5', 'na5', 'value5'],
  frequencySix: ['6', 'six', 'freq6', 'count6', 'na6', 'value6'],
} as const;

const createNumericAggregation = (): NumericAggregation => ({
  sum: 0,
  count: 0,
});

const createFrequencyDistribution = (): Feedback360FrequencyDistribution => ({
  na: 0,
  one: 0,
  two: 0,
  three: 0,
  four: 0,
  five: 0,
  six: 0,
});

const normalizeKey = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const toIdToken = (value: string) =>
  normalizeKey(value).replace(/^_+|_+$/g, '') || 'item';

const parseNumeric = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const normalized = value.replace(',', '.').trim();
    if (!normalized) return null;
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
};

const addValue = (target: NumericAggregation, value: number | null) => {
  if (!Number.isFinite(value ?? NaN)) return;
  target.sum += Number(value);
  target.count += 1;
};

const readAverage = (aggregation: NumericAggregation) =>
  aggregation.count > 0 ? Number((aggregation.sum / aggregation.count).toFixed(2)) : 0;

const normalizeRow = (row: SpreadsheetRow): NormalizedRow => {
  const normalized: NormalizedRow = {};
  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalizeKey(key);
    if (!normalizedKey) continue;

    if (!(normalizedKey in normalized)) {
      normalized[normalizedKey] = value;
      continue;
    }

    const existing = normalized[normalizedKey];
    const existingText = String(existing ?? '').trim();
    const nextText = String(value ?? '').trim();
    if (!existingText && nextText) {
      normalized[normalizedKey] = value;
    }
  }
  return normalized;
};

const findValue = (row: NormalizedRow, aliases: readonly string[]) => {
  for (const alias of aliases) {
    const exact = row[alias];
    if (exact !== undefined && String(exact ?? '').trim() !== '') {
      return exact;
    }
  }

  for (const [key, value] of Object.entries(row)) {
    if (String(value ?? '').trim() === '') continue;
    if (aliases.some((alias) => key.startsWith(alias))) {
      return value;
    }
  }

  return undefined;
};

const readText = (row: NormalizedRow, aliases: readonly string[], fallback = '') =>
  String(findValue(row, aliases) ?? fallback).trim();

const readNumber = (row: NormalizedRow, aliases: readonly string[]): number | null => {
  const value = findValue(row, aliases);
  return parseNumeric(value);
};

const readFrequencyDistribution = (
  row: NormalizedRow
): Feedback360FrequencyDistribution | undefined => {
  const distribution: Feedback360FrequencyDistribution = {
    na: Number(readNumber(row, KEY_ALIASES.frequencyNA) || 0),
    one: Number(readNumber(row, KEY_ALIASES.frequencyOne) || 0),
    two: Number(readNumber(row, KEY_ALIASES.frequencyTwo) || 0),
    three: Number(readNumber(row, KEY_ALIASES.frequencyThree) || 0),
    four: Number(readNumber(row, KEY_ALIASES.frequencyFour) || 0),
    five: Number(readNumber(row, KEY_ALIASES.frequencyFive) || 0),
    six: Number(readNumber(row, KEY_ALIASES.frequencySix) || 0),
  };

  const hasAnyValue = Object.values(distribution).some((value) => value > 0);
  return hasAnyValue ? distribution : undefined;
};

const readRowsFromSpreadsheet = async (file: File): Promise<SpreadsheetRow[]> => {
  if (!file || file.size <= 0) {
    throw new Error('Súbor je prázdny.');
  }
  if (file.size > MAX_EXCEL_FILE_BYTES) {
    throw new Error('Excel/CSV súbor je príliš veľký (max. 12 MB).');
  }

  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  if (extension === 'xls') {
    throw new Error('Formát .xls už nepodporujeme. Uložte súbor ako .xlsx alebo .csv.');
  }
  if (extension !== 'xlsx' && extension !== 'csv') {
    throw new Error('Pre 360 analýzu sú podporované iba súbory .xlsx a .csv.');
  }

  if (extension === 'csv') {
    const text = await file.text();
    const parsed = Papa.parse<SpreadsheetRow>(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      transformHeader: (header: string) => clampString(header, MAX_HEADER_LENGTH),
    });

    if (parsed.errors.length > 0) {
      const firstError = parsed.errors[0];
      throw new Error(
        `CSV súbor sa nepodarilo načítať: ${clampErrorMessage(
          firstError?.message || 'neznáma chyba'
        )}`
      );
    }

    const columnCount = parsed.meta.fields?.length || 0;
    const rowCount = parsed.data.length + (columnCount > 0 ? 1 : 0);
    ensureSpreadsheetLimits(rowCount, columnCount);
    return parsed.data;
  }

  const workbook = new Workbook();
  const data = await file.arrayBuffer();
  await workbook.xlsx.load(data);

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new Error('Súbor neobsahuje žiadny hárok.');
  }

  const rowCount = sheet.actualRowCount;
  const columnCount = sheet.actualColumnCount;
  if (rowCount <= 0 || columnCount <= 0) {
    throw new Error('Prvý hárok neobsahuje čitateľné dáta.');
  }

  ensureSpreadsheetLimits(rowCount, columnCount);

  const usedHeaders = new Set<string>();
  const headerRow = sheet.getRow(1);
  const headers = Array.from({ length: columnCount }, (_, colIndex) =>
    normalizeHeaderName(
      toPlainCellValue(headerRow.getCell(colIndex + 1).value as CellValue),
      `column_${colIndex + 1}`,
      usedHeaders
    )
  );

  const rows: SpreadsheetRow[] = [];
  for (let rowIndex = 2; rowIndex <= rowCount; rowIndex += 1) {
    const row = sheet.getRow(rowIndex);
    const parsedRow: SpreadsheetRow = {};
    let hasAnyValue = false;

    for (let colIndex = 1; colIndex <= columnCount; colIndex += 1) {
      const headerName = headers[colIndex - 1];
      if (!headerName) continue;
      const value = toPlainCellValue(row.getCell(colIndex).value as CellValue);
      if (value !== null && value !== '') {
        hasAnyValue = true;
      }
      parsedRow[headerName] = value;
    }

    if (hasAnyValue) {
      rows.push(parsedRow);
    }
  }

  return rows;
};

const toRaterAverages = (source: {
  subordinate: NumericAggregation;
  manager: NumericAggregation;
  peer: NumericAggregation;
  average: NumericAggregation;
  self: NumericAggregation;
}): Feedback360RaterAverages => ({
  subordinate: readAverage(source.subordinate),
  manager: readAverage(source.manager),
  peer: readAverage(source.peer),
  average: readAverage(source.average),
  self: readAverage(source.self),
});

const ensureCompetencyAggregation = (
  participant: ParticipantAggregation,
  competencyLabel: string
): CompetencyAggregation => {
  const competencyId = toIdToken(competencyLabel);
  const existing = participant.competencies.get(competencyId);
  if (existing) return existing;

  const created: CompetencyAggregation = {
    id: competencyId,
    label: competencyLabel,
    averages: {
      subordinate: createNumericAggregation(),
      manager: createNumericAggregation(),
      peer: createNumericAggregation(),
      average: createNumericAggregation(),
      self: createNumericAggregation(),
    },
    statements: new Map(),
  };
  participant.competencies.set(competencyId, created);
  return created;
};

const ensureStatementAggregation = (
  competency: CompetencyAggregation,
  statementText: string
): StatementAggregation => {
  const statementId = toIdToken(statementText);
  const existing = competency.statements.get(statementId);
  if (existing) return existing;

  const created: StatementAggregation = {
    id: statementId,
    statement: statementText,
    averages: {
      subordinate: createNumericAggregation(),
      manager: createNumericAggregation(),
      peer: createNumericAggregation(),
      average: createNumericAggregation(),
      self: createNumericAggregation(),
    },
    frequencyDistribution: createFrequencyDistribution(),
  };
  competency.statements.set(statementId, created);
  return created;
};

const detectScaleMax = (
  normalizedRows: NormalizedRow[],
  explicitScaleMax: number | null
) => {
  if (Number.isFinite(explicitScaleMax ?? NaN) && Number(explicitScaleMax) > 0) {
    return Math.max(1, Math.min(10, Number(explicitScaleMax)));
  }

  let maxValue = 0;
  for (const row of normalizedRows) {
    const values = [
      readNumber(row, KEY_ALIASES.subordinate),
      readNumber(row, KEY_ALIASES.manager),
      readNumber(row, KEY_ALIASES.peer),
      readNumber(row, KEY_ALIASES.average),
      readNumber(row, KEY_ALIASES.self),
    ];
    for (const value of values) {
      if (Number.isFinite(value ?? NaN)) {
        maxValue = Math.max(maxValue, Number(value));
      }
    }
  }

  if (maxValue > 5.2) return 6;
  if (maxValue > 0) return 5;
  return 6;
};

const buildPayloadFromRows = (
  rows: SpreadsheetRow[],
  sourceFileName: string
): Record<string, unknown> => {
  const normalizedRows = rows.map(normalizeRow);

  const companyName =
    normalizedRows
      .map((row) => readText(row, KEY_ALIASES.company))
      .find((value) => value.length > 0) || '';

  const surveyName =
    normalizedRows
      .map((row) => readText(row, KEY_ALIASES.survey))
      .find((value) => value.length > 0) || '';

  const reportDate =
    normalizedRows
      .map((row) => readText(row, KEY_ALIASES.date))
      .find((value) => value.length > 0) || new Date().toISOString().slice(0, 10);

  const explicitScaleMax =
    normalizedRows
      .map((row) => readNumber(row, KEY_ALIASES.scaleMax))
      .find((value) => Number.isFinite(value ?? NaN) && Number(value) > 0) ?? null;
  const scaleMax = detectScaleMax(normalizedRows, explicitScaleMax);

  let subordinateCount = 0;
  let managerCount = 0;
  let peerCount = 0;
  let selfCount = 0;

  const participantMap = new Map<string, ParticipantAggregation>();

  for (const row of normalizedRows) {
    subordinateCount = Math.max(
      subordinateCount,
      Number(readNumber(row, KEY_ALIASES.subordinateCount) || 0)
    );
    managerCount = Math.max(
      managerCount,
      Number(readNumber(row, KEY_ALIASES.managerCount) || 0)
    );
    peerCount = Math.max(peerCount, Number(readNumber(row, KEY_ALIASES.peerCount) || 0));
    selfCount = Math.max(selfCount, Number(readNumber(row, KEY_ALIASES.selfCount) || 0));

    const participantName = readText(row, KEY_ALIASES.participant);
    const competencyLabel = readText(row, KEY_ALIASES.competency);
    if (!participantName || !competencyLabel) continue;

    const participantId = toIdToken(participantName);
    if (!participantMap.has(participantId)) {
      participantMap.set(participantId, {
        id: participantId,
        name: participantName,
        competencies: new Map(),
      });
    }

    const participant = participantMap.get(participantId)!;
    const competency = ensureCompetencyAggregation(participant, competencyLabel);

    const subordinate = readNumber(row, KEY_ALIASES.subordinate);
    const manager = readNumber(row, KEY_ALIASES.manager);
    const peer = readNumber(row, KEY_ALIASES.peer);
    const average = readNumber(row, KEY_ALIASES.average);
    const self = readNumber(row, KEY_ALIASES.self);

    const statementText = readText(row, KEY_ALIASES.statement);
    const distribution = readFrequencyDistribution(row);

    if (statementText) {
      const statement = ensureStatementAggregation(competency, statementText);
      addValue(statement.averages.subordinate, subordinate);
      addValue(statement.averages.manager, manager);
      addValue(statement.averages.peer, peer);
      addValue(statement.averages.average, average);
      addValue(statement.averages.self, self);

      if (distribution) {
        statement.frequencyDistribution.na += distribution.na;
        statement.frequencyDistribution.one += distribution.one;
        statement.frequencyDistribution.two += distribution.two;
        statement.frequencyDistribution.three += distribution.three;
        statement.frequencyDistribution.four += distribution.four;
        statement.frequencyDistribution.five += distribution.five;
        statement.frequencyDistribution.six += distribution.six;
      }
      continue;
    }

    addValue(competency.averages.subordinate, subordinate);
    addValue(competency.averages.manager, manager);
    addValue(competency.averages.peer, peer);
    addValue(competency.averages.average, average);
    addValue(competency.averages.self, self);
  }

  const individuals = Array.from(participantMap.values())
    .map((participant) => {
      const competencies = Array.from(participant.competencies.values()).map((competency) => {
        const statements = Array.from(competency.statements.values()).map((statement) => ({
          id: statement.id,
          statement: statement.statement,
          competencyId: competency.id,
          competencyLabel: competency.label,
          averages: toRaterAverages(statement.averages),
          frequencyDistribution: statement.frequencyDistribution,
        }));

        const hasExplicitAverages =
          competency.averages.average.count > 0 || competency.averages.self.count > 0;
        const derivedAveragesFromStatements = statements.length
          ? {
              subordinate: statements.reduce(
                (sum, statement) => sum + statement.averages.subordinate,
                0
              ) / statements.length,
              manager:
                statements.reduce((sum, statement) => sum + statement.averages.manager, 0) /
                statements.length,
              peer:
                statements.reduce((sum, statement) => sum + statement.averages.peer, 0) /
                statements.length,
              average:
                statements.reduce((sum, statement) => sum + statement.averages.average, 0) /
                statements.length,
              self:
                statements.reduce((sum, statement) => sum + statement.averages.self, 0) /
                statements.length,
            }
          : {
              subordinate: 0,
              manager: 0,
              peer: 0,
              average: 0,
              self: 0,
            };

        return {
          id: competency.id,
          label: competency.label,
          averages: hasExplicitAverages
            ? toRaterAverages(competency.averages)
            : {
                subordinate: Number(derivedAveragesFromStatements.subordinate.toFixed(2)),
                manager: Number(derivedAveragesFromStatements.manager.toFixed(2)),
                peer: Number(derivedAveragesFromStatements.peer.toFixed(2)),
                average: Number(derivedAveragesFromStatements.average.toFixed(2)),
                self: Number(derivedAveragesFromStatements.self.toFixed(2)),
              },
          statements,
        };
      });

      const gaps = competencies.flatMap((competency) =>
        competency.statements
          .map((statement) => {
            const diff = Number(
              (Number(statement.averages.self) - Number(statement.averages.average)).toFixed(2)
            );
            return {
              statement: `${statement.statement} (${competency.label})`,
              selfScore: Number(statement.averages.self) || 0,
              othersScore: Number(statement.averages.average) || 0,
              diff,
            };
          })
          .filter((gap) => Number.isFinite(gap.diff) && gap.diff !== 0)
      );

      return {
        id: participant.id,
        name: participant.name,
        competencies,
        gaps,
        implementationPlan: {
          participantName: participant.name,
          date: '',
          priorities: [],
        },
      };
    })
    .filter((individual) => individual.competencies.length > 0);

  if (individuals.length === 0) {
    throw new Error(
      'V Excel/CSV pre 360 neboli nájdené validné riadky. Očakáva sa minimálne stĺpec pre účastníka a kompetenciu.'
    );
  }

  return {
    mode: '360_FEEDBACK',
    reportMetadata: {
      date: reportDate,
      company: companyName || sourceFileName.replace(/\.[^/.]+$/, ''),
      scaleMax,
    },
    companyName: companyName || sourceFileName.replace(/\.[^/.]+$/, ''),
    surveyName: surveyName || '360 spätná väzba',
    scaleMax,
    companyReport: {
      respondentCounts: {
        subordinate: subordinateCount,
        manager: managerCount,
        peer: peerCount,
        self: selfCount,
      },
    },
    individuals,
  };
};

export const parseFeedback360Spreadsheet = async (
  file: File
): Promise<FeedbackAnalysisResult> => {
  const rows = await readRowsFromSpreadsheet(file);
  const payload = buildPayloadFromRows(rows, file.name);
  return parseFeedback360Report(payload);
};
