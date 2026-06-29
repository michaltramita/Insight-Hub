import React, { useEffect, useState } from 'react';
import type { Feedback360IndividualReport } from '../../types';
import CompetencyRadar from '../RadarChart';
import { exportBlockToPDF, exportBlockToPNG, exportDataToExcel } from '../../utils/exportUtils';
import {
  ChevronDown,
  Download,
  Gauge,
  Image as ImageIcon,
} from 'lucide-react';

interface Props {
  individual: Feedback360IndividualReport;
  individuals: Feedback360IndividualReport[];
  onIndividualChange: (individualId: string) => void;
  scaleMax: number;
}

const formatScore = (value: unknown) => Number(Number(value) || 0).toFixed(2);

const IndividualOverviewBlock: React.FC<Props> = ({
  individual,
  individuals,
  onIndividualChange,
  scaleMax,
}) => {
  const [activeExportMenu, setActiveExportMenu] = useState<string | null>(null);
  const [isIndividualMenuOpen, setIsIndividualMenuOpen] = useState(false);

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

  const overallSelf = individual.competencies.length
    ? individual.competencies.reduce(
        (sum, competency) => sum + (Number(competency.averages.self) || 0),
        0
      ) / individual.competencies.length
    : 0;

  const overallPeer = individual.competencies.length
    ? individual.competencies.reduce(
        (sum, competency) => sum + (Number(competency.averages.peer) || 0),
        0
      ) / individual.competencies.length
    : 0;

  const overallDiff = Number((overallSelf - overallPeer).toFixed(2));

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
            {formatScore(overallSelf)}
          </span>
        </div>
        <div className="bg-white border border-black/5 p-6 sm:p-8 lg:p-10 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] shadow-2xl transition-transform hover:scale-[1.02]">
          <span className="block text-[9px] sm:text-[10px] font-black uppercase text-black/40 mb-2 sm:mb-3 tracking-[0.2em]">
            Celkové priemerné hodnotenie kolegami
          </span>
          <span className="text-5xl sm:text-6xl xl:text-7xl font-black text-black tracking-tighter leading-none">
            {formatScore(overallPeer)}
          </span>
        </div>
        <div className="bg-white border border-black/5 p-6 sm:p-8 lg:p-10 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] shadow-2xl transition-transform hover:scale-[1.02]">
          <span className="block text-[9px] sm:text-[10px] font-black uppercase text-black/40 mb-2 sm:mb-3 tracking-[0.2em]">
            Rozdiel v hodnoteniach
          </span>
          <span
            className={`text-5xl sm:text-6xl xl:text-7xl font-black tracking-tighter leading-none ${
              overallDiff > 0 ? 'text-brand' : overallDiff < 0 ? 'text-black/55' : 'text-black'
            }`}
          >
            {overallDiff > 0 ? '+' : ''}
            {formatScore(overallDiff)}
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
    </div>
  );
};

export default IndividualOverviewBlock;
