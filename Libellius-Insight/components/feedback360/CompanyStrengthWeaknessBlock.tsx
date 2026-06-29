import React, { useEffect, useState } from 'react';
import type { Feedback360StrengthWeaknessItem } from '../../types';
import { exportBlockToPDF, exportBlockToPNG, exportDataToExcel } from '../../utils/exportUtils';
import {
  ChevronDown,
  Download,
  Image as ImageIcon,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

interface Props {
  strengths: Feedback360StrengthWeaknessItem[];
  developmentNeeds: Feedback360StrengthWeaknessItem[];
}

const score = (value: number) => Number(value || 0).toFixed(2);

const CompanyStrengthWeaknessBlock: React.FC<Props> = ({ strengths, developmentNeeds }) => {
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
        ...strengths.map((item, index) => ({
          Typ: 'Silná stránka',
          Poradie: index + 1,
          Tvrdenie: item.statement,
          Oblast: item.competencyLabel,
          Priemer: Number(score(item.average)),
        })),
        ...developmentNeeds.map((item, index) => ({
          Typ: 'Rozvojová potreba',
          Poradie: index + 1,
          Tvrdenie: item.statement,
          Oblast: item.competencyLabel,
          Priemer: Number(score(item.average)),
        })),
      ],
      '360SV_Silne_a_slabe_stranky.xlsx',
      () => setActiveExportMenu(null)
    );
  };

  const renderTable = (
    items: Feedback360StrengthWeaknessItem[],
    type: 'strengths' | 'development'
  ) => (
    <div className="overflow-x-auto rounded-2xl sm:rounded-3xl border border-black/5">
      <table className="w-full min-w-[620px] text-left">
        <thead className="bg-[#fcfcfc] text-sm font-black uppercase tracking-widest text-black/60 border-b border-black/5">
          <tr>
            <th className="p-4 sm:p-5 text-center w-16">#</th>
            <th className="p-4 sm:p-5">Tvrdenie</th>
            <th className="p-4 sm:p-5">Oblasť</th>
            <th className="p-4 sm:p-5 text-center">Priemer</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5 font-black text-sm">
          {items.map((item, index) => (
            <tr
              key={item.statementId}
              className="hover:bg-brand/5 transition-colors group"
            >
              <td className="p-4 sm:p-5 text-center text-black/45">{index + 1}</td>
              <td className="p-4 sm:p-5 font-bold text-black/80 group-hover:text-brand transition-colors">
                {item.statement}
              </td>
              <td className="p-4 sm:p-5 text-black/55">{item.competencyLabel}</td>
              <td
                className={`p-4 sm:p-5 text-center ${
                  type === 'development' ? 'text-brand' : 'text-black'
                }`}
              >
                {score(item.average)}
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={4} className="p-8 sm:p-10 text-center text-black/30 font-black uppercase tracking-widest text-xs">
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
        id="block-360-strengths"
        className="bg-white p-6 sm:p-8 lg:p-10 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-black/5 shadow-2xl"
      >
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center mb-6 sm:mb-8 lg:mb-10 gap-4 sm:gap-6">
          <div className="flex items-start gap-4 min-w-0">
            <div className="bg-brand/5 p-3 rounded-2xl flex-shrink-0">
              <Target className="w-5 h-5 sm:w-6 sm:h-6 text-brand" />
            </div>
            <div className="min-w-0">
              <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-tighter leading-none">
                Silné a slabé stránky
              </h3>
              <p className="text-xs sm:text-sm font-bold text-black/40 mt-3 max-w-4xl">
                Top položky podľa priemerného hodnotenia. Silné stránky sú opora pre ďalšie
                budovanie, slabšie oblasti sú prioritou rozvoja.
              </p>
            </div>
          </div>

          <div
            className="relative export-dropdown-container export-buttons print:hidden"
            data-html2canvas-ignore="true"
          >
            <button
              onClick={() =>
                setActiveExportMenu(activeExportMenu === 'strengths' ? null : 'strengths')
              }
              className="flex items-center justify-center gap-2 px-3 py-2 bg-black/5 hover:bg-black/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-black/60 hover:text-black"
            >
              <Download className="w-3 h-3" /> Export
              <ChevronDown
                className={`w-3 h-3 transition-transform ${
                  activeExportMenu === 'strengths' ? 'rotate-180' : ''
                }`}
              />
            </button>

            {activeExportMenu === 'strengths' && (
              <div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-xl border border-black/5 p-2 z-50 flex flex-col gap-1 min-w-[150px] animate-fade-in">
                <button
                  onClick={() =>
                    exportBlockToPDF('block-360-strengths', '360SV_Silne_a_slabe_stranky', () =>
                      setActiveExportMenu(null)
                    )
                  }
                  className="flex items-center gap-2 w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-black/5 transition-colors"
                >
                  PDF Dokument
                </button>
                <button
                  onClick={() =>
                    exportBlockToPNG('block-360-strengths', '360SV_Silne_a_slabe_stranky', () =>
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
          <div className="rounded-[1.25rem] sm:rounded-[1.75rem] bg-black/[0.02] border border-black/5 p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h4 className="text-lg sm:text-xl font-black uppercase tracking-tight">
                Silné stránky
              </h4>
            </div>
            {renderTable(strengths, 'strengths')}
          </div>

          <div className="rounded-[1.25rem] sm:rounded-[1.75rem] bg-brand/[0.04] border border-brand/10 p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-brand text-white flex items-center justify-center">
                <TrendingDown className="w-5 h-5" />
              </div>
              <h4 className="text-lg sm:text-xl font-black uppercase tracking-tight">
                Rozvojové potreby
              </h4>
            </div>
            {renderTable(developmentNeeds, 'development')}
          </div>
        </div>
      </section>
    </div>
  );
};

export default CompanyStrengthWeaknessBlock;
