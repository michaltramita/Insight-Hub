import React from 'react';
import type { Feedback360IndividualReport } from '../../types';
import CompetencyRadar from '../RadarChart';
import { Gauge, ListChecks, UserCircle2 } from 'lucide-react';

interface Props {
  individual: Feedback360IndividualReport;
  scaleMax: number;
}

const formatScore = (value: unknown) => Number(Number(value) || 0).toFixed(2);

const IndividualOverviewBlock: React.FC<Props> = ({ individual, scaleMax }) => {
  const radarData = individual.competencies.map((competency) => ({
    name: competency.label,
    selfScore: Number(competency.averages.self) || 0,
    othersScore: Number(competency.averages.average) || 0,
  }));

  const overallAverage = individual.competencies.length
    ? individual.competencies.reduce(
        (sum, competency) => sum + (Number(competency.averages.average) || 0),
        0
      ) / individual.competencies.length
    : 0;

  const overallSelf = individual.competencies.length
    ? individual.competencies.reduce(
        (sum, competency) => sum + (Number(competency.averages.self) || 0),
        0
      ) / individual.competencies.length
    : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-[1.8rem] border border-black/5 p-5 shadow-xl shadow-black/5">
          <p className="text-[10px] uppercase tracking-widest font-black text-black/40 mb-2">
            Účastník
          </p>
          <p className="text-xl font-black">{individual.name}</p>
        </div>
        <div className="bg-white rounded-[1.8rem] border border-black/5 p-5 shadow-xl shadow-black/5">
          <p className="text-[10px] uppercase tracking-widest font-black text-black/40 mb-2">
            Kompetencie
          </p>
          <p className="text-3xl font-black">{individual.competencies.length}</p>
        </div>
        <div className="bg-white rounded-[1.8rem] border border-black/5 p-5 shadow-xl shadow-black/5">
          <p className="text-[10px] uppercase tracking-widest font-black text-black/40 mb-2">
            Priemer (okolie)
          </p>
          <p className="text-3xl font-black">{formatScore(overallAverage)}</p>
        </div>
        <div className="bg-white rounded-[1.8rem] border border-black/5 p-5 shadow-xl shadow-black/5">
          <p className="text-[10px] uppercase tracking-widest font-black text-black/40 mb-2">
            Priemer (seba)
          </p>
          <p className="text-3xl font-black">{formatScore(overallSelf)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1">
          <CompetencyRadar data={radarData} scaleMax={scaleMax} />
        </div>

        <div className="xl:col-span-2 bg-white rounded-[2rem] border border-black/5 p-6 md:p-8 shadow-2xl shadow-black/5">
          <div className="flex items-center gap-3 mb-5">
            <Gauge className="w-5 h-5 text-brand" />
            <h3 className="text-xl font-black uppercase tracking-tight">
              Sumár kompetencií jednotlivca
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[760px]">
              <thead>
                <tr className="bg-black text-white">
                  <th className="p-4 text-left text-[10px] font-black uppercase tracking-widest">
                    Kompetencia
                  </th>
                  <th className="p-4 text-center text-[10px] font-black uppercase tracking-widest">
                    Podriadený
                  </th>
                  <th className="p-4 text-center text-[10px] font-black uppercase tracking-widest">
                    Nadriadený
                  </th>
                  <th className="p-4 text-center text-[10px] font-black uppercase tracking-widest">
                    Kolega
                  </th>
                  <th className="p-4 text-center text-[10px] font-black uppercase tracking-widest">
                    Priemer
                  </th>
                  <th className="p-4 text-center text-[10px] font-black uppercase tracking-widest">
                    Seba
                  </th>
                  <th className="p-4 text-center text-[10px] font-black uppercase tracking-widest">
                    Rozdiel
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {individual.competencies.map((competency) => {
                  const average = Number(competency.averages.average) || 0;
                  const self = Number(competency.averages.self) || 0;
                  const diff = Number((self - average).toFixed(2));
                  return (
                    <tr key={competency.id} className="hover:bg-black/5 transition-colors">
                      <td className="p-4 text-sm font-bold">{competency.label}</td>
                      <td className="p-4 text-center font-black">
                        {formatScore(competency.averages.subordinate)}
                      </td>
                      <td className="p-4 text-center font-black">
                        {formatScore(competency.averages.manager)}
                      </td>
                      <td className="p-4 text-center font-black">
                        {formatScore(competency.averages.peer)}
                      </td>
                      <td className="p-4 text-center font-black">{formatScore(average)}</td>
                      <td className="p-4 text-center font-black">{formatScore(self)}</td>
                      <td
                        className={`p-4 text-center font-black ${
                          diff > 0 ? 'text-brand' : diff < 0 ? 'text-black/60' : 'text-black'
                        }`}
                      >
                        {diff > 0 ? '+' : ''}
                        {formatScore(diff)}
                      </td>
                    </tr>
                  );
                })}
                {individual.competencies.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-black/45 font-bold">
                      Vybraný účastník nemá dostupné kompetencie.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-black/5 p-6 shadow-2xl shadow-black/5">
        <div className="flex items-center gap-2 text-black/50 text-[11px] font-black uppercase tracking-widest">
          <UserCircle2 className="w-4 h-4" /> 360 prehľad jednotlivca
        </div>
        <div className="flex items-center gap-2 mt-3 text-black/65 text-sm font-semibold">
          <ListChecks className="w-4 h-4 text-brand" />
          Hodnoty reprezentujú priemer odpovedí a sebahodnotenie v jednotlivých kompetenciách.
        </div>
      </div>
    </div>
  );
};

export default IndividualOverviewBlock;
