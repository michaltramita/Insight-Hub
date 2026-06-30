import React, { useEffect, useMemo, useState } from 'react';
import type {
  Feedback360IndividualReport,
  Feedback360ParticipantSummary,
} from '../../types';
import CompetencyRadar from '../RadarChart';
import StyledSelect from '../ui/StyledSelect';
import { exportBlockToPDF, exportBlockToPNG, exportDataToExcel } from '../../utils/exportUtils';
import {
  ChevronDown,
  Download,
  Gauge,
  Image as ImageIcon,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface Props {
  individual: Feedback360IndividualReport;
  individuals: Feedback360IndividualReport[];
  participantSummary?: Feedback360ParticipantSummary;
  onIndividualChange: (individualId: string) => void;
  scaleMax: number;
}

const formatScore = (value: unknown) => Number(Number(value) || 0).toFixed(2);
const formatScoreOrDash = (value: number | null) => (value === null ? '—' : formatScore(value));
const positiveScoreOrNull = (value: unknown) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null;
};

const statementChartSeries = [
  { key: 'manager', label: 'Nadriadená/ý', color: '#7B7B7B' },
  { key: 'peer', label: 'Peer', color: '#111114' },
  { key: 'subordinate', label: 'Podriadená/ý', color: '#A7A7A7' },
  { key: 'self', label: 'Sebahodnotenie', color: '#B81547' },
] as const;

type StatementChartSeriesKey = (typeof statementChartSeries)[number]['key'];

const IndividualOverviewBlock: React.FC<Props> = ({
  individual,
  individuals,
  participantSummary,
  onIndividualChange,
  scaleMax,
}) => {
  const [activeExportMenu, setActiveExportMenu] = useState<string | null>(null);
  const [isIndividualMenuOpen, setIsIndividualMenuOpen] = useState(false);
  const [activeStatementChartCompetencyId, setActiveStatementChartCompetencyId] = useState('');

  useEffect(() => {
    const handleGlobalClick = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('.export-dropdown-container')) {
        setActiveExportMenu(null);
      }
      if (!(event.target as HTMLElement).closest('.individual-selector-container')) {
        setIsIndividualMenuOpen(false);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const radarData = individual.competencies.map((competency) => ({
    name: competency.label,
    selfScore: Number(competency.averages.self) || 0,
    othersScore: Number(competency.averages.average) || 0,
  }));

  useEffect(() => {
    if (!individual.competencies.length) {
      if (activeStatementChartCompetencyId) setActiveStatementChartCompetencyId('');
      return;
    }

    const exists = individual.competencies.some(
      (competency) => competency.id === activeStatementChartCompetencyId
    );
    if (!exists) {
      setActiveStatementChartCompetencyId(individual.competencies[0].id);
    }
  }, [activeStatementChartCompetencyId, individual.competencies]);

  const statementChartCompetency =
    individual.competencies.find((competency) => competency.id === activeStatementChartCompetencyId) ||
    individual.competencies[0];
  const statementChartCompetencyOptions = useMemo(
    () =>
      individual.competencies.map((competency) => ({
        value: competency.id,
        label: competency.label,
      })),
    [individual.competencies]
  );
  const statementChartRows = useMemo(
    () =>
      statementChartCompetency?.statements.map((statement, index) => ({
        index: index + 1,
        label: `${index + 1}.`,
        statement: statement.statement,
        subordinate: Number(statement.averages.subordinate) || 0,
        peer: Number(statement.averages.peer) || 0,
        manager: Number(statement.averages.manager) || 0,
        self: Number(statement.averages.self) || 0,
      })) || [],
    [statementChartCompetency]
  );
  const xAxisTicks = useMemo(
    () => Array.from({ length: Math.max(Math.round(scaleMax), 1) }, (_, index) => index + 1),
    [scaleMax]
  );
  const statementChartHeight = Math.max(560, statementChartRows.length * 72);

  const hasImportedOverallScores = participantSummary?.overallScoresSource === 'imported';
  const overallSelf = hasImportedOverallScores
    ? positiveScoreOrNull(participantSummary?.overallSelf)
    : null;
  const overallPeer = hasImportedOverallScores
    ? positiveScoreOrNull(participantSummary?.overallAverage)
    : null;
  const overallDiff =
    overallSelf !== null && overallPeer !== null
      ? Number((overallSelf - overallPeer).toFixed(2))
      : null;

  const handleExcelExport = () => {
    exportDataToExcel(
      individual.competencies.map((competency) => {
        const average = Number(competency.averages.average) || 0;
        const self = Number(competency.averages.self) || 0;
        const diff = Number((self - average).toFixed(2));

        return {
          Kompetencia: competency.label,
          'Podriadená/ý': Number(formatScore(competency.averages.subordinate)),
          'Nadriadená/ý': Number(formatScore(competency.averages.manager)),
          Peer: Number(formatScore(competency.averages.peer)),
          Priemer: Number(formatScore(average)),
          Seba: Number(formatScore(self)),
          Rozdiel: Number(formatScore(diff)),
        };
      }),
      `360SV_Prehlad_${individual.name.replace(/\s+/g, '_')}.xlsx`,
      () => setActiveExportMenu(null)
    );
  };

  return (
    <div className="space-y-8 sm:space-y-10 animate-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
        <div className="relative individual-selector-container">
          <div
            role="button"
            tabIndex={0}
            onClick={() => setIsIndividualMenuOpen((current) => !current)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setIsIndividualMenuOpen((current) => !current);
              }
            }}
            className="w-full h-full cursor-pointer select-none text-left bg-black text-white p-6 sm:p-8 lg:p-10 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] shadow-2xl transition-transform hover:scale-[1.02] outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            aria-haspopup="listbox"
            aria-expanded={isIndividualMenuOpen}
          >
            <span className="mb-3 sm:mb-4 flex min-h-5 items-center justify-between gap-4">
              <span className="block text-[9px] sm:text-[10px] font-black uppercase text-white/45 tracking-[0.2em] leading-none">
                Meno a priezvisko
              </span>
              <ChevronDown
                className={`w-5 h-5 shrink-0 text-white/45 transition-transform ${
                  isIndividualMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </span>
            <span className="block text-2xl sm:text-3xl xl:text-4xl font-black tracking-tighter leading-none">
              {individual.name}
            </span>
          </div>

          {isIndividualMenuOpen && (
            <div
              role="listbox"
              className="absolute left-0 right-0 top-full z-50 mt-3 rounded-2xl border border-black/10 bg-white p-2 shadow-2xl"
            >
              <div className="max-h-72 overflow-y-auto space-y-1">
                {individuals.map((option) => {
                  const isActive = option.id === individual.id;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onClick={() => {
                        onIndividualChange(option.id);
                        setIsIndividualMenuOpen(false);
                      }}
                      className={`w-full px-4 py-3 rounded-xl text-left text-sm font-bold transition-all flex items-center justify-between gap-3 ${
                        isActive
                          ? 'bg-brand/12 text-brand border border-brand/15'
                          : 'text-black/70 hover:bg-black/5'
                      }`}
                    >
                      <span className="truncate">{option.name}</span>
                      {isActive && <span className="w-2.5 h-2.5 rounded-full bg-brand shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="bg-brand text-white p-6 sm:p-8 lg:p-10 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] shadow-2xl transition-transform hover:scale-[1.02]">
          <span className="block text-[9px] sm:text-[10px] font-black uppercase opacity-60 mb-2 sm:mb-3 tracking-[0.2em]">
            Celkové sebahodnotenie
          </span>
          <span className="text-5xl sm:text-6xl xl:text-7xl font-black tracking-tighter leading-none">
            {formatScoreOrDash(overallSelf)}
          </span>
        </div>
        <div className="bg-white border border-black/5 p-6 sm:p-8 lg:p-10 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] shadow-2xl transition-transform hover:scale-[1.02]">
          <span className="block text-[9px] sm:text-[10px] font-black uppercase text-black/40 mb-2 sm:mb-3 tracking-[0.2em]">
            Celkové priemerné hodnotenie kolegami
          </span>
          <span className="text-5xl sm:text-6xl xl:text-7xl font-black text-black tracking-tighter leading-none">
            {formatScoreOrDash(overallPeer)}
          </span>
        </div>
        <div className="bg-white border border-black/5 p-6 sm:p-8 lg:p-10 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] shadow-2xl transition-transform hover:scale-[1.02]">
          <span className="block text-[9px] sm:text-[10px] font-black uppercase text-black/40 mb-2 sm:mb-3 tracking-[0.2em]">
            Rozdiel v hodnoteniach
          </span>
          <span
            className={`text-5xl sm:text-6xl xl:text-7xl font-black tracking-tighter leading-none ${
              overallDiff !== null && overallDiff > 0
                ? 'text-brand'
                : overallDiff !== null && overallDiff < 0
                ? 'text-black/55'
                : 'text-black'
            }`}
          >
            {overallDiff !== null && overallDiff > 0 ? '+' : ''}
            {formatScoreOrDash(overallDiff)}
          </span>
        </div>
      </div>

      <section
        id="block-360-individual-overview"
        className="bg-white p-6 sm:p-8 lg:p-10 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-black/5 shadow-2xl"
      >
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center mb-6 sm:mb-8 lg:mb-10 gap-4 sm:gap-6">
          <div className="flex items-start gap-4 min-w-0">
            <div className="bg-brand/5 p-3 rounded-2xl flex-shrink-0">
              <Gauge className="w-5 h-5 sm:w-6 sm:h-6 text-brand" />
            </div>
            <div className="min-w-0">
              <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-tighter leading-none">
                Kompetenčný profil
              </h3>
              <p className="text-xs sm:text-sm font-black uppercase tracking-[0.2em] text-black/30 mt-2">
                {individual.name}
              </p>
            </div>
          </div>

          <div
            className="relative export-dropdown-container export-buttons print:hidden"
            data-html2canvas-ignore="true"
          >
            <button
              onClick={() =>
                setActiveExportMenu(activeExportMenu === 'individual-overview' ? null : 'individual-overview')
              }
              className="flex items-center justify-center gap-2 px-3 py-2 bg-black/5 hover:bg-black/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-black/60 hover:text-black"
            >
              <Download className="w-3 h-3" /> Export
              <ChevronDown
                className={`w-3 h-3 transition-transform ${
                  activeExportMenu === 'individual-overview' ? 'rotate-180' : ''
                }`}
              />
            </button>

            {activeExportMenu === 'individual-overview' && (
              <div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-xl border border-black/5 p-2 z-50 flex flex-col gap-1 min-w-[150px] animate-fade-in">
                <button
                  onClick={() =>
                    exportBlockToPDF(
                      'block-360-individual-overview',
                      `360SV_Prehlad_${individual.name.replace(/\s+/g, '_')}`,
                      () => setActiveExportMenu(null)
                    )
                  }
                  className="flex items-center gap-2 w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-black/5 transition-colors"
                >
                  PDF Dokument
                </button>
                <button
                  onClick={() =>
                    exportBlockToPNG(
                      'block-360-individual-overview',
                      `360SV_Prehlad_${individual.name.replace(/\s+/g, '_')}`,
                      () => setActiveExportMenu(null)
                    )
                  }
                  className="flex items-center gap-2 w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-black/5 transition-colors"
                >
                  <ImageIcon className="w-3 h-3" /> Obrázok PNG
                </button>
                <button
                  onClick={handleExcelExport}
                  className="flex items-center gap-2 w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-brand/10 text-brand transition-colors"
                >
                  <Download className="w-3 h-3" /> Excel Dáta
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="min-h-[680px] sm:min-h-[820px] xl:min-h-[980px]">
          <div className="h-[660px] sm:h-[800px] xl:h-[940px]">
            <CompetencyRadar data={radarData} scaleMax={scaleMax} variant="full" />
          </div>
        </div>

      </section>

      {statementChartCompetency && (
        <section
          id="block-360-individual-statement-chart"
          className="bg-white p-6 sm:p-8 lg:p-10 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-black/5 shadow-2xl"
        >
            <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-5 sm:gap-6 lg:gap-8 mb-8 sm:mb-10">
              <div>
                <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.25em] text-brand">
                  Detail podľa tvrdení
                </p>
                <h4 className="mt-2 text-2xl sm:text-3xl font-black tracking-tighter leading-none">
                  Porovnanie hodnotení v oblasti
                </h4>
              </div>

              <div className="w-full xl:w-[420px]">
                <div className="text-[10px] sm:text-xs font-black uppercase tracking-[0.25em] text-black/35 mb-2">
                  Oblasť
                </div>
                <StyledSelect
                  value={statementChartCompetency.id}
                  onChange={setActiveStatementChartCompetencyId}
                  options={statementChartCompetencyOptions}
                  placeholder="Vyber oblasť"
                  wrapperClassName="w-full"
                  buttonClassName="min-h-[56px] rounded-2xl border border-black/5 bg-black/[0.03] px-4 sm:px-5 py-3 shadow-sm"
                  labelClassName="text-sm sm:text-base font-black uppercase tracking-wide text-black pr-8"
                  panelClassName="rounded-2xl"
                  optionClassName="text-xs sm:text-sm font-black uppercase tracking-wide"
                  selectedOptionClassName="bg-brand/12 text-brand"
                  iconClassName="text-black/35"
                  menuAlign="left"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-8 sm:mb-10">
              {statementChartSeries.map((series) => (
                <div
                  key={series.key}
                  className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white px-4 py-2.5 text-[10px] sm:text-xs font-black uppercase tracking-[0.12em] text-black/65 shadow-sm"
                >
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: series.color }}
                  />
                  <span>{series.label}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(360px,0.95fr)_minmax(620px,1.45fr)] gap-8 lg:gap-12 overflow-x-auto">
              <div
                className="hidden xl:flex flex-col justify-between pr-2"
                style={{ height: statementChartHeight }}
              >
                {statementChartRows.map((row) => (
                  <div key={row.label} className="flex min-h-[54px] items-center rounded-2xl px-3 transition-colors hover:bg-black/[0.025]">
                    <p className="text-sm 2xl:text-base font-bold leading-snug text-black/70">
                      {row.index}. {row.statement}
                    </p>
                  </div>
                ))}
              </div>

              <div className="min-w-[720px] rounded-[1.5rem] border border-black/5 bg-black/[0.015] p-4 sm:p-6" style={{ height: statementChartHeight }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={statementChartRows}
                    layout="vertical"
                    margin={{ left: 12, right: 34, top: 18, bottom: 26 }}
                  >
                    <CartesianGrid stroke="#00000010" horizontal vertical />
                    <XAxis
                      type="number"
                      domain={[0, scaleMax]}
                      ticks={xAxisTicks}
                      tickLine={false}
                      axisLine={{ stroke: '#00000026' }}
                      tick={{ fontSize: 12, fontWeight: 800, fill: '#00000088' }}
                    />
                    <YAxis
                      dataKey="label"
                      type="category"
                      width={42}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12, fontWeight: 900, fill: '#00000055' }}
                    />
                    <ReferenceLine
                      x={5}
                      stroke="#B81547"
                      strokeWidth={2}
                      strokeDasharray="5 6"
                      ifOverflow="visible"
                    />
                    <Tooltip
                      cursor={{ stroke: '#00000018', strokeWidth: 1 }}
                      formatter={(value: unknown, name: unknown) => {
                        const series = statementChartSeries.find((item) => item.key === name);
                        return [formatScore(value), series?.label || String(name)];
                      }}
                      labelFormatter={(label) => {
                        const row = statementChartRows.find((item) => item.label === label);
                        return row ? `${row.index}. ${row.statement}` : String(label);
                      }}
                      contentStyle={{
                        borderRadius: '1rem',
                        border: '1px solid #00000010',
                        boxShadow: '0 18px 45px -24px rgba(0,0,0,0.45)',
                        fontWeight: 800,
                      }}
                    />
                    {statementChartSeries.map((series) => (
                      <Line
                        key={series.key}
                        type="linear"
                        dataKey={series.key as StatementChartSeriesKey}
                        stroke={series.color}
                        strokeWidth={series.key === 'self' ? 4 : 3.5}
                        strokeDasharray={series.key === 'self' ? '7 5' : undefined}
                        dot={{
                          r: 5.5,
                          strokeWidth: 2.5,
                          fill: series.color,
                          stroke: series.color,
                        }}
                        activeDot={{ r: 8, strokeWidth: 2.5 }}
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="xl:hidden mt-6 space-y-3">
              {statementChartRows.map((row) => (
                <p key={row.label} className="text-sm font-bold leading-snug text-black/65">
                  {row.index}. {row.statement}
                </p>
              ))}
            </div>
        </section>
      )}
    </div>
  );
};

export default IndividualOverviewBlock;
