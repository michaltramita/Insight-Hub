import React, { useEffect, useMemo, useState } from 'react';
import type {
  Feedback360CompetencyResult,
  Feedback360RespondentCounts,
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
import Feedback360FrequencyChart, {
  buildFeedback360FrequencyChartRows,
  FEEDBACK360_FREQUENCY_BUCKETS,
  FrequencyBucketKey,
} from './Feedback360FrequencyChart';

interface Props {
  competencies: Feedback360CompetencyResult[];
  respondentCounts: Feedback360RespondentCounts;
  title: string;
}

type RespondentGroupKey = 'subordinate' | 'manager' | 'peer' | 'self';
type SelectableRespondentGroupKey = Exclude<RespondentGroupKey, 'self'>;
const FREQUENCY_ALL_VALUE = '__ALL__';

interface RespondentGroupOption {
  value: RespondentGroupKey;
  label: string;
  color: string;
  count: number;
}

const score = (value: unknown) => Number(Number(value) || 0).toFixed(2);
const scoreOrDash = (value: number | null) => (value === null ? '—' : score(value));
const positiveScoreOrNull = (value: unknown) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null;
};

const fileSafe = (value: string) => value.replace(/\s+/g, '_').replace(/[^\w.-]+/g, '_');

const CompanyDetailBlock: React.FC<Props> = ({ competencies, respondentCounts, title }) => {
  const [activeCompetencyId, setActiveCompetencyId] = useState<string>('');
  const [activeExportMenu, setActiveExportMenu] = useState<string | null>(null);
  const [isGroupMenuOpen, setIsGroupMenuOpen] = useState(false);
  const [selectedFrequencyBucket, setSelectedFrequencyBucket] =
    useState<FrequencyBucketKey | null>(null);

  useEffect(() => {
    if (!competencies.length) {
      if (activeCompetencyId) setActiveCompetencyId('');
      return;
    }

    const exists = competencies.some((competency) => competency.id === activeCompetencyId);
    if (!exists) {
      setActiveCompetencyId(competencies[0].id);
    }
  }, [competencies, activeCompetencyId]);

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
    competencies.find((competency) => competency.id === activeCompetencyId) ||
    (competencies.length ? competencies[0] : null);
  const competencyOptions = useMemo(
    () =>
      competencies.map((competency) => ({
        value: competency.id,
        label: competency.label,
      })),
    [competencies]
  );
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
  const selectableGroupOptions = useMemo(
    () => groupOptions.filter((option) => option.value !== 'self'),
    [groupOptions]
  );
  const availableGroupKeys = useMemo(
    () =>
      selectableGroupOptions
        .filter((option) => option.count > 0)
        .map((option) => option.value as SelectableRespondentGroupKey),
    [selectableGroupOptions]
  );
  const [selectedGroups, setSelectedGroups] = useState<SelectableRespondentGroupKey[]>(availableGroupKeys);
  useEffect(() => {
    setSelectedGroups((current) =>
      current.filter((value) => availableGroupKeys.includes(value))
    );
  }, [availableGroupKeys]);

  const selectedGroupsLabel =
    selectedGroups.length === 0
      ? 'Vyber skupiny'
      : selectedGroups.length === selectableGroupOptions.filter((option) => option.count > 0).length
        ? 'Všetky skupiny'
        : `${selectedGroups.length} skupiny`;
  const selectedGroupOptions = useMemo(
    () => selectableGroupOptions.filter((option) => selectedGroups.includes(option.value)),
    [selectableGroupOptions, selectedGroups]
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
    const tailColumns = [{ key: 'average', label: 'Priemer' }] as const;
    const selfAndDiffColumns = [{ key: 'self', label: 'Sebahodnotenie' }, { key: 'diff', label: 'Rozdiel' }] as const;

    return [...groupColumns, ...tailColumns, ...selfAndDiffColumns];
  }, [selectedGroupOptions]);

  const frequencyRows = useMemo(
    () => buildFeedback360FrequencyChartRows(tableRows),
    [tableRows]
  );

  const activeSummary = useMemo(() => {
    if (!activeCompetency) return null;
    const hasImportedSummary = activeCompetency.averagesSource === 'imported';
    const importedAverage = hasImportedSummary
      ? positiveScoreOrNull(activeCompetency.averages.average)
      : null;
    const importedSelf = hasImportedSummary
      ? positiveScoreOrNull(activeCompetency.averages.self)
      : null;
    const diff =
      importedAverage !== null && importedSelf !== null
        ? Number((importedSelf - importedAverage).toFixed(2))
        : null;

    return {
      statementsCount: activeCompetency.statements.length,
      self: importedSelf,
      diff,
      selectedGroupAverage: importedAverage,
    };
  }, [activeCompetency]);

  const exportBaseName = activeCompetency
    ? fileSafe(`360SV_Detail_${activeCompetency.label}`)
    : '360SV_Detail_kompetencie';

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
    ...FEEDBACK360_FREQUENCY_BUCKETS.map((bucket) => ({
      value: bucket.key,
      label: `Hodnota ${bucket.label}`,
    })),
  ];

  return (
    <div className="space-y-8 sm:space-y-10 animate-fade-in">
      {activeCompetency && (
        <section
          id="block-360-company-detail"
          className="bg-white p-6 sm:p-8 lg:p-10 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-black/5 shadow-2xl"
        >
          <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center mb-6 sm:mb-8 lg:mb-10 gap-4 sm:gap-6">
            <div className="flex items-start gap-4 min-w-0">
              <div className="bg-brand/5 p-3 rounded-2xl flex-shrink-0">
                <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-brand" />
              </div>
              <div className="min-w-0">
                <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-tighter leading-none break-words">
                  {title}
                </h3>
                <p className="text-xs sm:text-sm font-black uppercase tracking-[0.2em] text-black/30 mt-2">
                  Detail tvrdení podľa vybranej oblasti a skupiny
                </p>
              </div>
            </div>

            <div
              className="relative export-dropdown-container export-buttons print:hidden"
              data-html2canvas-ignore="true"
            >
              <button
                onClick={() =>
                  setActiveExportMenu(activeExportMenu === 'company-detail' ? null : 'company-detail')
                }
                className="flex items-center justify-center gap-2 px-3 py-2 bg-black/5 hover:bg-black/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-black/60 hover:text-black"
              >
                <Download className="w-3 h-3" /> Export
                <ChevronDown
                  className={`w-3 h-3 transition-transform ${
                    activeExportMenu === 'company-detail' ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {activeExportMenu === 'company-detail' && (
                <div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-xl border border-black/5 p-2 z-50 flex flex-col gap-1 min-w-[150px] animate-fade-in">
                  <button
                    onClick={() =>
                      exportBlockToPDF('block-360-company-detail', exportBaseName, () =>
                        setActiveExportMenu(null)
                      )
                    }
                    className="flex items-center gap-2 w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-black/5 transition-colors"
                  >
                    PDF Dokument
                  </button>
                  <button
                    onClick={() =>
                      exportBlockToPNG('block-360-company-detail', exportBaseName, () =>
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
                  Skupina
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
                      {selectableGroupOptions.map((option) => {
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
                  {scoreOrDash(activeSummary.selectedGroupAverage)}
                </p>
              </div>
              <div className="rounded-2xl sm:rounded-3xl bg-black/5 border border-black/5 p-4 sm:p-5">
                <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-black/35">
                  Sebahodnotenie
                </p>
                <p className="text-3xl sm:text-4xl font-black tracking-tighter mt-1">
                  {scoreOrDash(activeSummary.self)}
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
                      : activeSummary.diff !== null && activeSummary.diff < 0
                      ? 'text-black/55'
                      : 'text-black'
                  }`}
                >
                  {activeSummary.diff !== null && activeSummary.diff > 0 ? '+' : ''}
                  {scoreOrDash(activeSummary.diff)}
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
                      const rawValue = row[column.key as keyof typeof row];
                      const numericValue = Number(rawValue || 0);
                      const isDiffColumn = column.key === 'diff';

                      return (
                        <td
                          key={`${row.id}-${column.key}`}
                          className={`p-4 sm:p-6 text-center ${
                            isDiffColumn
                              ? numericValue > 0
                                ? 'text-brand'
                                : numericValue < 0
                                  ? 'text-black/60'
                                  : 'text-black'
                              : ''
                          }`}
                        >
                          {isDiffColumn && numericValue > 0 ? '+' : ''}
                          {score(numericValue)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {tableRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={visibleColumns.length + 1}
                      className="p-8 sm:p-10 text-center text-black/30 font-black uppercase tracking-widest text-xs"
                    >
                      Táto kompetencia zatiaľ neobsahuje detailné tvrdenia
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

	        </section>
	      )}

	      {activeCompetency && frequencyRows.length > 0 && (
	        <section
	          id="block-360-company-frequency"
	          className="bg-white p-6 sm:p-8 lg:p-10 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-black/5 shadow-2xl"
	        >
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
              </div>

              <Feedback360FrequencyChart
	                rows={frequencyRows}
	                selectedBucket={selectedFrequencyBucket}
	              />
	        </section>
	      )}

      {competencies.length === 0 && (
        <div className="bg-white p-10 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-black/5 shadow-2xl text-center">
          <p className="font-black text-lg text-black/55">
            Detail kompetencií zatiaľ nie je dostupný.
          </p>
        </div>
      )}
    </div>
  );
};

export default CompanyDetailBlock;
