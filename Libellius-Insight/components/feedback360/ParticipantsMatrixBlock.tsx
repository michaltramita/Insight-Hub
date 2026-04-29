import React from 'react';
import type { Feedback360ParticipantSummary } from '../../types';
import { Table } from 'lucide-react';

interface CompetencyColumn {
  id: string;
  label: string;
}

interface Props {
  participants: Feedback360ParticipantSummary[];
  competencyColumns: CompetencyColumn[];
}

const score = (value: unknown) => Number(Number(value) || 0).toFixed(2);

const ParticipantsMatrixBlock: React.FC<Props> = ({ participants, competencyColumns }) => {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-[2rem] border border-black/5 p-6 md:p-8 shadow-2xl shadow-black/5">
        <div className="flex items-center gap-3">
          <Table className="w-5 h-5 text-brand" />
          <h3 className="text-xl font-black uppercase tracking-tight">
            Výsledky po jednotlivcoch
          </h3>
        </div>
        <p className="text-black/60 font-semibold mt-3 max-w-4xl">
          Maticový prehľad účastníkov a ich priemerov v jednotlivých kompetenciách.
        </p>
      </div>

      <div className="bg-white rounded-[2rem] border border-black/5 p-6 md:p-8 shadow-2xl shadow-black/5">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[920px]">
            <thead>
              <tr className="bg-black text-white">
                <th className="p-3 text-left text-[10px] font-black uppercase tracking-widest">
                  Účastník
                </th>
                {competencyColumns.map((column) => (
                  <th
                    key={column.id}
                    className="p-3 text-center text-[10px] font-black uppercase tracking-widest"
                  >
                    {column.label}
                  </th>
                ))}
                <th className="p-3 text-center text-[10px] font-black uppercase tracking-widest">
                  Priemer spolu
                </th>
                <th className="p-3 text-center text-[10px] font-black uppercase tracking-widest">
                  Seba spolu
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {participants.map((participant) => (
                <tr key={participant.id} className="hover:bg-black/5 transition-colors">
                  <td className="p-3 text-sm font-black text-black/80">{participant.name}</td>
                  {competencyColumns.map((column) => {
                    const competency = participant.competencies.find(
                      (item) => item.id === column.id
                    );
                    return (
                      <td key={column.id} className="p-3 text-center font-black">
                        {competency ? score(competency.averages.average) : '-'}
                      </td>
                    );
                  })}
                  <td className="p-3 text-center font-black">{score(participant.overallAverage)}</td>
                  <td className="p-3 text-center font-black">{score(participant.overallSelf)}</td>
                </tr>
              ))}
              {participants.length === 0 && (
                <tr>
                  <td
                    colSpan={competencyColumns.length + 3}
                    className="p-9 text-center font-bold text-black/45"
                  >
                    Zatiaľ nie sú dostupní účastníci.
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

export default ParticipantsMatrixBlock;
