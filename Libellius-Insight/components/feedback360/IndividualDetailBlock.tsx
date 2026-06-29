import React, { useEffect, useMemo, useState } from 'react';
import type {
  Feedback360FrequencyDistribution,
  Feedback360IndividualReport,
  Feedback360CompetencyResult,
} from '../../types';
import StyledSelect from '../ui/StyledSelect';
import { exportBlockToPDF, exportBlockToPNG, exportDataToExcel } from '../../utils/exportUtils';
import {
  BarChart3,
  Check,
  ChevronDown,
  Download,
  Filter,
  Image as ImageIcon,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface Props {
  individual: Feedback360IndividualReport;
}

type RespondentGroupKey = 'subordinate' | 'manager' | 'peer' | 'self';
type SelectableRespondentGroupKey = Exclude<RespondentGroupKey, 'self'>;
type FrequencyBucketKey = keyof Feedback360FrequencyDistribution;
type FrequencyPctKey =
  | 'naPct'
  | 'onePct'
  | 'twoPct'
  | 'threePct'
  | 'fourPct'
  | 'fivePct'
  | 'sixPct'
  | 'sevenPct';
type FrequencyCountKey =
  | 'naCount'
  | 'oneCount'
  | 'twoCount'
  | 'threeCount'
  | 'fourCount'
  | 'fiveCount'
  | 'sixCount'
  | 'sevenCount';

interface RespondentGroupOption {
  value: RespondentGroupKey;
  label: string;
  color: string;
  count: number;
}

interface FrequencyChartRow {
  category: string;
  totalCount: number;
  naCount: number;
  oneCount: number;
  twoCount: number;
  threeCount: number;
  fourCount: number;
  fiveCount: number;
  sixCount: number;
  sevenCount: number;
  naPct?: number;
  onePct?: number;
  twoPct?: number;
  threePct?: number;
  fourPct?: number;
  fivePct?: number;
  sixPct?: number;
  sevenPct?: number;
}

interface TooltipPayloadItem {
  payload?: FrequencyChartRow;
}

interface FrequencyDistributionTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

interface DistributionLabelProps {
  value?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: FrequencyChartRow;
}

const score = (value: unknown) => Number(Number(value) || 0).toFixed(2);

const truncate = (value: string, max = 76) =>
  value.length > max ? `${value.slice(0, max - 1).trim()}...` : value;

const fileSafe = (value: string) => value.replace(/\s+/g, '_').replace(/[^\w.-]+/g, '_');

const FREQUENCY_BUCKETS: Array<{
  key: FrequencyBucketKey;
  label: string;
  pctKey: FrequencyPctKey;
  countKey: FrequencyCountKey;
  color: string;
  textColor: string;
}> = [
  { key: 'na', label: 'N/A', pctKey: 'naPct', countKey: 'naCount', color: '#111111', textColor: '#FFFFFF' },
  { key: 'one', label: '1', pctKey: 'onePct', countKey: 'oneCount', color: '#4A081C', textColor: '#FFFFFF' },
  { key: 'two', label: '2', pctKey: 'twoPct', countKey: 'twoCount', color: '#7D0E30', textColor: '#FFFFFF' },
  { key: 'three', label: '3', pctKey: 'threePct', countKey: 'threeCount', color: '#B81547', textColor: '#FFFFFF' },
  { key: 'four', label: '4', pctKey: 'fourPct', countKey: 'fourCount', color: '#CB446D', textColor: '#FFFFFF' },
  { key: 'five', label: '5', pctKey: 'fivePct', countKey: 'fiveCount', color: '#E88AA6', textColor: '#111111' },
  { key: 'six', label: '6', pctKey: 'sixPct', countKey: 'sixCount', color: '#F5B9CB', textColor: '#111111' },
  { key: 'seven', label: '7', pctKey: 'sevenPct', countKey: 'sevenCount', color: '#FCE8EE', textColor: '#111111' },
];
const FREQUENCY_ALL_VALUE = '__ALL__';

const groupValueKeyMap: Record<RespondentGroupKey, keyof Pick<
  Feedback360CompetencyResult['averages'],
  'subordinate' | 'manager' | 'peer' | 'self'
>> = {
  subordinate: 'subordinate',
  manager: 'manager',
  peer: 'peer',
  self: 'self',
};

const FrequencyDistributionTooltip = ({
  active,
  payload,
  label,
}: FrequencyDistributionTooltipProps) => {
  if (!(active && payload && payload.length)) return null;
  const row = payload.find((item) => item?.payload)?.payload;
  if (!row) return null;

  return (
    <div className="max-w-sm rounded-2xl border border-white/10 bg-black p-4 text-white shadow-2xl">
      <p className="mb-3 text-sm font-black leading-snug">{label}</p>
      <div className="space-y-2">
        {FREQUENCY_BUCKETS.map((bucket) => {
          const count = Number(row[bucket.countKey] || 0);
          const pct = Number(row[bucket.pctKey] || 0);
          if (count <= 0) return null;

          return (
            <div key={bucket.key} className="flex items-center justify-between gap-4 text-xs font-black">
              <span className="inline-flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-sm"
                  style={{ backgroundColor: bucket.color }}
                />
                Hodnota {bucket.label}
              </span>
              <span>
                {count} ({pct.toFixed(1)}%)
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-white/45">
        Spolu {row.totalCount} odpovedí
      </p>
    </div>
  );
};

const IndividualDetailBlock: React.FC<Props> = ({ individual }) => {
  const [activeCompetencyId, setActiveCompetencyId] = useState<string>('');
  const [activeExportMenu, setActiveExportMenu] = useState<string | null>(null);
  const [isGroupMenuOpen, setIsGroupMenuOpen] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<SelectableRespondentGroupKey[]>([
    'subordinate',
    'manager',
    'peer',
  ]);
  const [selectedFrequencyBucket, setSelectedFrequencyBucket] =
    useState<FrequencyBucketKey | null>(null);

  useEffect(() => {
    if (!individual.competencies.length) {
      if (activeCompetencyId) setActiveCompetencyId('');
      return;
    }

    const exists = individual.competencies.some(
      (competency) => competency.id === activeCompetencyId
    );
    if (!exists) {
      setActiveCompetencyId(individual.competencies[0].id);
    }
  }, [individual, activeCompetencyId]);

  useEffect(() => {
    const handleGlobalClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      if (!target.closest('.export-dropdown-container')) {
        setActiveExportMenu(null);
      }
      if (!target.closest('.group-filter-dropdown-container')) {
        setIsGroupMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveExportMenu(null);
        setIsGroupMenuOpen(false);
      }
    };

    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const activeCompetency =
    individual.competencies.find((competency) => competency.id === activeCompetencyId) ||
    (individual.competencies.length ? individual.competencies[0] : null);

  const competencyOptions = useMemo(
    () =>
      individual.competencies.map((competency) => ({
        value: competency.id,
        label: competency.label,
      })),
    [individual.competencies]
  );

  const groupOptions: RespondentGroupOption[] = useMemo(() => {
    const counts = activeCompetency?.respondentCounts;
    const averages = activeCompetency?.averages;
    const resolveCount = (key: SelectableRespondentGroupKey) => {
      const explicitCount = Number(counts?.[key] || 0);
      if (explicitCount > 0) return explicitCount;
      return Number(averages?.[key] || 0) > 0 ? 1 : 0;
    };

    return [
      {
        value: 'subordinate',
        label: 'Podriadená/ý',
        color: '#111111',
        count: resolveCount('subordinate'),
      },
      {
        value: 'manager',
        label: 'Nadriadená/ý',
        color: '#4A4A4A',
        count: resolveCount('manager'),
      },
      {
        value: 'peer',
        label: 'Peer',
        color: '#8B8B8B',
        count: resolveCount('peer'),
      },
    ];
  }, [activeCompetency]);

  const availableGroupKeys = useMemo(
    () =>
      groupOptions
        .filter((option) => option.count > 0)
        .map((option) => option.value as SelectableRespondentGroupKey),
    [groupOptions]
  );

  useEffect(() => {
    setSelectedGroups((current) =>
      current.filter((value) => availableGroupKeys.includes(value))
    );
  }, [availableGroupKeys]);

  const selectedGroupsLabel =
    selectedGroups.length === 0
      ? 'Vyber skupiny'
      : selectedGroups.length === availableGroupKeys.length
        ? 'Všetky skupiny'
        : `${selectedGroups.length} skupiny`;

  const selectedGroupOptions = useMemo(
    () => groupOptions.filter((option) => selectedGroups.includes(option.value)),
    [groupOptions, selectedGroups]
  );

  const tableRows = useMemo(
    () =>
      activeCompetency
        ? activeCompetency.statements.map((statement) => {
            const subordinate = Number(statement.averages.subordinate) || 0;
            const manager = Number(statement.averages.manager) || 0;
            const peer = Number(statement.averages.peer) || 0;
            const average = Number(statement.averages.average) || 0;
            const self = Number(statement.averages.self) || 0;
            const diff = Number((self - average).toFixed(2));

            return {
              id: statement.id,
              statement: statement.statement,
              subordinate,
              manager,
              peer,
              average,
              self,
              diff,
              frequencyDistribution: statement.frequencyDistribution,
            };
          })
        : [],
    [activeCompetency]
  );

  const visibleColumns = useMemo(() => {
    const groupColumns = selectedGroupOptions.map((option) => ({
      key: option.value,
      label: option.label,
    }));
    const tailColumns = [
      { key: 'average', label: 'Priemer' },
      { key: 'self', label: 'Sebahodnotenie' },
      { key: 'diff', label: 'Rozdiel' },
    ];

    return [...groupColumns, ...tailColumns];
  }, [selectedGroupOptions]);

  const frequencyChartData = useMemo(
    () =>
      tableRows
        .map<FrequencyChartRow | null>((row) => {
          const freq = row.frequencyDistribution;
          if (!freq) return null;

          const naCount = Number(freq.na ?? 0) || 0;
          const oneCount = Number(freq.one ?? 0) || 0;
          const twoCount = Number(freq.two ?? 0) || 0;
          const threeCount = Number(freq.three ?? 0) || 0;
          const fourCount = Number(freq.four ?? 0) || 0;
          const fiveCount = Number(freq.five ?? 0) || 0;
          const sixCount = Number(freq.six ?? 0) || 0;
          const sevenCount = Number(freq.seven ?? 0) || 0;
          const totalCount =
            naCount + oneCount + twoCount + threeCount + fourCount + fiveCount + sixCount + sevenCount;

          return {
            category: row.statement,
            totalCount,
            naCount,
            oneCount,
            twoCount,
            threeCount,
            fourCount,
            fiveCount,
            sixCount,
            sevenCount,
            naPct: totalCount > 0 && naCount > 0 ? (naCount / totalCount) * 100 : undefined,
            onePct: totalCount > 0 && oneCount > 0 ? (oneCount / totalCount) * 100 : undefined,
            twoPct: totalCount > 0 && twoCount > 0 ? (twoCount / totalCount) * 100 : undefined,
            threePct: totalCount > 0 && threeCount > 0 ? (threeCount / totalCount) * 100 : undefined,
            fourPct: totalCount > 0 && fourCount > 0 ? (fourCount / totalCount) * 100 : undefined,
            fivePct: totalCount > 0 && fiveCount > 0 ? (fiveCount / totalCount) * 100 : undefined,
            sixPct: totalCount > 0 && sixCount > 0 ? (sixCount / totalCount) * 100 : undefined,
            sevenPct: totalCount > 0 && sevenCount > 0 ? (sevenCount / totalCount) * 100 : undefined,
          };
        })
        .filter((row): row is FrequencyChartRow => row !== null && row.totalCount > 0),
    [tableRows]
  );

  const activeSummary = useMemo(() => {
    if (!activeCompetency) return null;
    const average = Number(activeCompetency.averages.average) || 0;
    const self = Number(activeCompetency.averages.self) || 0;
    const diff = Number((self - average).toFixed(2));
    const selectedGroupAverage =
      selectedGroupOptions.length > 0
        ? selectedGroupOptions.reduce(
            (sum, option) =>
              sum + (Number(activeCompetency.averages[groupValueKeyMap[option.value]]) || 0),
            0
          ) / selectedGroupOptions.length
        : null;

    return {
      statementsCount: activeCompetency.statements.length,
      average,
      self,
      diff,
      selectedGroupAverage,
    };
  }, [activeCompetency, selectedGroupOptions]);

  const exportBaseName = activeCompetency
    ? fileSafe(`360SV_Detail_${individual.name}_${activeCompetency.label}`)
    : fileSafe(`360SV_Detail_${individual.name}`);

  const handleDetailExcelExport = () => {
    exportDataToExcel(
      tableRows.map((row) => ({
        Tvrdenie: row.statement,
        'Podriadená/ý': Number(row.subordinate.toFixed(2)),
        'Nadriadená/ý': Number(row.manager.toFixed(2)),
        Peer: Number(row.peer.toFixed(2)),
        Priemer: Number(row.average.toFixed(2)),
        Seba: Number(row.self.toFixed(2)),
        Rozdiel: Number(row.diff.toFixed(2)),
        'Pocetnost N/A': row.frequencyDistribution?.na ?? '',
        'Pocetnost 1': row.frequencyDistribution?.one ?? '',
        'Pocetnost 2': row.frequencyDistribution?.two ?? '',
        'Pocetnost 3': row.frequencyDistribution?.three ?? '',
        'Pocetnost 4': row.frequencyDistribution?.four ?? '',
        'Pocetnost 5': row.frequencyDistribution?.five ?? '',
        'Pocetnost 6': row.frequencyDistribution?.six ?? '',
        'Pocetnost 7': row.frequencyDistribution?.seven ?? '',
      })),
      `${exportBaseName}.xlsx`,
      () => setActiveExportMenu(null)
    );
  };

  const toggleGroup = (group: SelectableRespondentGroupKey) => {
    const option = groupOptions.find((item) => item.value === group);
    if (!option || option.count <= 0) return;

    setSelectedGroups((current) => {
      if (current.includes(group)) {
        return current.filter((value) => value !== group);
      }

      return [...current, group];
    });
  };

  const frequencyFilterOptions = [
    { value: FREQUENCY_ALL_VALUE, label: 'Všetky hodnoty' },
    ...FREQUENCY_BUCKETS.map((bucket) => ({
      value: bucket.key,
      label: `Hodnota ${bucket.label}`,
    })),
  ];

  const getFrequencyChartHeight = () => {
    const rowHeight = 64;
    const basePadding = 110;
    return Math.max(260, Math.min(720, frequencyChartData.length * rowHeight + basePadding));
  };

  const renderDistributionCountLabel =
    (countKey: FrequencyCountKey, textColor: string) =>
    (props: unknown) => {
      const safeProps = props as DistributionLabelProps;
      const percentage = Number(safeProps?.value ?? 0);
      const count = Number(safeProps?.payload?.[countKey] ?? 0);
      if (!(percentage >= 7) || count <= 0) return null;

      const x = Number(safeProps?.x ?? 0);
      const y = Number(safeProps?.y ?? 0);
      const width = Number(safeProps?.width ?? 0);
      const height = Number(safeProps?.height ?? 0);

      return (
        <text
          x={x + width / 2}
          y={y + height / 2}
          dy="0.35em"
          textAnchor="middle"
          fill={textColor}
          fontSize={11}
          fontWeight={900}
        >
          {count}
        </text>
      );
    };

  return (
    <div className="space-y-8 sm:space-y-10 animate-fade-in">
      {activeCompetency && (
        <section
          id="block-360-individual-detail"
          className="bg-white p-6 sm:p-8 lg:p-10 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-black/5 shadow-2xl"
        >
          <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center mb-6 sm:mb-8 lg:mb-10 gap-4 sm:gap-6">
            <div className="flex items-start gap-4 min-w-0">
              <div className="bg-brand/5 p-3 rounded-2xl flex-shrink-0">
                <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-brand" />
              </div>
              <div className="min-w-0">
                <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-tighter leading-none break-words">
                  {activeCompetency.label}
                </h3>
                <p className="text-xs sm:text-sm font-black uppercase tracking-[0.2em] text-black/30 mt-2">
                  Detail tvrdení a početnosti odpovedí
                </p>
              </div>
            </div>

            <div
              className="relative export-dropdown-container export-buttons print:hidden"
              data-html2canvas-ignore="true"
            >
              <button
                onClick={() =>
                  setActiveExportMenu(
                    activeExportMenu === 'individual-detail' ? null : 'individual-detail'
                  )
                }
                className="flex items-center justify-center gap-2 px-3 py-2 bg-black/5 hover:bg-black/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-black/60 hover:text-black"
              >
                <Download className="w-3 h-3" /> Export
                <ChevronDown
                  className={`w-3 h-3 transition-transform ${
                    activeExportMenu === 'individual-detail' ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {activeExportMenu === 'individual-detail' && (
                <div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-xl border border-black/5 p-2 z-50 flex flex-col gap-1 min-w-[150px] animate-fade-in">
                  <button
                    onClick={() =>
                      exportBlockToPDF('block-360-individual-detail', exportBaseName, () =>
                        setActiveExportMenu(null)
                      )
                    }
                    className="flex items-center gap-2 w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-black/5 transition-colors"
                  >
                    PDF Dokument
                  </button>
                  <button
                    onClick={() =>
                      exportBlockToPNG('block-360-individual-detail', exportBaseName, () =>
                        setActiveExportMenu(null)
                      )
                    }
                    className="flex items-center gap-2 w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-black/5 transition-colors"
                  >
                    <ImageIcon className="w-3 h-3" /> Obrázok PNG
                  </button>
                  <button
                    onClick={handleDetailExcelExport}
                    className="flex items-center gap-2 w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-brand/10 text-brand transition-colors"
                  >
                    <Download className="w-3 h-3" /> Excel Dáta
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="mb-6 sm:mb-8 print:hidden">
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-3 sm:gap-4">
              <div>
                <div className="text-[10px] sm:text-xs font-black uppercase tracking-[0.25em] text-black/35 mb-2">
                  Oblasť
                </div>
                <StyledSelect
                  value={activeCompetency.id}
                  onChange={setActiveCompetencyId}
                  options={competencyOptions}
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

              <div>
                <div className="text-[10px] sm:text-xs font-black uppercase tracking-[0.25em] text-black/35 mb-2">
                  Skupiny
                </div>
                <div className="relative group-filter-dropdown-container">
                  <button
                    type="button"
                    onClick={() => setIsGroupMenuOpen((prev) => !prev)}
                    className="relative w-full min-h-[56px] rounded-2xl border border-black/5 bg-black/[0.03] px-4 sm:px-5 py-3 shadow-sm text-left focus:outline-none focus:ring-2 focus:ring-brand/30 transition-all"
                    aria-haspopup="listbox"
                    aria-expanded={isGroupMenuOpen}
                  >
                    <span className="block truncate pr-10 text-sm sm:text-base font-black uppercase tracking-wide text-black">
                      {selectedGroupsLabel}
                    </span>
                    <ChevronDown
                      className={`pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-black/35 transition-transform ${
                        isGroupMenuOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {isGroupMenuOpen && (
                    <div
                      role="listbox"
                      className="absolute right-0 z-50 mt-2 w-full rounded-2xl border border-black/10 bg-white p-2 shadow-2xl"
                    >
                      {groupOptions.map((option) => {
                        const isActive = selectedGroups.includes(option.value);
                        const isDisabled = option.count <= 0;

                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="option"
                            aria-selected={isActive}
                            disabled={isDisabled}
                            onClick={() => toggleGroup(option.value as SelectableRespondentGroupKey)}
                            className={`w-full px-4 py-3 rounded-xl text-left text-sm font-bold transition-all flex items-center justify-between gap-3 ${
                              isActive
                                ? 'bg-brand/12 text-brand border border-brand/15'
                                : 'text-black/70 hover:bg-black/5'
                            } ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                          >
                            <span className="inline-flex items-center gap-3 min-w-0">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: option.color }}
                              />
                              <span className="truncate">{option.label}</span>
                            </span>
                            <span className="inline-flex items-center gap-2 shrink-0">
                              {isActive && <Check className="w-4 h-4 text-brand" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {activeSummary && (
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
              <div className="rounded-2xl sm:rounded-3xl bg-black text-white p-4 sm:p-5">
                <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-white/45">
                  Tvrdenia
                </p>
                <p className="text-3xl sm:text-4xl font-black tracking-tighter mt-1">
                  {activeSummary.statementsCount}
                </p>
              </div>
              <div className="rounded-2xl sm:rounded-3xl bg-brand text-white p-4 sm:p-5">
                <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-white/55">
                  Skupiny
                </p>
                <p className="text-3xl sm:text-4xl font-black tracking-tighter mt-1">
                  {activeSummary.selectedGroupAverage === null
                    ? '—'
                    : score(activeSummary.selectedGroupAverage)}
                </p>
              </div>
              <div className="rounded-2xl sm:rounded-3xl bg-black/5 border border-black/5 p-4 sm:p-5">
                <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-black/35">
                  Sebahodnotenie
                </p>
                <p className="text-3xl sm:text-4xl font-black tracking-tighter mt-1">
                  {score(activeSummary.self)}
                </p>
              </div>
              <div className="rounded-2xl sm:rounded-3xl bg-black/5 border border-black/5 p-4 sm:p-5">
                <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-black/35">
                  Rozdiel
                </p>
                <p
                  className={`text-3xl sm:text-4xl font-black tracking-tighter mt-1 ${
                    activeSummary.diff > 0
                      ? 'text-brand'
                      : activeSummary.diff < 0
                      ? 'text-black/55'
                      : 'text-black'
                  }`}
                >
                  {activeSummary.diff > 0 ? '+' : ''}
                  {score(activeSummary.diff)}
                </p>
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded-2xl sm:rounded-3xl border border-black/5">
            <table className="w-full min-w-[940px] text-left">
              <thead className="bg-[#fcfcfc] text-sm font-black uppercase tracking-widest text-black/60 border-b border-black/5">
                <tr>
                  <th className="p-4 sm:p-6">Tvrdenie</th>
                  {visibleColumns.map((column) => (
                    <th key={column.key} className="p-4 sm:p-6 text-center">
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 font-black text-sm">
                {tableRows.map((row) => (
                  <tr key={row.id} className="hover:bg-brand/5 transition-colors group">
                    <td className="p-4 sm:p-6 font-bold text-black/80 group-hover:text-brand transition-colors">
                      {row.statement}
                    </td>
                    {visibleColumns.map((column) => {
                      const value = row[column.key as keyof typeof row];
                      const numericValue = Number(value) || 0;
                      const isDiff = column.key === 'diff';

                      return (
                        <td
                          key={`${row.id}-${column.key}`}
                          className={`p-4 sm:p-6 text-center ${
                            isDiff
                              ? numericValue > 0
                                ? 'text-brand'
                                : numericValue < 0
                                  ? 'text-black/60'
                                  : 'text-black'
                              : ''
                          }`}
                        >
                          {isDiff && numericValue > 0 ? '+' : ''}
                          {score(numericValue)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {tableRows.length === 0 && (
                  <tr>
                    <td colSpan={visibleColumns.length + 1} className="p-8 sm:p-10 text-center text-black/30 font-black uppercase tracking-widest text-xs">
                      Táto kompetencia zatiaľ neobsahuje detailné tvrdenia
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-8 sm:mt-10 bg-black/[0.02] rounded-[1.25rem] sm:rounded-[1.75rem] border border-black/5 p-4 sm:p-6 lg:p-8">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 sm:gap-6 mb-6 sm:mb-8">
                <div className="flex items-start gap-4 min-w-0">
                  <div className="bg-brand/5 p-3 rounded-2xl flex-shrink-0">
                    <Filter className="w-5 h-5 sm:w-6 sm:h-6 text-brand" />
                  </div>
                  <div>
                    <h4 className="text-lg sm:text-xl lg:text-2xl font-black uppercase tracking-tight">
                      Graf početnosti odpovedí
                    </h4>
                    <p className="text-xs sm:text-sm font-bold text-black/40 mt-1">
                      Percentuálne rozdelenie odpovedí po jednotlivých tvrdeniach.
                    </p>
                  </div>
                </div>

                {frequencyChartData.length > 0 && (
                <div className="w-full md:w-[220px] print:hidden">
                  <StyledSelect
                    value={selectedFrequencyBucket || FREQUENCY_ALL_VALUE}
                    onChange={(value) => {
                      if (value === FREQUENCY_ALL_VALUE) {
                        setSelectedFrequencyBucket(null);
                        return;
                      }
                      setSelectedFrequencyBucket(value as FrequencyBucketKey);
                    }}
                    options={frequencyFilterOptions}
                    buttonClassName="w-full px-3 py-2 sm:px-4 sm:py-3 bg-white rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest text-black/70 border border-black/10 hover:bg-black/5"
                    panelClassName="bg-white border-black/10"
                    optionClassName="text-black/70 hover:bg-black/5 hover:text-black"
                    selectedOptionClassName="bg-brand text-white"
                    iconClassName="text-black/40 w-4 h-4"
                  />
                </div>
                )}
              </div>

              {frequencyChartData.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-black/10 bg-white p-8 sm:p-10 text-center">
                  <p className="text-sm sm:text-base font-black uppercase tracking-[0.18em] text-black/35">
                    Početnosti odpovedí nie sú dostupné
                  </p>
                  <p className="mx-auto mt-3 max-w-2xl text-sm font-bold text-black/45">
                    Pre vybranú osobu a oblasť import neobsahuje rozdelenie odpovedí podľa hodnôt.
                    Keď budú v dátach stĺpce s početnosťami, graf sa tu zobrazí automaticky.
                  </p>
                </div>
              ) : (
                <>
              <div className="w-full" style={{ height: getFrequencyChartHeight() }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={frequencyChartData}
                    layout="vertical"
                    margin={{ left: 10, right: 28, top: 8, bottom: 16 }}
                  >
                    <CartesianGrid strokeDasharray="2 6" horizontal={false} stroke="#00000010" />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      ticks={[0, 20, 40, 60, 80, 100]}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value: number) => `${value}%`}
                      tick={{
                        fill: '#00000066',
                        fontSize: 11,
                        fontWeight: 800,
                      }}
                    />
                    <YAxis
                      dataKey="category"
                      type="category"
                      width={430}
                      interval={0}
                      tick={({ x, y, payload }) => (
                        <g transform={`translate(${Number(x || 0) - 8},${Number(y || 0)})`}>
                          <text
                            x={0}
                            y={0}
                            dy={4}
                            textAnchor="end"
                            fill="#111111"
                            fontSize={12}
                            fontWeight={900}
                          >
                            {truncate(String(payload?.value || ''), 52)}
                          </text>
                        </g>
                      )}
                    />
                    <Tooltip
                      cursor={{ fill: '#00000005' }}
                      content={(tooltipProps: unknown) => (
                        <FrequencyDistributionTooltip
                          {...(tooltipProps as FrequencyDistributionTooltipProps)}
                        />
                      )}
                      isAnimationActive={false}
                      shared
                    />

                    {FREQUENCY_BUCKETS.map((bucket, index) => {
                      const isFirst = index === 0;
                      const isLast = index === FREQUENCY_BUCKETS.length - 1;
                      const isHighlighted =
                        !selectedFrequencyBucket || selectedFrequencyBucket === bucket.key;

                      return (
                        <Bar
                          key={bucket.key}
                          dataKey={bucket.pctKey}
                          stackId="distribution"
                          fill={isHighlighted ? bucket.color : '#D4D4D8'}
                          isAnimationActive={false}
                          radius={
                            isFirst
                              ? [10, 0, 0, 10]
                              : isLast
                                ? [0, 10, 10, 0]
                                : [0, 0, 0, 0]
                          }
                        >
                          <LabelList
                            dataKey={bucket.pctKey}
                            content={renderDistributionCountLabel(
                              bucket.countKey,
                              isHighlighted ? bucket.textColor : '#3F3F46'
                            )}
                          />
                        </Bar>
                      );
                    })}
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-3 sm:mt-4 flex flex-wrap gap-2 sm:gap-3 justify-end">
                {FREQUENCY_BUCKETS.map((bucket) => (
                  <div
                    key={`legend-${bucket.key}`}
                    className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-black/10 bg-white"
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-sm"
                      style={{
                        backgroundColor:
                          !selectedFrequencyBucket || selectedFrequencyBucket === bucket.key
                            ? bucket.color
                            : '#D4D4D8',
                      }}
                    />
                    <span className="text-[11px] sm:text-xs font-black tracking-wide text-black/75">
                      {bucket.label}
                    </span>
                  </div>
                ))}
              </div>
                </>
              )}
            </div>
        </section>
      )}

      {individual.competencies.length === 0 && (
        <div className="bg-white p-10 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-black/5 shadow-2xl text-center">
          <p className="font-black text-lg text-black/55">
            Detail kompetencií zatiaľ nie je dostupný.
          </p>
        </div>
      )}
    </div>
  );
};

export default IndividualDetailBlock;
