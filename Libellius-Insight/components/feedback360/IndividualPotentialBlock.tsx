import React, { useEffect, useState } from 'react';
import type { Feedback360PotentialItem } from '../../types';
import { exportBlockToPDF, exportBlockToPNG, exportDataToExcel } from '../../utils/exportUtils';
import {
  AlertCircle,
  ChevronDown,
  Download,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react';

interface Props {
  overestimatedPotential: Feedback360PotentialItem[];
  hiddenPotential: Feedback360PotentialItem[];
}

const score = (value: unknown) => Number(Number(value) || 0).toFixed(2);

const IndividualPotentialBlock: React.FC<Props> = ({
  overestimatedPotential,
  hiddenPotential,
}) => {
  const [activeExportMenu, setActiveExportMenu] = useState<string | null>(null);

  useEffect(() => {
    const handleGlobalClick = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('.export-dropdown-container')) {
        setActiveExportMenu(null);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const handleExcelExport = () => {
    exportDataToExcel(
      [
        ...overestimatedPotential.map((item) => ({
          Typ: 'Preceňovaný potenciál',
          Tvrdenie: item.statement,
          Oblast: item.competencyLabel,
          Priemer: Number(score(item.average)),
          Seba: Number(score(item.self)),
          Rozdiel: Number(score(item.diff)),
        })),
        ...hiddenPotential.map((item) => ({
          Typ: 'Skrytý potenciál',
          Tvrdenie: item.statement,
          Oblast: item.competencyLabel,
          Priemer: Number(score(item.average)),
          Seba: Number(score(item.self)),
          Rozdiel: Number(score(item.diff)),
        })),
      ],
      '360SV_Potencial_jednotlivca.xlsx',
      () => setActiveExportMenu(null)
    );
  };

  const renderTable = (items: Feedback360PotentialItem[], type: 'overestimated' | 'hidden') => (
    <div className="overflow-x-auto rounded-2xl sm:rounded-3xl border border-black/5">
      <table className="w-full min-w-[720px] text-left">
        <thead className="bg-[#fcfcfc] text-sm font-black uppercase tracking-widest text-black/60 border-b border-black/5">
          <tr>
            <th className="p-4 sm:p-5">Tvrdenie</th>
            <th className="p-4 sm:p-5">Oblasť</th>
            <th className="p-4 sm:p-5 text-center">Priemer</th>
            <th className="p-4 sm:p-5 text-center">Seba</th>
            <th className="p-4 sm:p-5 text-center">Rozdiel</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5 font-black text-sm">
          {items.map((item) => (
            <tr key={item.statementId} className="hover:bg-brand/5 transition-colors group">
              <td className="p-4 sm:p-5 font-bold text-black/80 group-hover:text-brand transition-colors">
                {item.statement}
              </td>
              <td className="p-4 sm:p-5 text-black/55">{item.competencyLabel}</td>
              <td className="p-4 sm:p-5 text-center">{score(item.average)}</td>
              <td className="p-4 sm:p-5 text-center">{score(item.self)}</td>
              <td
                className={`p-4 sm:p-5 text-center ${
                  type === 'overestimated' ? 'text-brand' : 'text-black/65'
                }`}
              >
                {item.diff > 0 ? '+' : ''}
                {score(item.diff)}
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={5} className="p-8 sm:p-10 text-center text-black/30 font-black uppercase tracking-widest text-xs">
                Zatiaľ nie sú dostupné údaje
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-8 sm:space-y-10 animate-fade-in">
      <section
        id="block-360-potential"
        className="bg-white p-6 sm:p-8 lg:p-10 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-black/5 shadow-2xl"
      >
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center mb-6 sm:mb-8 lg:mb-10 gap-4 sm:gap-6">
          <div className="flex items-start gap-4 min-w-0">
            <div className="bg-brand/5 p-3 rounded-2xl flex-shrink-0">
              <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-brand" />
            </div>
            <div className="min-w-0">
              <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-tighter leading-none">
                Potenciál jednotlivca
              </h3>
              <p className="text-xs sm:text-sm font-bold text-black/40 mt-3 max-w-4xl">
                Preceňovaný potenciál ukazuje oblasti, kde je sebahodnotenie vyššie ako hodnotenie
                okolia. Skrytý potenciál ukazuje rezervu vo vlastnom vnímaní.
              </p>
            </div>
          </div>

          <div
            className="relative export-dropdown-container export-buttons print:hidden"
            data-html2canvas-ignore="true"
          >
            <button
              onClick={() =>
                setActiveExportMenu(activeExportMenu === 'potential' ? null : 'potential')
              }
              className="flex items-center justify-center gap-2 px-3 py-2 bg-black/5 hover:bg-black/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-black/60 hover:text-black"
            >
              <Download className="w-3 h-3" /> Export
              <ChevronDown
                className={`w-3 h-3 transition-transform ${
                  activeExportMenu === 'potential' ? 'rotate-180' : ''
                }`}
              />
            </button>

            {activeExportMenu === 'potential' && (
              <div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-xl border border-black/5 p-2 z-50 flex flex-col gap-1 min-w-[150px] animate-fade-in">
                <button
                  onClick={() =>
                    exportBlockToPDF('block-360-potential', '360SV_Potencial_jednotlivca', () =>
                      setActiveExportMenu(null)
                    )
                  }
                  className="flex items-center gap-2 w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-black/5 transition-colors"
                >
                  PDF Dokument
                </button>
                <button
                  onClick={() =>
                    exportBlockToPNG('block-360-potential', '360SV_Potencial_jednotlivca', () =>
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

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 sm:gap-8">
          <div className="rounded-[1.25rem] sm:rounded-[1.75rem] bg-brand/[0.04] border border-brand/10 p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-brand text-white flex items-center justify-center">
                <AlertCircle className="w-5 h-5" />
              </div>
              <h4 className="text-lg sm:text-xl font-black uppercase tracking-tight">
                Preceňovaný potenciál
              </h4>
            </div>
            {renderTable(overestimatedPotential, 'overestimated')}
          </div>

          <div className="rounded-[1.25rem] sm:rounded-[1.75rem] bg-black/[0.02] border border-black/5 p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <h4 className="text-lg sm:text-xl font-black uppercase tracking-tight">
                Skrytý potenciál
              </h4>
            </div>
            {renderTable(hiddenPotential, 'hidden')}
          </div>
        </div>
      </section>
    </div>
  );
};

export default IndividualPotentialBlock;
