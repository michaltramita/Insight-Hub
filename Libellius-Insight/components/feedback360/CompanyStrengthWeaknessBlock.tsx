import React from 'react';
import type { Feedback360StrengthWeaknessItem } from '../../types';
import { Target, TrendingDown, TrendingUp } from 'lucide-react';

interface Props {
  strengths: Feedback360StrengthWeaknessItem[];
  developmentNeeds: Feedback360StrengthWeaknessItem[];
}

const score = (value: number) => Number(value || 0).toFixed(2);

const CompanyStrengthWeaknessBlock: React.FC<Props> = ({ strengths, developmentNeeds }) => {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-[2rem] border border-black/5 p-6 md:p-8 shadow-2xl shadow-black/5">
        <div className="flex items-center gap-3">
          <Target className="w-5 h-5 text-brand" />
          <h3 className="text-xl font-black uppercase tracking-tight">
            Silné a slabé stránky firmy
          </h3>
        </div>
        <p className="text-black/60 font-semibold mt-3 max-w-4xl">
          Top položky podľa priemerného hodnotenia. Silné stránky sú opora pre ďalšie budovanie,
          slabšie oblasti sú prioritou rozvoja.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-white rounded-[2rem] border border-black/5 p-6 shadow-2xl shadow-black/5">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-5 h-5 text-black" />
            <h4 className="text-lg font-black uppercase tracking-tight">Silné stránky</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[520px]">
              <thead>
                <tr className="bg-black text-white">
                  <th className="p-3 text-center text-[10px] font-black uppercase tracking-widest">
                    #
                  </th>
                  <th className="p-3 text-left text-[10px] font-black uppercase tracking-widest">
                    Tvrdenie
                  </th>
                  <th className="p-3 text-left text-[10px] font-black uppercase tracking-widest">
                    Oblasť
                  </th>
                  <th className="p-3 text-center text-[10px] font-black uppercase tracking-widest">
                    Priemer
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {strengths.map((item, index) => (
                  <tr key={item.statementId} className="hover:bg-black/5 transition-colors">
                    <td className="p-3 text-center font-black text-black/55">{index + 1}</td>
                    <td className="p-3 text-sm font-bold text-black/80">{item.statement}</td>
                    <td className="p-3 text-sm font-bold text-black/55">{item.competencyLabel}</td>
                    <td className="p-3 text-center font-black">{score(item.average)}</td>
                  </tr>
                ))}
                {strengths.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-7 text-center font-bold text-black/45">
                      Zatiaľ nie sú dostupné údaje.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white rounded-[2rem] border border-black/5 p-6 shadow-2xl shadow-black/5">
          <div className="flex items-center gap-3 mb-4">
            <TrendingDown className="w-5 h-5 text-brand" />
            <h4 className="text-lg font-black uppercase tracking-tight">Rozvojové potreby</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[520px]">
              <thead>
                <tr className="bg-black text-white">
                  <th className="p-3 text-center text-[10px] font-black uppercase tracking-widest">
                    #
                  </th>
                  <th className="p-3 text-left text-[10px] font-black uppercase tracking-widest">
                    Tvrdenie
                  </th>
                  <th className="p-3 text-left text-[10px] font-black uppercase tracking-widest">
                    Oblasť
                  </th>
                  <th className="p-3 text-center text-[10px] font-black uppercase tracking-widest">
                    Priemer
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {developmentNeeds.map((item, index) => (
                  <tr key={item.statementId} className="hover:bg-brand/5 transition-colors">
                    <td className="p-3 text-center font-black text-black/55">{index + 1}</td>
                    <td className="p-3 text-sm font-bold text-black/80">{item.statement}</td>
                    <td className="p-3 text-sm font-bold text-black/55">{item.competencyLabel}</td>
                    <td className="p-3 text-center font-black text-brand">{score(item.average)}</td>
                  </tr>
                ))}
                {developmentNeeds.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-7 text-center font-bold text-black/45">
                      Zatiaľ nie sú dostupné údaje.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};

export default CompanyStrengthWeaknessBlock;
