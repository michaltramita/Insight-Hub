import React, { useEffect, useMemo, useState } from 'react';
import type { Feedback360ImplementationPlan, Feedback360IndividualReport } from '../../types';
import { ClipboardList } from 'lucide-react';

interface Props {
  individual: Feedback360IndividualReport;
}

const DEFAULT_PRIORITY_ROWS = 5;

const normalizePriorities = (priorities: string[]) => {
  const base = Array.from({ length: DEFAULT_PRIORITY_ROWS }, (_, index) => priorities[index] || '');
  return base;
};

const resolveInitialPlan = (individual: Feedback360IndividualReport): Feedback360ImplementationPlan => {
  const plan = individual.implementationPlan;
  if (!plan) {
    return {
      participantName: individual.name,
      date: '',
      priorities: Array.from({ length: DEFAULT_PRIORITY_ROWS }, () => ''),
    };
  }

  return {
    participantName: plan.participantName || individual.name,
    date: plan.date || '',
    priorities: normalizePriorities(plan.priorities || []),
  };
};

const IndividualImplementationPlanBlock: React.FC<Props> = ({ individual }) => {
  const initialPlan = useMemo(() => resolveInitialPlan(individual), [individual]);
  const [participantName, setParticipantName] = useState(initialPlan.participantName);
  const [date, setDate] = useState(initialPlan.date || '');
  const [priorities, setPriorities] = useState<string[]>(initialPlan.priorities);

  useEffect(() => {
    const next = resolveInitialPlan(individual);
    setParticipantName(next.participantName);
    setDate(next.date || '');
    setPriorities(next.priorities);
  }, [individual]);

  const updatePriority = (index: number, value: string) => {
    setPriorities((current) => {
      const clone = [...current];
      clone[index] = value;
      return clone;
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-[2rem] border border-black/5 p-6 md:p-8 shadow-2xl shadow-black/5">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-5 h-5 text-brand" />
          <h3 className="text-xl font-black uppercase tracking-tight">Individuálny plán implementácie</h3>
        </div>
        <p className="text-black/60 font-semibold mt-3 max-w-4xl">
          Pracovná šablóna pre dohodnutie konkrétnych krokov na najbližšie obdobie.
        </p>
      </div>

      <div className="bg-white rounded-[2rem] border border-black/5 p-6 md:p-8 shadow-2xl shadow-black/5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-black/40">
              Meno účastníka
            </span>
            <input
              value={participantName}
              onChange={(event) => setParticipantName(event.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-black/10 bg-black/[0.02] font-semibold outline-none focus:ring-2 focus:ring-brand/25"
              placeholder="Meno účastníka"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-black/40">
              Dátum
            </span>
            <input
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-black/10 bg-black/[0.02] font-semibold outline-none focus:ring-2 focus:ring-brand/25"
              placeholder="DD.MM.RRRR"
            />
          </label>
        </div>

        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-black/40">
            Priority do najbližšieho obdobia
          </p>
          {priorities.map((value, index) => (
            <div key={index} className="grid grid-cols-[40px_minmax(0,1fr)] gap-3 items-start">
              <div className="h-11 rounded-xl border border-black/10 bg-black/[0.02] flex items-center justify-center text-sm font-black text-black/45">
                {index + 1}
              </div>
              <textarea
                value={value}
                onChange={(event) => updatePriority(index, event.target.value)}
                rows={2}
                className="w-full px-4 py-3 rounded-xl border border-black/10 bg-black/[0.02] font-semibold outline-none focus:ring-2 focus:ring-brand/25 resize-y min-h-[52px]"
                placeholder={`Priorita ${index + 1}`}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default IndividualImplementationPlanBlock;
