import React, { useEffect, useMemo, useState } from 'react';
import type {
  Feedback360CompetencyResult,
  Feedback360RespondentCounts,
} from '../../types';
import StyledSelect from '../ui/StyledSelect';
import { exportBlockToPDF, exportBlockToPNG, exportDataToExcel } from '../../utils/exportUtils';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BarChart3,
  Check,
  ChevronDown,
  Download,
  Image as ImageIcon,
  LayoutGrid,
} from 'lucide-react';

interface Props {
  competencies: Feedback360CompetencyResult[];
  respondentCounts: Feedback360RespondentCounts;
  scaleMax: number;
}

type RespondentGroupKey = 'subordinate' | 'manager' | 'peer' | 'self';

interface RespondentGroupOption {
  value: RespondentGroupKey;
  label: string;
  color: string;
  count: number;
}

interface CompetencyOption {
  value: string;
  label: string;
}

interface ScoreLabelProps {
  value?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

const formatScore = (value: number) => (Number.isFinite(value) ? value.toFixed(2) : '0.00');

const getHeatmapCellClassName = (score: number, scaleMax: number) => {
  if (score === 0) return 'bg-black/5 text-black/20';

  const ratio = score / Math.max(scaleMax, 1);
  if (ratio <= 0.55) return 'bg-black text-white';
  if (ratio <= 0.68) return 'bg-brand/10 text-brand';
  if (ratio <= 0.8) return 'bg-brand/40 text-white';
  return 'bg-brand text-white';
};

const CompanyOverviewBlock: React.FC<Props> = ({
  competencies,
  respondentCounts,
  scaleMax,
}) => {
  const [activeExportMenu, setActiveExportMenu] = useState<string | null>(null);
  const [isGroupMenuOpen, setIsGroupMenuOpen] = useState(false);
  const groupOptions: RespondentGroupOption[] = useMemo(
    () => [
      {
        value: 'subordinate',
        label: 'Podriadená/ý',
        color: '#111111',
        count: Number(respondentCounts.subordinate || 0),
      },
      {
        value: 'manager',
        label: 'Nadriadená/ý',
        color: '#4A4A4A',
        count: Number(respondentCounts.manager || 0),
      },
      {
        value: 'peer',
        label: 'Peer',
        color: '#8B8B8B',
        count: Number(respondentCounts.peer || 0),
      },
      {
        value: 'self',
        label: 'Sebahodnotenie',
        color: '#B81547',
        count: Number(respondentCounts.self || 0),
      },
    ],
    [respondentCounts]
  );
  const availableGroupKeys = useMemo(
    () => groupOptions.filter((option) => option.count > 0).map((option) => option.value),
    [groupOptions]
  );
  const competencyOptions: CompetencyOption[] = useMemo(
    () =>
      competencies.map((competency) => ({
        value: competency.id,
        label: competency.label,
      })),
    [competencies]
  );
  const [activeCompetencyId, setActiveCompetencyId] = useState<string>(competencyOptions[0]?.value || '');
  const [selectedGroups, setSelectedGroups] = useState<RespondentGroupKey[]>(availableGroupKeys);

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

  useEffect(() => {
    if (!competencyOptions.some((option) => option.value === activeCompetencyId)) {
      setActiveCompetencyId(competencyOptions[0]?.value || '');
    }
  }, [activeCompetencyId, competencyOptions]);

  useEffect(() => {
    setSelectedGroups((current) => {
      const filtered = current.filter((value) => availableGroupKeys.includes(value));
      if (filtered.length > 0) return filtered;
      return availableGroupKeys;
    });
  }, [availableGroupKeys]);

  const activeCompetency =
    competencies.find((competency) => competency.id === activeCompetencyId) || competencies[0];
  const selectedGroupsLabel =
    selectedGroups.length === 0
      ? 'Vyber skupiny'
      : selectedGroups.length === groupOptions.filter((option) => option.count > 0).length
        ? 'Všetky skupiny'
        : `${selectedGroups.length} skupiny`;
  const selectedGroupOptions = useMemo(
    () => groupOptions.filter((option) => selectedGroups.includes(option.value)),
    [groupOptions, selectedGroups]
  );
  const xAxisTicks = useMemo(
    () => Array.from({ length: Math.max(Math.round(scaleMax), 1) }, (_, index) => index + 1),
    [scaleMax]
  );
  const referenceValue = Math.ceil(scaleMax / 2);

  const chartData = useMemo(
    () => {
      if (!activeCompetency) return [];

      return selectedGroupOptions
        .map((option) => ({
          category: option.label,
          score:
            Number(
              activeCompetency.averages[
                option.value === 'subordinate'
                  ? 'subordinate'
                  : option.value === 'manager'
                    ? 'manager'
                    : option.value === 'peer'
                      ? 'peer'
                      : 'self'
              ]
            ) || 0,
          fill: option.color,
          count: option.count,
        }));
    },
    [activeCompetency, selectedGroupOptions]
  );

  const tableRows = useMemo(
    () =>
      competencies.map((competency) => {
        const subordinate = Number(competency.averages.subordinate) || 0;
        const manager = Number(competency.averages.manager) || 0;
        const peer = Number(competency.averages.peer) || 0;
        const average = Number(competency.averages.average) || 0;
        const self = Number(competency.averages.self) || 0;
        const diff = Number((self - average).toFixed(2));

        return {
          id: competency.id,
          label: competency.label,
          subordinate,
          manager,
          peer,
          average,
          self,
          diff,
        };
      }),
    [competencies]
  );

  const handleOverviewExcelExport = () => {
    exportDataToExcel(
      tableRows.map((row) => ({
        Kompetencia: row.label,
        'Podriadená/ý': Number(row.subordinate.toFixed(2)),
        'Nadriadená/ý': Number(row.manager.toFixed(2)),
        Peer: Number(row.peer.toFixed(2)),
        Priemer: Number(row.average.toFixed(2)),
        Seba: Number(row.self.toFixed(2)),
        Rozdiel: Number(row.diff.toFixed(2)),
      })),
      '360SV_Vysledky_za_celu_firmu.xlsx',
      () => setActiveExportMenu(null)
    );
  };

  const toggleGroup = (group: RespondentGroupKey) => {
    const option = groupOptions.find((item) => item.value === group);
    if (!option || option.count <= 0) return;

    setSelectedGroups((current) => {
      if (current.includes(group)) {
        if (current.length === 1) return current;
        return current.filter((value) => value !== group);
      }

      return [...current, group];
    });
  };

  const matrixRows = useMemo(
    () =>
      competencies.map((competency) => {
        const row: Record<string, unknown> = {
          category: competency.label,
        };

        selectedGroupOptions.forEach((option) => {
          row[option.label] =
            Number(
              competency.averages[
                option.value === 'subordinate'
                  ? 'subordinate'
                  : option.value === 'manager'
                    ? 'manager'
                    : option.value === 'peer'
                      ? 'peer'
                      : 'self'
              ]
            ) || 0;
        });

        return row;
      }),
    [competencies, selectedGroupOptions]
  );

  const renderScoreBadge = (props: unknown) => {
    const safeProps = props as ScoreLabelProps;
    const score = Number(safeProps?.value);
    if (!Number.isFinite(score)) return null;

    const label = score.toFixed(2);
    const x = Number(safeProps?.x ?? 0);
    const y = Number(safeProps?.y ?? 0);
    const width = Number(safeProps?.width ?? 0);
    const height = Number(safeProps?.height ?? 0);
    const badgeHeight = 24;
    const paddingX = 8;
    const fontSize = 12;
    const badgeWidth = Math.max(54, label.length * (fontSize * 0.62) + paddingX * 2);
    const textColor = score >= referenceValue ? '#B81547' : '#111111';

    return (
      <g transform={`translate(${x + width + 10},${y + height / 2 - badgeHeight / 2})`}>
        <rect width={badgeWidth} height={badgeHeight} rx={999} ry={999} fill={textColor} opacity={0.1} />
        <text
          x={badgeWidth / 2}
          y={badgeHeight / 2}
          dy="0.35em"
          textAnchor="middle"
          fill={textColor}
          fontSize={fontSize}
          fontWeight={900}
        >
          {label}
        </text>
      </g>
    );
  };

  return (
    <div className="space-y-8 sm:space-y-10 animate-fade-in">
      <div
        id="block-360-company-overview"
        className="bg-white p-6 sm:p-8 lg:p-10 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-black/5 shadow-2xl"
      >
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center mb-6 sm:mb-8 lg:mb-10 gap-4 sm:gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="bg-brand/5 p-3 rounded-2xl flex-shrink-0">
              <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-brand" />
            </div>
            <div>
              <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-tighter leading-none">
                Výsledky za celú firmu
              </h3>
              <p className="mt-2 text-xs sm:text-sm font-black uppercase tracking-widest text-black/35">
                Zvolená téma: <span className="text-brand">{activeCompetency?.label || 'Bez témy'}</span>
              </p>
            </div>
          </div>

          <div className="relative export-dropdown-container export-buttons print:hidden">
            <button
              onClick={() =>
                setActiveExportMenu(
                  activeExportMenu === 'company-overview' ? null : 'company-overview'
                )
              }
              className="flex items-center justify-center gap-2 px-3 py-2 bg-black/5 hover:bg-black/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-black/60 hover:text-black"
            >
              <Download className="w-3 h-3" /> Export
              <ChevronDown
                className={`w-3 h-3 transition-transform ${
                  activeExportMenu === 'company-overview' ? 'rotate-180' : ''
                }`}
              />
            </button>

            {activeExportMenu === 'company-overview' && (
              <div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-xl border border-black/5 p-2 z-50 flex flex-col gap-1 min-w-[150px] animate-fade-in">
                <button
                  onClick={() =>
                    exportBlockToPDF(
                      'block-360-company-overview',
                      '360SV_Vysledky_za_celu_firmu',
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
                      'block-360-company-overview',
                      '360SV_Vysledky_za_celu_firmu',
                      () => setActiveExportMenu(null)
                    )
                  }
                  className="flex items-center gap-2 w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-black/5 transition-colors"
                >
                  <ImageIcon className="w-3 h-3" /> Obrázok PNG
                </button>
                <button
                  onClick={handleOverviewExcelExport}
                  className="flex items-center gap-2 w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-brand/10 text-brand transition-colors"
                >
                  <Download className="w-3 h-3" /> Excel Dáta
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mb-6 sm:mb-8 flex flex-col xl:flex-row gap-3 sm:gap-4">
          <div className="w-full xl:flex-1">
            <div className="text-[10px] sm:text-xs font-black uppercase tracking-[0.25em] text-black/35 mb-2">
              Téma
            </div>
            <div className="w-full">
              <StyledSelect
                value={activeCompetency?.id || ''}
                onChange={setActiveCompetencyId}
                options={competencyOptions}
                placeholder="Vyber tému"
                wrapperClassName="w-full"
                buttonClassName="min-h-[56px] rounded-2xl border border-black/5 bg-black/[0.03] px-4 sm:px-5 py-3 shadow-sm"
                labelClassName="text-sm sm:text-base font-black uppercase tracking-wide text-black pr-8"
                panelClassName="rounded-2xl"
                optionClassName="text-xs sm:text-sm font-black uppercase tracking-wide"
                selectedOptionClassName="bg-black text-white"
                iconClassName="text-black/35"
                menuAlign="left"
              />
            </div>
          </div>

          <div className="w-full xl:w-[360px]">
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
                        onClick={() => toggleGroup(option.value)}
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
                          <span className={isActive ? 'text-brand/70' : 'text-black/35'}>
                            {option.count}
                          </span>
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

        <div className="h-[420px]">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 94, top: 8, bottom: 16 }}>
                <CartesianGrid strokeDasharray="2 6" horizontal={false} stroke="#00000010" />
                <XAxis
                  type="number"
                  domain={[0, scaleMax]}
                  ticks={xAxisTicks}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fontWeight: 800, fill: '#00000066' }}
                />
                <ReferenceLine
                  x={referenceValue}
                  stroke="#B81547"
                  strokeWidth={1.5}
                  strokeDasharray="4 6"
                  ifOverflow="visible"
                />
                <YAxis
                  dataKey="category"
                  type="category"
                  width={200}
                  interval={0}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 13, fontWeight: 800, fill: '#000000' }}
                />
                <Tooltip
                  cursor={{ fill: '#00000005' }}
                  formatter={(value: number) => [formatScore(Number(value)), 'Skóre']}
                  labelFormatter={(label) => `${activeCompetency?.label || ''} | ${label}`}
                  contentStyle={{
                    borderRadius: '1rem',
                    border: '1px solid #00000010',
                    boxShadow: '0 10px 30px -8px rgba(0,0,0,0.2)',
                    fontWeight: 700,
                  }}
                />
                <Bar
                  dataKey="score"
                  radius={[0, 12, 12, 0]}
                  barSize={44}
                  isAnimationActive={false}
                >
                  {chartData.map((entry) => (
                    <Cell key={`bar-${entry.category}`} fill={entry.fill} />
                  ))}
                  <LabelList dataKey="score" content={renderScoreBadge} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full rounded-[1.25rem] border border-dashed border-black/10 bg-black/[0.02] flex items-center justify-center text-center px-6">
              <p className="text-xs sm:text-sm font-black uppercase tracking-widest text-black/35">
                Pre aktuálny filter zatiaľ nemáme dostupné porovnanie skupín.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white p-6 sm:p-8 lg:p-10 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-black/5 shadow-2xl">
        <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="bg-brand/5 p-3 rounded-2xl flex-shrink-0">
            <LayoutGrid className="w-5 h-5 sm:w-6 sm:h-6 text-brand" />
          </div>
          <div>
            <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-tighter leading-none">
              Kompetenčný sumár firmy
            </h3>
            <p className="mt-2 text-[10px] sm:text-xs font-black uppercase tracking-widest text-black/30">
              Výsledky pre {selectedGroupOptions.length} vybrané skupiny
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-[2rem] border border-black/5">
          <table className="w-full border-collapse min-w-[760px]">
            <thead>
              <tr className="bg-black text-white">
                <th className="p-5 sm:p-6 text-left text-[11px] font-black uppercase tracking-widest sticky left-0 z-20 bg-black min-w-[320px]">
                  Kompetencia
                </th>
                {selectedGroupOptions.map((option) => (
                  <th
                    key={option.value}
                    className="p-5 sm:p-6 text-center text-[10px] font-black uppercase tracking-widest min-w-[150px] border-l border-white/10"
                  >
                    {option.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {matrixRows.map((row, idx) => (
                <tr key={`${String(row.category)}-${idx}`} className="hover:bg-black/[0.02] transition-colors group">
                  <td className="p-5 sm:p-6 text-lg leading-snug font-bold text-black sticky left-0 z-10 bg-white border-r border-black/5 group-hover:bg-[#fcfcfc]">
                    {String(row.category)}
                  </td>
                  {selectedGroupOptions.map((option) => {
                    const score = Number(row[option.label] || 0);

                    return (
                      <td key={`${String(row.category)}-${option.value}`} className="p-0 border-l border-black/5">
                        <div
                          className={`w-full h-full flex items-center justify-center p-5 sm:p-6 text-center font-black text-base transition-all ${getHeatmapCellClassName(
                            score,
                            scaleMax
                          )}`}
                        >
                          {score > 0 ? score.toFixed(2) : '-'}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {matrixRows.length === 0 && (
                <tr>
                  <td
                    colSpan={Math.max(selectedGroupOptions.length + 1, 2)}
                    className="p-8 sm:p-10 text-center text-black/30 font-black uppercase tracking-widest text-xs"
                  >
                    Pre vybraný filter nie sú dostupné kompetencie.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CompanyOverviewBlock;
