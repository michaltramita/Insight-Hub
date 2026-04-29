import React from 'react';
import type { Feedback360PotentialItem } from '../../types';
import { AlertCircle, Sparkles } from 'lucide-react';

interface Props {
  overestimatedPotential: Feedback360PotentialItem[];
  hiddenPotential: Feedback360PotentialItem[];
}

const score = (value: unknown) => Number(Number(value) || 0).toFixed(2);

const IndividualPotentialBlock: React.FC<Props> = ({
  overestimatedPotential,
  hiddenPotential,
}) => {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-[2rem] border border-black/5 p-6 md:p-8 shadow-2xl shadow-black/5">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-brand" />
          <h3 className="text-xl font-black uppercase tracking-tight">Potenciál jednotlivca</h3>
        </div>
        <p className="text-black/60 font-semibold mt-3 max-w-4xl">
          Preceňovaný potenciál ukazuje oblasti, kde je sebahodnotenie vyššie ako hodnotenie
          okolia. Skrytý potenciál ukazuje oblasti, kde má jednotlivec rezervu vo vlastnom vnímaní.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-white rounded-[2rem] border border-black/5 p-6 shadow-2xl shadow-black/5">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-5 h-5 text-brand" />
            <h4 className="text-lg font-black uppercase tracking-tight">Preceňovaný potenciál</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[640px]">
              <thead>
                <tr className="bg-black text-white">
                  <th className="p-3 text-left text-[10px] font-black uppercase tracking-widest">
                    Tvrdenie
                  </th>
                  <th className="p-3 text-left text-[10px] font-black uppercase tracking-widest">
                    Oblasť
                  </th>
                  <th className="p-3 text-center text-[10px] font-black uppercase tracking-widest">
                    Priemer
                  </th>
                  <th className="p-3 text-center text-[10px] font-black uppercase tracking-widest">
                    Seba
                  </th>
                  <th className="p-3 text-center text-[10px] font-black uppercase tracking-widest">
                    Rozdiel
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {overestimatedPotential.map((item) => (
                  <tr key={item.statementId} className="hover:bg-brand/5 transition-colors">
                    <td className="p-3 text-sm font-bold text-black/80">{item.statement}</td>
                    <td className="p-3 text-sm font-bold text-black/55">{item.competencyLabel}</td>
                    <td className="p-3 text-center font-black">{score(item.average)}</td>
                    <td className="p-3 text-center font-black">{score(item.self)}</td>
                    <td className="p-3 text-center font-black text-brand">
                      +{score(item.diff)}
                    </td>
                  </tr>
                ))}
                {overestimatedPotential.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center font-bold text-black/45">
                      Žiadne výrazné rozdiely v preceňovaní.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white rounded-[2rem] border border-black/5 p-6 shadow-2xl shadow-black/5">
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="w-5 h-5 text-black" />
            <h4 className="text-lg font-black uppercase tracking-tight">Skrytý potenciál</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[640px]">
              <thead>
                <tr className="bg-black text-white">
                  <th className="p-3 text-left text-[10px] font-black uppercase tracking-widest">
                    Tvrdenie
                  </th>
                  <th className="p-3 text-left text-[10px] font-black uppercase tracking-widest">
                    Oblasť
                  </th>
                  <th className="p-3 text-center text-[10px] font-black uppercase tracking-widest">
                    Priemer
                  </th>
                  <th className="p-3 text-center text-[10px] font-black uppercase tracking-widest">
                    Seba
                  </th>
                  <th className="p-3 text-center text-[10px] font-black uppercase tracking-widest">
                    Rozdiel
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {hiddenPotential.map((item) => (
                  <tr key={item.statementId} className="hover:bg-black/5 transition-colors">
                    <td className="p-3 text-sm font-bold text-black/80">{item.statement}</td>
                    <td className="p-3 text-sm font-bold text-black/55">{item.competencyLabel}</td>
                    <td className="p-3 text-center font-black">{score(item.average)}</td>
                    <td className="p-3 text-center font-black">{score(item.self)}</td>
                    <td className="p-3 text-center font-black text-black/70">
                      {score(item.diff)}
                    </td>
                  </tr>
                ))}
                {hiddenPotential.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center font-bold text-black/45">
                      Skrytý potenciál zatiaľ nie je dostupný.
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

export default IndividualPotentialBlock;
