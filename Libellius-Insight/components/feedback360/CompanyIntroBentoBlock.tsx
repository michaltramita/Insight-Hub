import React from 'react';
import type {
  Feedback360CompanyReport,
  Feedback360IndividualReport,
} from '../../types';
import {
  Building2,
  Calendar,
  Gauge,
  Signal,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';

interface Props {
  companyName: string;
  surveyName: string;
  reportDate: string;
  companyReport: Feedback360CompanyReport;
  individuals: Feedback360IndividualReport[];
}

const score = (value: unknown) => Number(Number(value) || 0).toFixed(2);

const signedScore = (value: unknown) => {
  const numeric = Number(value) || 0;
  return `${numeric > 0 ? '+' : ''}${score(numeric)}`;
};

const shortText = (value: string, max = 30) =>
  value.length > max ? `${value.slice(0, max - 1).trim()}…` : value;

const averageByRole = (
  competencies: Feedback360CompanyReport['competencies'],
  key: 'subordinate' | 'manager' | 'peer'
) => {
  if (!competencies.length) return 0;
  const sum = competencies.reduce(
    (acc, competency) => acc + (Number(competency.averages[key]) || 0),
    0
  );
  return Number((sum / competencies.length).toFixed(2));
};

const BarMini: React.FC<{ value: number; max?: number; className?: string }> = ({
  value,
  max = 6,
  className = 'bg-brand',
}) => {
  const width = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="w-full h-1.5 rounded-full bg-black/10 overflow-hidden">
      <div className={`h-full rounded-full ${className}`} style={{ width: `${width}%` }} />
    </div>
  );
};

const CompanyIntroBentoBlock: React.FC<Props> = ({
  companyName,
  surveyName,
  reportDate,
  companyReport,
  individuals,
}) => {
  const participantsCount = companyReport.participants.length;
  const respondentCounts = companyReport.respondentCounts;
  const respondentsTotal =
    Number(respondentCounts.subordinate || 0) +
    Number(respondentCounts.manager || 0) +
    Number(respondentCounts.peer || 0);
  const respondentsPerManager = participantsCount
    ? Number((respondentsTotal / participantsCount).toFixed(1))
    : 0;

  const overallAverage = companyReport.participants.length
    ? Number(
        (
          companyReport.participants.reduce(
            (sum, participant) => sum + (Number(participant.overallAverage) || 0),
            0
          ) / companyReport.participants.length
        ).toFixed(2)
      )
    : 0;
  const overallSelf = companyReport.participants.length
    ? Number(
        (
          companyReport.participants.reduce(
            (sum, participant) => sum + (Number(participant.overallSelf) || 0),
            0
          ) / companyReport.participants.length
        ).toFixed(2)
      )
    : 0;
  const selfGap = Number((overallSelf - overallAverage).toFixed(2));

  const roleAverages = {
    subordinate: averageByRole(companyReport.competencies, 'subordinate'),
    manager: averageByRole(companyReport.competencies, 'manager'),
    peer: averageByRole(companyReport.competencies, 'peer'),
  };

  const sortedCompetencies = [...companyReport.competencies].sort(
    (a, b) => Number(b.averages.average || 0) - Number(a.averages.average || 0)
  );
  const strongestCompetency = sortedCompetencies[0];
  const weakestCompetency = sortedCompetencies[sortedCompetencies.length - 1];

  const competencySpreads = companyReport.competencies.map((competency) => {
    const values = [
      Number(competency.averages.subordinate) || 0,
      Number(competency.averages.manager) || 0,
      Number(competency.averages.peer) || 0,
    ].filter((value) => value > 0);
    const spread = values.length >= 2 ? Math.max(...values) - Math.min(...values) : 0;
    return { id: competency.id, label: competency.label, spread: Number(spread.toFixed(2)) };
  });
  const bestConsensus = [...competencySpreads].sort((a, b) => a.spread - b.spread)[0];
  const biggestDispersion = [...competencySpreads].sort((a, b) => b.spread - a.spread)[0];

  const topOverestimated = individuals
    .flatMap((individual) =>
      individual.overestimatedPotential.map((item) => ({
        owner: individual.name,
        ...item,
      }))
    )
    .sort((a, b) => Number(b.diff || 0) - Number(a.diff || 0))[0];

  const topHidden = individuals
    .flatMap((individual) =>
      individual.hiddenPotential.map((item) => ({
        owner: individual.name,
        ...item,
      }))
    )
    .sort((a, b) => Number(a.diff || 0) - Number(b.diff || 0))[0];

  const overestimatedCount = individuals.reduce(
    (sum, individual) => sum + individual.overestimatedPotential.length,
    0
  );
  const hiddenCount = individuals.reduce(
    (sum, individual) => sum + individual.hiddenPotential.length,
    0
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-6 xl:grid-cols-12 gap-4 md:gap-5">
      <section className="md:col-span-6 xl:col-span-6 relative overflow-hidden rounded-[2rem] p-6 md:p-7 text-white bg-gradient-to-br from-[#0d0d12] via-[#171721] to-[#2a1b24] shadow-[0_24px_60px_-28px_rgba(0,0,0,0.8)]">
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-brand/25 blur-3xl pointer-events-none" />
        <p className="text-[10px] uppercase tracking-[0.18em] font-black text-white/65">360 snapshot</p>
        <h3 className="mt-2 text-3xl md:text-4xl leading-[1.05] font-black tracking-tight">
          {companyName}
        </h3>
        <p className="mt-1 text-sm font-semibold text-white/75">{shortText(surveyName, 42)}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 text-[10px] font-black uppercase tracking-widest">
            <Calendar className="w-3.5 h-3.5" /> {reportDate}
          </span>
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 text-[10px] font-black uppercase tracking-widest">
            <Building2 className="w-3.5 h-3.5" /> Firma
          </span>
        </div>
      </section>

      <section className="md:col-span-3 xl:col-span-3 rounded-[2rem] border border-black/5 bg-white p-5 shadow-xl shadow-black/5">
        <p className="text-[10px] uppercase tracking-widest font-black text-black/40">Manažéri</p>
        <p className="mt-2 text-[3rem] leading-none font-black">{participantsCount}</p>
        <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-black/45">Hodnotení</p>
      </section>

      <section className="md:col-span-3 xl:col-span-3 rounded-[2rem] border border-black/5 bg-white p-5 shadow-xl shadow-black/5">
        <p className="text-[10px] uppercase tracking-widest font-black text-black/40">Hodnotitelia</p>
        <p className="mt-2 text-[3rem] leading-none font-black">{respondentsTotal}</p>
        <p className="mt-2 text-xs font-bold text-black/55">/ manažér: {respondentsPerManager}</p>
      </section>

      <section className="md:col-span-3 xl:col-span-4 rounded-[2rem] border border-brand/20 bg-gradient-to-br from-brand/[0.12] to-brand/[0.03] p-5 shadow-xl shadow-brand/10">
        <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-widest font-black text-brand">
          <Gauge className="w-4 h-4" /> Skóre
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-black/45">Okolie</p>
            <p className="text-2xl leading-none font-black mt-1">{score(overallAverage)}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-black/45">Seba</p>
            <p className="text-2xl leading-none font-black mt-1">{score(overallSelf)}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-black/45">Gap</p>
            <p
              className={`text-2xl leading-none font-black mt-1 ${
                selfGap > 0 ? 'text-brand' : selfGap < 0 ? 'text-black/70' : 'text-black'
              }`}
            >
              {signedScore(selfGap)}
            </p>
          </div>
        </div>
      </section>

      <section className="md:col-span-3 xl:col-span-4 rounded-[2rem] border border-black/5 bg-white p-5 shadow-xl shadow-black/5">
        <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-widest font-black text-black/45">
          <Signal className="w-4 h-4 text-brand" /> Roly
        </div>
        <div className="mt-4 space-y-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-black/65">
              <span>Podriadení</span>
              <span>{score(roleAverages.subordinate)}</span>
            </div>
            <BarMini value={roleAverages.subordinate} className="bg-black" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-black/65">
              <span>Nadriadení</span>
              <span>{score(roleAverages.manager)}</span>
            </div>
            <BarMini value={roleAverages.manager} className="bg-brand" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-black/65">
              <span>Kolegovia</span>
              <span>{score(roleAverages.peer)}</span>
            </div>
            <BarMini value={roleAverages.peer} className="bg-black/60" />
          </div>
        </div>
      </section>

      <section className="md:col-span-6 xl:col-span-4 rounded-[2rem] border border-black/5 bg-white p-5 shadow-xl shadow-black/5">
        <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-widest font-black text-black/45">
          <Target className="w-4 h-4 text-brand" /> Kompetencie
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
            <TrendingUp className="w-4 h-4 text-emerald-700 mb-1" />
            <p className="text-[10px] uppercase tracking-widest font-black text-emerald-700">Silná</p>
            <p className="mt-1 text-xs font-black">{shortText(strongestCompetency?.label || '—', 20)}</p>
            <p className="text-sm font-black mt-1">{score(strongestCompetency?.averages.average)}</p>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
            <TrendingDown className="w-4 h-4 text-amber-700 mb-1" />
            <p className="text-[10px] uppercase tracking-widest font-black text-amber-700">Rozvoj</p>
            <p className="mt-1 text-xs font-black">{shortText(weakestCompetency?.label || '—', 20)}</p>
            <p className="text-sm font-black mt-1">{score(weakestCompetency?.averages.average)}</p>
          </div>
        </div>
      </section>

      <section className="md:col-span-3 xl:col-span-3 rounded-[2rem] border border-black/5 bg-white p-5 shadow-xl shadow-black/5">
        <p className="text-[10px] uppercase tracking-widest font-black text-black/45">Zhoda</p>
        <div className="mt-3 space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-black text-black/40">Najvyššia</p>
            <p className="text-xs font-black mt-1">{shortText(bestConsensus?.label || '—', 24)}</p>
            <p className="text-lg leading-none font-black mt-1">{score(bestConsensus?.spread)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest font-black text-black/40">Najnižšia</p>
            <p className="text-xs font-black mt-1">{shortText(biggestDispersion?.label || '—', 24)}</p>
            <p className="text-lg leading-none font-black mt-1">{score(biggestDispersion?.spread)}</p>
          </div>
        </div>
      </section>

      <section className="md:col-span-3 xl:col-span-3 rounded-[2rem] border border-black/5 bg-[#faf7f8] p-5 shadow-xl shadow-black/5">
        <p className="text-[10px] uppercase tracking-widest font-black text-black/45">Potenciál</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white/80 border border-black/5 p-3">
            <p className="text-[10px] uppercase tracking-widest font-black text-black/40">Preceň.</p>
            <p className="text-2xl leading-none font-black mt-1">{overestimatedCount}</p>
            <p className="text-[10px] font-bold text-black/55 mt-1">{signedScore(topOverestimated?.diff || 0)}</p>
          </div>
          <div className="rounded-xl bg-white/80 border border-black/5 p-3">
            <p className="text-[10px] uppercase tracking-widest font-black text-black/40">Skrytý</p>
            <p className="text-2xl leading-none font-black mt-1">{hiddenCount}</p>
            <p className="text-[10px] font-bold text-black/55 mt-1">{signedScore(topHidden?.diff || 0)}</p>
          </div>
        </div>
        <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-black/45">
          {topOverestimated ? shortText(topOverestimated.owner, 18) : '—'} /{' '}
          {topHidden ? shortText(topHidden.owner, 18) : '—'}
        </p>
      </section>
    </div>
  );
};

export default CompanyIntroBentoBlock;
