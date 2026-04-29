import React, { useEffect, useMemo, useState } from 'react';
import type { Feedback360CompetencyResult } from '../../types';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChevronLeft, ChevronRight, ListChecks } from 'lucide-react';

interface Props {
  competencies: Feedback360CompetencyResult[];
}

const score = (value: unknown) => Number(Number(value) || 0).toFixed(2);

const truncate = (value: string, max = 58) =>
  value.length > max ? `${value.slice(0, max - 1).trim()}…` : value;

const CompanyDetailBlock: React.FC<Props> = ({ competencies }) => {
  const [activeCompetencyId, setActiveCompetencyId] = useState<string>('');

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

  const activeIndex = useMemo(
    () => competencies.findIndex((competency) => competency.id === activeCompetencyId),
    [competencies, activeCompetencyId]
  );
  const activeCompetency =
    activeIndex >= 0 ? competencies[activeIndex] : competencies.length ? competencies[0] : null;

  const goToRelativeCompetency = (direction: -1 | 1) => {
    if (!competencies.length || activeIndex < 0) return;
    const nextIndex = (activeIndex + direction + competencies.length) % competencies.length;
    setActiveCompetencyId(competencies[nextIndex].id);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-[2rem] border border-black/5 p-6 md:p-8 shadow-2xl shadow-black/5">
        <div className="flex items-center gap-3">
          <ListChecks className="w-5 h-5 text-brand" />
          <h3 className="text-xl font-black uppercase tracking-tight">
            Výsledky za celú firmu detail
          </h3>
        </div>
        <p className="text-black/60 font-semibold mt-3 max-w-4xl">
          Detailné hodnoty po tvrdeniach pre aktívnu kompetenciu. Kompetencie prepínate cez posuvník.
        </p>
      </div>

      {competencies.length > 0 && activeCompetency && (
        <div className="bg-white rounded-[2rem] border border-black/5 p-4 md:p-5 shadow-2xl shadow-black/5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] uppercase tracking-widest font-black text-black/45">
              Kompetencia {Math.max(1, activeIndex + 1)} / {competencies.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToRelativeCompetency(-1)}
                className="w-9 h-9 rounded-xl border border-black/10 bg-black/5 hover:bg-black/10 flex items-center justify-center transition-colors"
                aria-label="Predchádzajúca kompetencia"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => goToRelativeCompetency(1)}
                className="w-9 h-9 rounded-xl border border-black/10 bg-black/5 hover:bg-black/10 flex items-center justify-center transition-colors"
                aria-label="Ďalšia kompetencia"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto no-scrollbar">
            <div className="flex gap-2 min-w-max">
              {competencies.map((competency) => {
                const isActive = competency.id === activeCompetency.id;
                return (
                  <button
                    key={competency.id}
                    onClick={() => setActiveCompetencyId(competency.id)}
                    className={`px-4 py-2.5 rounded-xl border text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-brand text-white border-brand'
                        : 'bg-black/5 border-black/10 text-black hover:bg-black/10'
                    }`}
                  >
                    {competency.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeCompetency && (() => {
        const hasFrequencyData = activeCompetency.statements.some(
          (statement) => statement.frequencyDistribution
        );
        const frequencyData = activeCompetency.statements.map((statement, index) => {
          const distribution = statement.frequencyDistribution;
          return {
            code: `${index + 1}.`,
            label: truncate(statement.statement),
            fullLabel: statement.statement,
            na: Number(distribution?.na) || 0,
            one: Number(distribution?.one) || 0,
            two: Number(distribution?.two) || 0,
            three: Number(distribution?.three) || 0,
            four: Number(distribution?.four) || 0,
            five: Number(distribution?.five) || 0,
            six: Number(distribution?.six) || 0,
          };
        });

        return (
          <section className="bg-white rounded-[2rem] border border-black/5 p-6 md:p-8 shadow-2xl shadow-black/5 space-y-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-2">
                Kompetencia
              </p>
              <h4 className="text-2xl font-black tracking-tight">{activeCompetency.label}</h4>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-black text-white">
                    <th className="p-4 text-left text-[10px] font-black uppercase tracking-widest">
                      Tvrdenie
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
                  {activeCompetency.statements.map((statement) => {
                    const avg = Number(statement.averages.average) || 0;
                    const self = Number(statement.averages.self) || 0;
                    const diff = Number((self - avg).toFixed(2));

                    return (
                      <tr key={statement.id} className="hover:bg-black/5 transition-colors">
                        <td className="p-4 text-sm font-bold text-black/80">{statement.statement}</td>
                        <td className="p-4 text-center font-black">
                          {score(statement.averages.subordinate)}
                        </td>
                        <td className="p-4 text-center font-black">
                          {score(statement.averages.manager)}
                        </td>
                        <td className="p-4 text-center font-black">{score(statement.averages.peer)}</td>
                        <td className="p-4 text-center font-black">{score(avg)}</td>
                        <td className="p-4 text-center font-black">{score(self)}</td>
                        <td
                          className={`p-4 text-center font-black ${
                            diff > 0 ? 'text-brand' : diff < 0 ? 'text-black/60' : 'text-black'
                          }`}
                        >
                          {diff > 0 ? '+' : ''}
                          {score(diff)}
                        </td>
                      </tr>
                    );
                  })}
                  {activeCompetency.statements.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center font-bold text-black/45">
                        Táto kompetencia zatiaľ neobsahuje detailné tvrdenia.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {hasFrequencyData && (
              <div className="rounded-2xl border border-black/5 bg-black/[0.02] p-4 md:p-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-3">
                  Graf početnosti odpovedí
                </p>
                <div className="h-[360px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={frequencyData}
                      margin={{ top: 12, right: 20, left: 0, bottom: 90 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#00000014" vertical={false} />
                      <XAxis
                        dataKey="code"
                        tick={{ fontSize: 11, fontWeight: 800, fill: '#00000080' }}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fontWeight: 800, fill: '#00000065' }}
                        allowDecimals={false}
                      />
                      <Tooltip
                        formatter={(value: unknown, name: string) => [String(value), name]}
                        labelFormatter={(label, payload) => {
                          const first = Array.isArray(payload) ? payload[0] : undefined;
                          const source = first?.payload as { fullLabel?: string } | undefined;
                          return `${label} ${source?.fullLabel || ''}`.trim();
                        }}
                        contentStyle={{
                          borderRadius: '1rem',
                          border: '1px solid #00000010',
                          boxShadow: '0 10px 30px -8px rgba(0,0,0,0.2)',
                          fontWeight: 700,
                        }}
                      />
                      <Bar stackId="freq" dataKey="na" fill="#d9d9d9" name="N/A" />
                      <Bar stackId="freq" dataKey="one" fill="#5a0f2a" name="1" />
                      <Bar stackId="freq" dataKey="two" fill="#7d173a" name="2" />
                      <Bar stackId="freq" dataKey="three" fill="#a71f4d" name="3" />
                      <Bar stackId="freq" dataKey="four" fill="#c93a67" name="4" />
                      <Bar stackId="freq" dataKey="five" fill="#de6f93" name="5" />
                      <Bar stackId="freq" dataKey="six" fill="#f0a8c1" name="6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </section>
        );
      })()}

      {competencies.length === 0 && (
        <div className="bg-white rounded-[2rem] border border-black/5 p-10 shadow-2xl shadow-black/5 text-center">
          <p className="font-black text-lg text-black/55">Detail kompetencií zatiaľ nie je dostupný.</p>
        </div>
      )}
    </div>
  );
};

export default CompanyDetailBlock;
