import React, { useEffect, useMemo, useState } from 'react';
import { FeedbackAnalysisResult } from '../../types';
import { AlertCircle, Building2, Calendar, RefreshCw, Users } from 'lucide-react';
import CompanyIntroBentoBlock from './CompanyIntroBentoBlock';
import CompanyOverviewBlock from './CompanyOverviewBlock';
import CompanyDetailBlock from './CompanyDetailBlock';
import CompanyStrengthWeaknessBlock from './CompanyStrengthWeaknessBlock';
import ParticipantsMatrixBlock from './ParticipantsMatrixBlock';
import IndividualOverviewBlock from './IndividualOverviewBlock';
import IndividualDetailBlock from './IndividualDetailBlock';
import IndividualPotentialBlock from './IndividualPotentialBlock';
import IndividualImplementationPlanBlock from './IndividualImplementationPlanBlock';
import TeamShowcase from '../ui/team-showcase';

interface Props {
  result: FeedbackAnalysisResult;
  onReset: () => void;
}

type PrimaryTab = 'INTRO' | 'COMPANY' | 'MANAGERS';

const score = (value: unknown) => Number(Number(value) || 0).toFixed(2);

const Feedback360Dashboard: React.FC<Props> = ({ result, onReset }) => {
  const [activeTab, setActiveTab] = useState<PrimaryTab>('INTRO');
  const [selectedIndividualId, setSelectedIndividualId] = useState<string>('');

  const data = result.feedback360;
  const individuals = data?.individuals || [];
  const companyReport = data?.companyReport;
  const competencies = companyReport?.competencies || [];

  useEffect(() => {
    if (!selectedIndividualId && individuals.length > 0) {
      setSelectedIndividualId(individuals[0].id);
    }
  }, [individuals, selectedIndividualId]);

  const selectedIndividual = useMemo(
    () => individuals.find((item) => item.id === selectedIndividualId),
    [individuals, selectedIndividualId]
  );

  const selectedIndividualOverall = useMemo(() => {
    if (!selectedIndividual || !selectedIndividual.competencies.length) {
      return { average: 0, self: 0, gap: 0 };
    }

    const total = selectedIndividual.competencies.length;
    const average =
      selectedIndividual.competencies.reduce(
        (sum, competency) => sum + (Number(competency.averages.average) || 0),
        0
      ) / total;
    const self =
      selectedIndividual.competencies.reduce(
        (sum, competency) => sum + (Number(competency.averages.self) || 0),
        0
      ) / total;

    return {
      average: Number(average.toFixed(2)),
      self: Number(self.toFixed(2)),
      gap: Number((self - average).toFixed(2)),
    };
  }, [selectedIndividual]);

  const competencyColumns = useMemo(() => {
    if (competencies.length > 0) {
      return competencies.map((competency) => ({
        id: competency.id,
        label: competency.label,
      }));
    }

    const map = new Map<string, string>();
    for (const participant of companyReport?.participants || []) {
      for (const competency of participant.competencies || []) {
        if (!map.has(competency.id)) {
          map.set(competency.id, competency.label);
        }
      }
    }
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [competencies, companyReport?.participants]);

  const managerShowcaseMembers = useMemo(
    () =>
      individuals.map((individual) => {
        const topCompetency = [...(individual.competencies || [])].sort(
          (a, b) => Number(b.averages.average || 0) - Number(a.averages.average || 0)
        )[0];
        return {
          id: individual.id,
          name: individual.name,
          role: topCompetency
            ? `Top: ${topCompetency.label}`
            : `${individual.competencies.length} kompetencií`,
        };
      }),
    [individuals]
  );

  if (!data || !companyReport) {
    return (
      <div className="w-full max-w-4xl mx-auto py-20 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand/5 text-brand font-black text-xs uppercase tracking-widest mb-6">
          360 modul
        </div>
        <h2 className="text-3xl font-black tracking-tight mb-3">Chýbajú 360 dáta</h2>
        <p className="text-black/50 font-semibold max-w-2xl mx-auto">
          V nahranom reporte sa nenašli dáta pre nový 360 dashboard.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-24 animate-fade-in">
      <div className="bg-white rounded-[2.5rem] border border-black/5 p-8 md:p-10 shadow-2xl shadow-black/5">
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight uppercase">
              360° spätná väzba
            </h1>
            <div className="flex flex-wrap items-center gap-5 mt-4 text-[11px] sm:text-xs font-black uppercase tracking-widest text-black/45">
              <span className="inline-flex items-center gap-2">
                <Building2 className="w-4 h-4" /> {data.companyName}
              </span>
              <span className="inline-flex items-center gap-2">
                <Calendar className="w-4 h-4" /> {result.reportMetadata.date}
              </span>
              <span className="inline-flex items-center gap-2">
                <Users className="w-4 h-4" /> {individuals.length} manažérov
              </span>
            </div>
          </div>
          <button
            onClick={onReset}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-black/5 hover:bg-black hover:text-white rounded-2xl border border-black/5 font-black uppercase tracking-widest text-xs transition-all"
          >
            <RefreshCw className="w-4 h-4" /> Nový report
          </button>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => setActiveTab('INTRO')}
            className={`w-full rounded-2xl border px-5 py-4 text-left font-black uppercase tracking-widest text-xs sm:text-sm transition-all ${
              activeTab === 'INTRO'
                ? 'bg-black text-white border-black'
                : 'bg-black/5 border-black/10 text-black hover:bg-black/10'
            }`}
          >
            Úvod
          </button>
          <button
            onClick={() => setActiveTab('COMPANY')}
            className={`w-full rounded-2xl border px-5 py-4 text-left font-black uppercase tracking-widest text-xs sm:text-sm transition-all ${
              activeTab === 'COMPANY'
                ? 'bg-brand text-white border-brand'
                : 'bg-brand/5 border-brand/20 text-black hover:bg-brand/10'
            }`}
          >
            Celá firma
          </button>
          <button
            onClick={() => setActiveTab('MANAGERS')}
            className={`w-full rounded-2xl border px-5 py-4 text-left font-black uppercase tracking-widest text-xs sm:text-sm transition-all ${
              activeTab === 'MANAGERS'
                ? 'bg-black text-white border-black'
                : 'bg-black/5 border-black/10 text-black hover:bg-black/10'
            }`}
          >
            Jednotliví manažéri
          </button>
        </div>
      </div>

      {activeTab === 'INTRO' && (
        <CompanyIntroBentoBlock
          companyName={data.companyName}
          surveyName={data.surveyName}
          reportDate={result.reportMetadata.date}
          companyReport={companyReport}
          individuals={individuals}
        />
      )}

      {activeTab === 'COMPANY' && (
        <div className="space-y-6">
          <div className="bg-white rounded-[2rem] border border-black/5 p-6 md:p-8 shadow-2xl shadow-black/5">
            <h3 className="text-xl md:text-2xl font-black tracking-tight uppercase">Výsledky za celú firmu</h3>
            <p className="text-black/60 font-semibold mt-3 max-w-4xl">
              Kompletné grafy a tabuľky pre firemný pohľad: kompetencie, detail tvrdení, silné/slabé stránky a porovnanie manažérov.
            </p>
          </div>

          <CompanyOverviewBlock
            competencies={companyReport.competencies}
            respondentCounts={companyReport.respondentCounts}
            participantsCount={companyReport.participants.length}
            scaleMax={data.scaleMax}
          />
          <CompanyDetailBlock competencies={companyReport.competencies} />
          <CompanyStrengthWeaknessBlock
            strengths={companyReport.strengths}
            developmentNeeds={companyReport.developmentNeeds}
          />
          <ParticipantsMatrixBlock
            participants={companyReport.participants}
            competencyColumns={competencyColumns}
          />
        </div>
      )}

      {activeTab === 'MANAGERS' && (
        <div className="space-y-6">
          <TeamShowcase
            members={managerShowcaseMembers}
            selectedId={selectedIndividualId}
            onSelect={setSelectedIndividualId}
          />

          {!selectedIndividual ? (
            <div className="bg-white rounded-[2rem] border border-black/5 p-10 shadow-2xl shadow-black/5 text-center">
              <AlertCircle className="w-10 h-10 mx-auto text-brand mb-4" />
              <p className="font-black text-lg">Manažér nebol nájdený.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-white rounded-[1.8rem] border border-black/5 p-5 shadow-xl shadow-black/5">
                  <p className="text-[10px] uppercase tracking-widest font-black text-black/40 mb-2">
                    Manažér
                  </p>
                  <p className="text-xl font-black">{selectedIndividual.name}</p>
                </div>
                <div className="bg-white rounded-[1.8rem] border border-black/5 p-5 shadow-xl shadow-black/5">
                  <p className="text-[10px] uppercase tracking-widest font-black text-black/40 mb-2">
                    Kompetencie
                  </p>
                  <p className="text-3xl font-black">{selectedIndividual.competencies.length}</p>
                </div>
                <div className="bg-white rounded-[1.8rem] border border-black/5 p-5 shadow-xl shadow-black/5">
                  <p className="text-[10px] uppercase tracking-widest font-black text-black/40 mb-2">
                    Priemer (okolie)
                  </p>
                  <p className="text-3xl font-black">{score(selectedIndividualOverall.average)}</p>
                </div>
                <div className="bg-white rounded-[1.8rem] border border-black/5 p-5 shadow-xl shadow-black/5">
                  <p className="text-[10px] uppercase tracking-widest font-black text-black/40 mb-2">
                    Gap seba vs okolie
                  </p>
                  <p
                    className={`text-3xl font-black ${
                      selectedIndividualOverall.gap > 0
                        ? 'text-brand'
                        : selectedIndividualOverall.gap < 0
                        ? 'text-black/70'
                        : 'text-black'
                    }`}
                  >
                    {selectedIndividualOverall.gap > 0 ? '+' : ''}
                    {score(selectedIndividualOverall.gap)}
                  </p>
                </div>
              </div>

              <IndividualOverviewBlock individual={selectedIndividual} scaleMax={data.scaleMax} />
              <IndividualPotentialBlock
                overestimatedPotential={selectedIndividual.overestimatedPotential}
                hiddenPotential={selectedIndividual.hiddenPotential}
              />
              <IndividualDetailBlock individual={selectedIndividual} />
              <IndividualImplementationPlanBlock individual={selectedIndividual} />
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Feedback360Dashboard;
