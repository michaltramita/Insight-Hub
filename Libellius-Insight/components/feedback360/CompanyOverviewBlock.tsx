import React from 'react';
import type {
  Feedback360CompetencyResult,
  Feedback360RespondentCounts,
} from '../../types';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, Users } from 'lucide-react';

interface Props {
  competencies: Feedback360CompetencyResult[];
  respondentCounts: Feedback360RespondentCounts;
  participantsCount: number;
  scaleMax: number;
}

const formatScore = (value: number) => (Number.isFinite(value) ? value.toFixed(2) : '0.00');

const CompanyOverviewBlock: React.FC<Props> = ({
  competencies,
  respondentCounts,
  participantsCount,
  scaleMax,
}) => {
  const chartData = competencies.map((competency) => ({
    name: competency.label,
    podriadeni: Number(competency.averages.subordinate) || 0,
    nadriadeni: Number(competency.averages.manager) || 0,
    kolegovia: Number(competency.averages.peer) || 0,
    seba: Number(competency.averages.self) || 0,
    priemer: Number(competency.averages.average) || 0,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="bg-white rounded-[1.8rem] border border-black/5 p-5 shadow-xl shadow-black/5">
          <p className="text-[10px] uppercase tracking-widest font-black text-black/40 mb-2">
            Účastníci
          </p>
          <p className="text-3xl font-black">{participantsCount}</p>
        </div>
        <div className="bg-white rounded-[1.8rem] border border-black/5 p-5 shadow-xl shadow-black/5">
          <p className="text-[10px] uppercase tracking-widest font-black text-black/40 mb-2">
            Podriadení
          </p>
          <p className="text-3xl font-black">{respondentCounts.subordinate}</p>
        </div>
        <div className="bg-white rounded-[1.8rem] border border-black/5 p-5 shadow-xl shadow-black/5">
          <p className="text-[10px] uppercase tracking-widest font-black text-black/40 mb-2">
            Nadriadení
          </p>
          <p className="text-3xl font-black">{respondentCounts.manager}</p>
        </div>
        <div className="bg-white rounded-[1.8rem] border border-black/5 p-5 shadow-xl shadow-black/5">
          <p className="text-[10px] uppercase tracking-widest font-black text-black/40 mb-2">
            Kolegovia
          </p>
          <p className="text-3xl font-black">{respondentCounts.peer}</p>
        </div>
        <div className="bg-white rounded-[1.8rem] border border-black/5 p-5 shadow-xl shadow-black/5">
          <p className="text-[10px] uppercase tracking-widest font-black text-black/40 mb-2">
            Sebahodnotenia
          </p>
          <p className="text-3xl font-black">{respondentCounts.self || 0}</p>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-black/5 p-6 md:p-8 shadow-2xl shadow-black/5">
        <div className="flex items-center gap-3 mb-5">
          <BarChart3 className="w-5 h-5 text-brand" />
          <h3 className="text-xl font-black uppercase tracking-tight">
            Výsledky za celú firmu
          </h3>
        </div>
        <div className="h-[420px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 16, right: 8, left: 0, bottom: 90 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#00000012" vertical={false} />
              <XAxis
                dataKey="name"
                angle={-20}
                textAnchor="end"
                interval={0}
                tick={{ fontSize: 11, fontWeight: 800, fill: '#00000080' }}
              />
              <YAxis
                domain={[0, scaleMax]}
                tick={{ fontSize: 11, fontWeight: 800, fill: '#00000065' }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: '1rem',
                  border: '1px solid #00000010',
                  boxShadow: '0 10px 30px -8px rgba(0,0,0,0.2)',
                  fontWeight: 700,
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: '11px', fontWeight: 800, paddingTop: '14px' }}
              />
              <Bar dataKey="podriadeni" fill="#111111" radius={[6, 6, 0, 0]} name="Podriadení" />
              <Bar dataKey="nadriadeni" fill="#444444" radius={[6, 6, 0, 0]} name="Nadriadení" />
              <Bar dataKey="kolegovia" fill="#888888" radius={[6, 6, 0, 0]} name="Kolegovia" />
              <Bar dataKey="seba" fill="#B81547" radius={[6, 6, 0, 0]} name="Sebahodnotenie" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-black/5 p-6 md:p-8 shadow-2xl shadow-black/5">
        <div className="flex items-center gap-3 mb-5">
          <Users className="w-5 h-5 text-brand" />
          <h3 className="text-xl font-black uppercase tracking-tight">
            Kompetenčný sumár firmy
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
              {competencies.map((competency) => {
                const subordinate = Number(competency.averages.subordinate) || 0;
                const manager = Number(competency.averages.manager) || 0;
                const peer = Number(competency.averages.peer) || 0;
                const average = Number(competency.averages.average) || 0;
                const self = Number(competency.averages.self) || 0;
                const diff = Number((self - average).toFixed(2));

                return (
                  <tr key={competency.id} className="hover:bg-black/5 transition-colors">
                    <td className="p-4 text-sm font-bold">{competency.label}</td>
                    <td className="p-4 text-center font-black">{formatScore(subordinate)}</td>
                    <td className="p-4 text-center font-black">{formatScore(manager)}</td>
                    <td className="p-4 text-center font-black">{formatScore(peer)}</td>
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
              {competencies.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-black/40 font-bold">
                    V reporte nie sú dostupné kompetencie.
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
