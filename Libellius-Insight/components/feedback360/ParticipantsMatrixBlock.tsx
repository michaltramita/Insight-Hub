import React, { useEffect, useMemo, useState } from 'react';
import type { Feedback360ParticipantSummary } from '../../types';
import { exportBlockToPDF, exportBlockToPNG, exportDataToExcel } from '../../utils/exportUtils';
import { Check, ChevronDown, Download, Image as ImageIcon, Table } from 'lucide-react';

interface CompetencyColumn {
  id: string;
  label: string;
}

interface Props {
  participants: Feedback360ParticipantSummary[];
  competencyColumns: CompetencyColumn[];
  activeParticipantTab: string;
  onParticipantTabChange: (tabId: string) => void;
}

type DetailGroupKey = 'subordinate' | 'peer' | 'manager';

const COMPARISON_TAB_ID = 'comparison';
const DETAIL_GROUP_OPTIONS: Array<{ key: DetailGroupKey; label: string }> = [
  { key: 'subordinate', label: 'Podriadená/ý' },
  { key: 'peer', label: 'Peer' },
  { key: 'manager', label: 'Nadriadená/ý' },
];
const score = (value: unknown) => Number(Number(value) || 0).toFixed(2);
const scoreOrDash = (value: number | null) => (value === null ? '—' : score(value));
const averageNullable = (values: Array<number | null>) => {
  const finiteValues = values.filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value)
  );

  if (finiteValues.length === 0) {
    return null;
  }

  return finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length;
};

const ParticipantsMatrixBlock: React.FC<Props> = ({
  participants,
  competencyColumns,
  activeParticipantTab,
  onParticipantTabChange,
}) => {
  const [activeExportMenu, setActiveExportMenu] = useState<string | null>(null);
  const [isParticipantMenuOpen, setIsParticipantMenuOpen] = useState(false);
  const [isCompetencyMenuOpen, setIsCompetencyMenuOpen] = useState(false);
  const [isGroupMenuOpen, setIsGroupMenuOpen] = useState(false);
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>(() =>
    participants.map((participant) => participant.id)
  );
  const [selectedCompetencyIds, setSelectedCompetencyIds] = useState<string[]>(() =>
    competencyColumns.map((column) => column.id)
  );
  const [selectedGroupKeys, setSelectedGroupKeys] = useState<DetailGroupKey[]>(() =>
    DETAIL_GROUP_OPTIONS.map((option) => option.key)
  );

  const isComparisonTab = activeParticipantTab === COMPARISON_TAB_ID;
  const activeParticipant = useMemo(
    () => participants.find((participant) => participant.id === activeParticipantTab),
    [activeParticipantTab, participants]
  );
  const visibleParticipants = useMemo(() => {
    const selectedIds = new Set(selectedParticipantIds);
    return participants.filter((participant) => selectedIds.has(participant.id));
  }, [participants, selectedParticipantIds]);
  const visibleCompetencyColumns = useMemo(() => {
    const selectedIds = new Set(selectedCompetencyIds);
    return competencyColumns.filter((column) => selectedIds.has(column.id));
  }, [competencyColumns, selectedCompetencyIds]);
  const visibleGroupOptions = useMemo(
    () => DETAIL_GROUP_OPTIONS.filter((option) => selectedGroupKeys.includes(option.key)),
    [selectedGroupKeys]
  );
  const activeParticipantRows = useMemo(
    () =>
      activeParticipant
        ? visibleCompetencyColumns.map((column) => {
            const competency = activeParticipant.competencies.find((item) => item.id === column.id);

            return {
              id: column.id,
              label: column.label,
              subordinate: competency ? Number(competency.averages.subordinate) || 0 : null,
              peer: competency ? Number(competency.averages.peer) || 0 : null,
              manager: competency ? Number(competency.averages.manager) || 0 : null,
              average: competency ? Number(competency.averages.average) || 0 : null,
              self: competency ? Number(competency.averages.self) || 0 : null,
            };
          })
        : [],
    [activeParticipant, visibleCompetencyColumns]
  );
  const activeParticipantSummary = useMemo(
    () => ({
      subordinate: averageNullable(activeParticipantRows.map((row) => row.subordinate)),
      peer: averageNullable(activeParticipantRows.map((row) => row.peer)),
      manager: averageNullable(activeParticipantRows.map((row) => row.manager)),
      average: averageNullable(activeParticipantRows.map((row) => row.average)),
      self: averageNullable(activeParticipantRows.map((row) => row.self)),
    }),
    [activeParticipantRows]
  );

  const selectedParticipantsLabel =
    selectedParticipantIds.length === 0
      ? 'Žiadny jednotlivec'
      : selectedParticipantIds.length === participants.length
        ? 'Všetci jednotlivci'
        : `${selectedParticipantIds.length} vybraní`;
  const selectedCompetenciesLabel =
    selectedCompetencyIds.length === 0
      ? 'Žiadna oblasť'
      : selectedCompetencyIds.length === competencyColumns.length
        ? 'Všetky oblasti'
        : `${selectedCompetencyIds.length} vybrané`;
  const selectedGroupsLabel =
    selectedGroupKeys.length === 0
      ? 'Žiadna skupina'
      : selectedGroupKeys.length === DETAIL_GROUP_OPTIONS.length
        ? 'Všetky skupiny'
        : `${selectedGroupKeys.length} vybrané`;

  const toggleParticipant = (participantId: string) => {
    setSelectedParticipantIds((current) =>
      current.includes(participantId)
        ? current.filter((id) => id !== participantId)
        : [...current, participantId]
    );
  };

  const toggleCompetency = (competencyId: string) => {
    setSelectedCompetencyIds((current) =>
      current.includes(competencyId)
        ? current.filter((id) => id !== competencyId)
        : [...current, competencyId]
    );
  };

  const toggleGroup = (groupKey: DetailGroupKey) => {
    setSelectedGroupKeys((current) =>
      current.includes(groupKey)
        ? current.filter((key) => key !== groupKey)
        : [...current, groupKey]
    );
  };

  useEffect(() => {
    const handleGlobalClick = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('.export-dropdown-container')) {
        setActiveExportMenu(null);
      }
      if (!(event.target as HTMLElement).closest('.participant-filter-dropdown-container')) {
        setIsParticipantMenuOpen(false);
      }
      if (!(event.target as HTMLElement).closest('.competency-filter-dropdown-container')) {
        setIsCompetencyMenuOpen(false);
      }
      if (!(event.target as HTMLElement).closest('.group-filter-dropdown-container')) {
        setIsGroupMenuOpen(false);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  useEffect(() => {
    const availableIds = new Set(participants.map((participant) => participant.id));

    if (activeParticipantTab !== COMPARISON_TAB_ID && !availableIds.has(activeParticipantTab)) {
      onParticipantTabChange(COMPARISON_TAB_ID);
    }

    setSelectedParticipantIds((current) => {
      const retainedIds = current.filter((id) => availableIds.has(id));
      return retainedIds.length === current.length ? current : retainedIds;
    });
  }, [activeParticipantTab, onParticipantTabChange, participants]);

  useEffect(() => {
    const availableIds = new Set(competencyColumns.map((column) => column.id));

    setSelectedCompetencyIds((current) => {
      const retainedIds = current.filter((id) => availableIds.has(id));
      return retainedIds.length === current.length ? current : retainedIds;
    });
  }, [competencyColumns]);

  const handleExcelExport = () => {
    if (!isComparisonTab && activeParticipant) {
      exportDataToExcel(
        [
          ...activeParticipantRows.map((row) => {
            const exportRow: Record<string, string | number> = {
              Ucastnik: activeParticipant.name,
              'Oblast hodnotenia': row.label,
            };

            visibleGroupOptions.forEach((option) => {
              exportRow[option.label] =
                row[option.key] === null ? '' : Number(score(row[option.key]));
            });

            exportRow.Priemer = row.average === null ? '' : Number(score(row.average));
            exportRow.Sebahodnotenie = row.self === null ? '' : Number(score(row.self));

            return exportRow;
          }),
          (() => {
            const exportRow: Record<string, string | number> = {
              Ucastnik: activeParticipant.name,
              'Oblast hodnotenia': 'Priemer SPOLU',
            };

            visibleGroupOptions.forEach((option) => {
              const value = activeParticipantSummary[option.key];
              exportRow[option.label] = value === null ? '' : Number(score(value));
            });

            exportRow.Priemer =
              activeParticipantSummary.average === null
                ? ''
                : Number(score(activeParticipantSummary.average));
            exportRow.Sebahodnotenie =
              activeParticipantSummary.self === null
                ? ''
                : Number(score(activeParticipantSummary.self));

            return exportRow;
          })(),
        ],
        `360SV_${activeParticipant.name.replace(/\s+/g, '_')}.xlsx`,
        () => setActiveExportMenu(null)
      );
      return;
    }

    exportDataToExcel(
      visibleParticipants.map((participant) => {
        const row: Record<string, string | number> = {
          Ucastnik: participant.name,
        };

        visibleCompetencyColumns.forEach((column) => {
          const competency = participant.competencies.find((item) => item.id === column.id);
          row[column.label] = competency ? Number(score(competency.averages.average)) : '';
        });

        row['Priemer spolu'] = Number(score(participant.overallAverage));
        row['Sebahodnotenie'] = Number(score(participant.overallSelf));
        return row;
      }),
      '360SV_Vysledky_po_jednotlivcoch.xlsx',
      () => setActiveExportMenu(null)
    );
  };

  return (
    <div className="space-y-8 sm:space-y-10 animate-fade-in">
      <section
        id="block-360-participants"
        className="bg-white p-6 sm:p-8 lg:p-10 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-black/5 shadow-2xl"
      >
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center mb-6 sm:mb-8 lg:mb-10 gap-4 sm:gap-6">
          <div className="flex items-start gap-4 min-w-0">
            <div className="bg-brand/5 p-3 rounded-2xl flex-shrink-0">
              <Table className="w-5 h-5 sm:w-6 sm:h-6 text-brand" />
            </div>
            <div className="min-w-0">
              <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-tighter leading-none">
                {isComparisonTab
                  ? 'Porovnanie výsledkov jednotlivcov'
                  : activeParticipant?.name || 'Výsledky jednotlivca'}
              </h3>
              <p className="text-xs sm:text-sm font-bold text-black/40 mt-3 max-w-4xl">
                {isComparisonTab
                  ? 'Maticový prehľad hodnotených osôb a ich priemerov v jednotlivých kompetenciách.'
                  : 'Súhrnný prehľad hodnotení vybranej osoby podľa oblastí a skupín hodnotiteľov.'}
              </p>
            </div>
          </div>

          <div
            className="relative export-dropdown-container export-buttons print:hidden"
            data-html2canvas-ignore="true"
          >
            <button
              onClick={() =>
                setActiveExportMenu(activeExportMenu === 'participants' ? null : 'participants')
              }
              className="flex items-center justify-center gap-2 px-3 py-2 bg-black/5 hover:bg-black/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-black/60 hover:text-black"
            >
              <Download className="w-3 h-3" /> Export
              <ChevronDown
                className={`w-3 h-3 transition-transform ${
                  activeExportMenu === 'participants' ? 'rotate-180' : ''
                }`}
              />
            </button>

            {activeExportMenu === 'participants' && (
              <div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-xl border border-black/5 p-2 z-50 flex flex-col gap-1 min-w-[150px] animate-fade-in">
                <button
                  onClick={() =>
                    exportBlockToPDF('block-360-participants', '360SV_Vysledky_po_jednotlivcoch', () =>
                      setActiveExportMenu(null)
                    )
                  }
                  className="flex items-center gap-2 w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-black/5 transition-colors"
                >
                  PDF Dokument
                </button>
                <button
                  onClick={() =>
                    exportBlockToPNG('block-360-participants', '360SV_Vysledky_po_jednotlivcoch', () =>
                      setActiveExportMenu(null)
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

        <div
          className={`mb-6 sm:mb-8 grid grid-cols-1 gap-4 sm:gap-5 ${
            isComparisonTab ? 'xl:grid-cols-2' : 'xl:grid-cols-2 max-w-5xl'
          }`}
        >
          {isComparisonTab && (
            <div className="participant-filter-dropdown-container">
              <div className="text-[10px] sm:text-xs font-black uppercase tracking-[0.25em] text-black/35 mb-2">
                Jednotlivci na porovnanie
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsParticipantMenuOpen((prev) => !prev)}
                  className="relative w-full min-h-[56px] rounded-2xl border border-black/5 bg-black/[0.03] px-4 sm:px-5 py-3 shadow-sm text-left focus:outline-none focus:ring-2 focus:ring-brand/30 transition-all"
                  aria-haspopup="listbox"
                  aria-expanded={isParticipantMenuOpen}
                >
                  <span className="block truncate pr-10 text-sm sm:text-base font-black uppercase tracking-wide text-black">
                    {selectedParticipantsLabel}
                  </span>
                  <ChevronDown
                    className={`pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-black/35 transition-transform ${
                      isParticipantMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isParticipantMenuOpen && (
                  <div
                    role="listbox"
                    className="absolute left-0 z-50 mt-2 w-full rounded-2xl border border-black/10 bg-white p-2 shadow-2xl"
                  >
                    <div className="grid grid-cols-2 gap-2 p-1 pb-2">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedParticipantIds(participants.map((participant) => participant.id))
                        }
                        className="rounded-xl bg-black/[0.03] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-black/55 hover:bg-brand/10 hover:text-brand transition-colors"
                      >
                        Vybrať všetkých
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedParticipantIds([])}
                        className="rounded-xl bg-black/[0.03] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-black/55 hover:bg-black/10 transition-colors"
                      >
                        Zrušiť výber
                      </button>
                    </div>

                    <div className="max-h-72 overflow-y-auto space-y-1">
                      {participants.map((participant) => {
                        const isActive = selectedParticipantIds.includes(participant.id);

                        return (
                          <button
                            key={participant.id}
                            type="button"
                            role="option"
                            aria-selected={isActive}
                            onClick={() => toggleParticipant(participant.id)}
                            className={`w-full px-4 py-3 rounded-xl text-left text-sm font-bold transition-all flex items-center justify-between gap-3 ${
                              isActive
                                ? 'bg-brand/12 text-brand border border-brand/15'
                                : 'text-black/70 hover:bg-black/5'
                            }`}
                          >
                            <span className="truncate">{participant.name}</span>
                            {isActive && <Check className="w-4 h-4 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="competency-filter-dropdown-container">
            <div className="text-[10px] sm:text-xs font-black uppercase tracking-[0.25em] text-black/35 mb-2">
              Oblasti
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsCompetencyMenuOpen((prev) => !prev)}
                className="relative w-full min-h-[56px] rounded-2xl border border-black/5 bg-black/[0.03] px-4 sm:px-5 py-3 shadow-sm text-left focus:outline-none focus:ring-2 focus:ring-brand/30 transition-all"
                aria-haspopup="listbox"
                aria-expanded={isCompetencyMenuOpen}
              >
                <span className="block truncate pr-10 text-sm sm:text-base font-black uppercase tracking-wide text-black">
                  {selectedCompetenciesLabel}
                </span>
                <ChevronDown
                  className={`pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-black/35 transition-transform ${
                    isCompetencyMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isCompetencyMenuOpen && (
                <div
                  role="listbox"
                  className="absolute left-0 z-50 mt-2 w-full rounded-2xl border border-black/10 bg-white p-2 shadow-2xl"
                >
                  <div className="grid grid-cols-2 gap-2 p-1 pb-2">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedCompetencyIds(competencyColumns.map((column) => column.id))
                      }
                      className="rounded-xl bg-black/[0.03] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-black/55 hover:bg-brand/10 hover:text-brand transition-colors"
                    >
                      Vybrať všetky
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedCompetencyIds([])}
                      className="rounded-xl bg-black/[0.03] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-black/55 hover:bg-black/10 transition-colors"
                    >
                      Zrušiť výber
                    </button>
                  </div>

                  <div className="max-h-72 overflow-y-auto space-y-1">
                    {competencyColumns.map((column) => {
                      const isActive = selectedCompetencyIds.includes(column.id);

                      return (
                        <button
                          key={column.id}
                          type="button"
                          role="option"
                          aria-selected={isActive}
                          onClick={() => toggleCompetency(column.id)}
                          className={`w-full px-4 py-3 rounded-xl text-left text-sm font-bold transition-all flex items-center justify-between gap-3 ${
                            isActive
                              ? 'bg-brand/12 text-brand border border-brand/15'
                              : 'text-black/70 hover:bg-black/5'
                          }`}
                        >
                          <span className="truncate">{column.label}</span>
                          {isActive && <Check className="w-4 h-4 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {!isComparisonTab && (
            <div className="group-filter-dropdown-container">
              <div className="text-[10px] sm:text-xs font-black uppercase tracking-[0.25em] text-black/35 mb-2">
                Skupiny
              </div>
              <div className="relative">
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
                    className="absolute left-0 z-50 mt-2 w-full rounded-2xl border border-black/10 bg-white p-2 shadow-2xl"
                  >
                    <div className="grid grid-cols-2 gap-2 p-1 pb-2">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedGroupKeys(DETAIL_GROUP_OPTIONS.map((option) => option.key))
                        }
                        className="rounded-xl bg-black/[0.03] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-black/55 hover:bg-brand/10 hover:text-brand transition-colors"
                      >
                        Vybrať všetky
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedGroupKeys([])}
                        className="rounded-xl bg-black/[0.03] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-black/55 hover:bg-black/10 transition-colors"
                      >
                        Zrušiť výber
                      </button>
                    </div>

                    <div className="max-h-72 overflow-y-auto space-y-1">
                      {DETAIL_GROUP_OPTIONS.map((option) => {
                        const isActive = selectedGroupKeys.includes(option.key);

                        return (
                          <button
                            key={option.key}
                            type="button"
                            role="option"
                            aria-selected={isActive}
                            onClick={() => toggleGroup(option.key)}
                            className={`w-full px-4 py-3 rounded-xl text-left text-sm font-bold transition-all flex items-center justify-between gap-3 ${
                              isActive
                                ? 'bg-brand/12 text-brand border border-brand/15'
                                : 'text-black/70 hover:bg-black/5'
                            }`}
                          >
                            <span className="truncate">{option.label}</span>
                            {isActive && <Check className="w-4 h-4 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {isComparisonTab ? (
          <div className="overflow-x-auto rounded-2xl sm:rounded-3xl border border-black/5">
            <table className="w-full min-w-[980px] text-left">
              <thead className="bg-[#fcfcfc] text-sm font-black uppercase tracking-widest text-black/60 border-b border-black/5">
                <tr>
                  <th className="p-4 sm:p-6 sticky left-0 bg-[#fcfcfc] z-10">Účastník</th>
                  {visibleCompetencyColumns.map((column) => (
                    <th key={column.id} className="p-4 sm:p-6 text-center">
                      {column.label}
                    </th>
                  ))}
                  <th className="p-4 sm:p-6 text-center">Priemer spolu</th>
                  <th className="p-4 sm:p-6 text-center">Sebahodnotenie</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 font-black text-sm">
                {visibleParticipants.map((participant) => (
                  <tr key={participant.id} className="hover:bg-brand/5 transition-colors group">
                    <td className="p-4 sm:p-6 sticky left-0 bg-white group-hover:bg-brand/5 text-black/85 group-hover:text-brand transition-colors z-10">
                      {participant.name}
                    </td>
                    {visibleCompetencyColumns.map((column) => {
                      const competency = participant.competencies.find(
                        (item) => item.id === column.id
                      );
                      return (
                        <td key={column.id} className="p-4 sm:p-6 text-center">
                          {competency ? score(competency.averages.average) : '—'}
                        </td>
                      );
                    })}
                    <td className="p-4 sm:p-6 text-center text-brand">
                      {score(participant.overallAverage)}
                    </td>
                    <td className="p-4 sm:p-6 text-center">{score(participant.overallSelf)}</td>
                  </tr>
                ))}
                {visibleParticipants.length === 0 && (
                  <tr>
                    <td
                      colSpan={visibleCompetencyColumns.length + 3}
                      className="p-8 sm:p-10 text-center text-black/30 font-black uppercase tracking-widest text-xs"
                    >
                      Vyber aspoň jedného jednotlivca pre porovnanie
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl sm:rounded-3xl border border-black/5 shadow-2xl">
            <table className="w-full min-w-[900px] text-left">
              <thead className="bg-[#fcfcfc] text-sm font-black uppercase tracking-widest text-black/60 border-b border-black/5">
                <tr>
                  <th className="p-4 sm:p-6 text-left">
                    Oblasť hodnotenia
                  </th>
                  {visibleGroupOptions.map((option) => (
                    <th key={option.key} className="p-4 sm:p-6 text-center">
                      {option.label}
                    </th>
                  ))}
                  <th className="p-4 sm:p-6 text-center text-brand">
                    Priemer
                  </th>
                  <th className="p-4 sm:p-6 text-center">
                    Sebahodnotenie
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 font-black text-sm text-black">
                {activeParticipantRows.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-brand/5">
                    <td className="p-4 sm:p-6 text-black/85">
                      {row.label}
                    </td>
                    {visibleGroupOptions.map((option) => (
                      <td key={option.key} className="p-4 sm:p-6 text-center">
                        {scoreOrDash(row[option.key])}
                      </td>
                    ))}
                    <td className="p-4 sm:p-6 text-center text-brand">
                      {scoreOrDash(row.average)}
                    </td>
                    <td className="p-4 sm:p-6 text-center">
                      {scoreOrDash(row.self)}
                    </td>
                  </tr>
                ))}
                {activeParticipant && activeParticipantRows.length > 0 && (
                  <tr className="font-black bg-black/[0.025] border-t border-black/10">
                    <td className="p-4 sm:p-6 text-black uppercase tracking-wide">
                      Priemer SPOLU
                    </td>
                    {visibleGroupOptions.map((option) => (
                      <td key={option.key} className="p-4 sm:p-6 text-center">
                        {scoreOrDash(activeParticipantSummary[option.key])}
                      </td>
                    ))}
                    <td className="p-4 sm:p-6 text-center text-brand">
                      {scoreOrDash(activeParticipantSummary.average)}
                    </td>
                    <td className="p-4 sm:p-6 text-center">
                      {scoreOrDash(activeParticipantSummary.self)}
                    </td>
                  </tr>
                )}
                {activeParticipant && activeParticipantRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={visibleGroupOptions.length + 3}
                      className="p-8 sm:p-10 text-center text-black/30 font-black uppercase tracking-widest text-xs"
                    >
                      Vyber aspoň jednu oblasť
                    </td>
                  </tr>
                )}
                {!activeParticipant && (
                  <tr>
                    <td
                      colSpan={visibleGroupOptions.length + 3}
                      className="p-8 sm:p-10 text-center text-black/30 font-black uppercase tracking-widest text-xs"
                    >
                      Vyber jednotlivca
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default ParticipantsMatrixBlock;
