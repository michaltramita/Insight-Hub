import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FeedbackAnalysisResult } from '../../types';
import {
  AlertCircle,
  ArrowUpDown,
  BarChart4,
  Building2,
  ListChecks,
  Table,
  Target,
  UserCheck,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import CompanyParticipantsBentoBlock from './CompanyParticipantsBentoBlock';
import CompanyOverviewBlock from './CompanyOverviewBlock';
import CompanyDetailBlock from './CompanyDetailBlock';
import CompanyStrengthWeaknessBlock from './CompanyStrengthWeaknessBlock';
import ParticipantsMatrixBlock from './ParticipantsMatrixBlock';
import IndividualOverviewBlock from './IndividualOverviewBlock';
import IndividualDetailBlock from './IndividualDetailBlock';
import IndividualPotentialBlock from './IndividualPotentialBlock';

interface Props {
  result: FeedbackAnalysisResult;
  onReset: () => void;
}

type PrimaryTab =
  | 'INTRO'
  | 'COMPANY_OVERVIEW'
  | 'COMPANY_DETAIL'
  | 'STRENGTHS'
  | 'PARTICIPANTS'
  | 'INDIVIDUALS';

interface ReportTab {
  id: PrimaryTab;
  label: string;
  icon: LucideIcon;
  tone: 'dark' | 'brand';
}

const PARTICIPANTS_COMPARISON_TAB_ID = 'comparison';

const reportTabs: ReportTab[] = [
  { id: 'INTRO', label: 'Účastníci', icon: Users, tone: 'dark' },
  { id: 'COMPANY_OVERVIEW', label: 'Celá firma', icon: BarChart4, tone: 'brand' },
  { id: 'COMPANY_DETAIL', label: 'Detail kompetencií', icon: ListChecks, tone: 'brand' },
  { id: 'STRENGTHS', label: 'Silné a slabé stránky', icon: Target, tone: 'dark' },
  { id: 'PARTICIPANTS', label: 'Výsledky jednotlivcov', icon: Table, tone: 'brand' },
  { id: 'INDIVIDUALS', label: 'Individuálny detail', icon: UserCheck, tone: 'dark' },
];

const Feedback360Dashboard: React.FC<Props> = ({ result, onReset }) => {
  const [activeTab, setActiveTab] = useState<PrimaryTab>('INTRO');
  const [selectedIndividualId, setSelectedIndividualId] = useState<string>('');
  const [activeParticipantsMatrixTab, setActiveParticipantsMatrixTab] = useState(
    PARTICIPANTS_COMPARISON_TAB_ID
  );
  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollTabsLeft, setCanScrollTabsLeft] = useState(false);
  const [canScrollTabsRight, setCanScrollTabsRight] = useState(false);

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

  const handleParticipantsMatrixTabChange = useCallback((tabId: string) => {
    setActiveParticipantsMatrixTab(tabId);
  }, []);

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

  const updateTabsScrollState = useCallback(() => {
    const container = tabsScrollRef.current;
    if (!container) {
      setCanScrollTabsLeft(false);
      setCanScrollTabsRight(false);
      return;
    }

    const maxScrollLeft = container.scrollWidth - container.clientWidth;
    const hasOverflow = maxScrollLeft > 2;

    setCanScrollTabsLeft(container.scrollLeft > 1);
    setCanScrollTabsRight(hasOverflow && container.scrollLeft < maxScrollLeft - 1);
  }, []);

  useEffect(() => {
    const container = tabsScrollRef.current;
    if (!container) return;

    updateTabsScrollState();
    container.addEventListener('scroll', updateTabsScrollState, { passive: true });
    window.addEventListener('resize', updateTabsScrollState);

    const timer = window.setTimeout(updateTabsScrollState, 0);

    return () => {
      container.removeEventListener('scroll', updateTabsScrollState);
      window.removeEventListener('resize', updateTabsScrollState);
      window.clearTimeout(timer);
    };
  }, [updateTabsScrollState]);

  if (!data || !companyReport) {
    return (
      <div className="min-h-screen flex flex-col px-4 sm:px-6 lg:px-8">
        <div className="flex-1 w-full max-w-[1600px] 2xl:max-w-[1800px] mx-auto flex items-center justify-center py-20">
          <div className="w-full max-w-4xl bg-white rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-black/5 p-8 sm:p-10 shadow-2xl text-center">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 bg-brand/5 rounded-full border border-brand/10 w-fit mb-6">
              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-brand">
                360 modul
              </span>
            </div>
            <h2 className="text-3xl font-black tracking-tight mb-3">Chýbajú 360 dáta</h2>
            <p className="text-black/50 font-semibold max-w-2xl mx-auto">
              V nahranom reporte sa nenašli dáta pre nový 360 dashboard.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col px-4 sm:px-6 lg:px-8">
      <div className="flex-1 w-full max-w-[1600px] 2xl:max-w-[1800px] mx-auto flex flex-col">
        <div className="space-y-8 sm:space-y-10 lg:space-y-12 animate-fade-in pb-14 sm:pb-16 lg:pb-20">
          <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-black/5 p-6 sm:p-9 md:p-12 lg:p-14 xl:p-16 shadow-2xl flex flex-col xl:flex-row justify-between items-start gap-8 sm:gap-10 lg:gap-12 relative overflow-hidden print:hidden">
            <div className="flex flex-col gap-5 sm:gap-7 lg:gap-8 relative z-10 w-full xl:w-auto min-w-0">
              <div className="space-y-3 sm:space-y-4">
                <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 bg-brand/5 rounded-full border border-brand/10 w-fit">
                  <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-brand">
                    Next-gen Analytics
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tighter uppercase">
                    Libellius <span className="text-brand">InsightHub</span>
                  </h2>
                </div>
              </div>

              <div className="w-20 h-1 bg-black/5 rounded-full"></div>

              <div className="space-y-3 sm:space-y-4 min-w-0">
                <h1 className="text-2xl sm:text-3xl md:text-4xl xl:text-5xl font-black tracking-tighter uppercase leading-none text-black break-words max-w-4xl">
                  {data.surveyName || '360° spätná väzba'}
                </h1>

                <div className="flex flex-wrap items-center gap-3 sm:gap-4 lg:gap-5 mt-3">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-black/5 rounded-lg border border-black/5 min-w-0">
                    <Building2 className="w-4 h-4 text-black/40 shrink-0" />
                    <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-black/60 truncate">
                      {data.companyName || result.reportMetadata.company || 'Názov firmy'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 px-3 py-1.5 bg-black/5 rounded-lg border border-black/5 min-w-0">
                    <Users className="w-4 h-4 text-black/40 shrink-0" />
                    <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-black/60 truncate">
                      {individuals.length} hodnotených osôb
                    </span>
                  </div>

                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-black/30">
                    Vydané: {result.reportMetadata?.date || new Date().getFullYear().toString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-stretch gap-3 sm:gap-4 relative z-10 w-full xl:w-auto xl:min-w-[220px] xl:items-end shrink-0 pt-2 sm:pt-3 md:pt-5 xl:pt-0">
              <button
                onClick={onReset}
                className="w-full xl:w-[220px] flex items-center justify-center gap-2 px-4 sm:px-6 py-3.5 sm:py-4 bg-black/5 hover:bg-black hover:text-white rounded-xl sm:rounded-2xl font-black transition-all text-[10px] sm:text-[11px] uppercase tracking-widest border border-black/5 group mt-auto"
              >
                <ArrowUpDown className="w-4 h-4 text-black/40 group-hover:text-white" />
                Zavrieť
              </button>
            </div>

            <div className="absolute top-[-20%] right-[-10%] w-72 sm:w-96 h-72 sm:h-96 bg-brand/5 rounded-full blur-[100px] pointer-events-none -z-0"></div>
          </div>

          <div className="relative w-full mx-auto print:hidden">
            <div
              ref={tabsScrollRef}
              className="flex gap-2.5 bg-white p-2.5 rounded-[1.4rem] sm:rounded-[1.7rem] w-full overflow-x-auto no-scrollbar border border-black/5 whitespace-nowrap shadow-[0_18px_42px_-30px_rgba(0,0,0,0.65)]"
            >
              {reportTabs.map((tab) => {
                const isActive = activeTab === tab.id;
                const activeClasses =
                  tab.tone === 'brand'
                    ? 'bg-brand text-white border-brand shadow-[0_12px_26px_-14px_rgba(184,21,71,0.8)]'
                    : 'bg-black text-white border-black shadow-[0_12px_26px_-14px_rgba(0,0,0,0.85)]';
                const Icon = tab.icon;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`group shrink-0 min-w-max inline-flex items-center justify-center gap-2.5 py-3 sm:py-4 lg:py-4.5 px-5 sm:px-6 lg:px-7 rounded-2xl border font-black text-[11px] sm:text-sm uppercase tracking-[0.1em] transition-all duration-300 whitespace-nowrap ${
                      isActive
                        ? activeClasses
                        : 'border-transparent text-black/45 hover:text-black/80 hover:bg-black/[0.04]'
                    }`}
                  >
                    <Icon
                      className={`w-[18px] h-[18px] shrink-0 transition-opacity ${
                        isActive ? 'opacity-95' : 'opacity-40 group-hover:opacity-65'
                      }`}
                    />
                    <span className="leading-none">{tab.label}</span>
                  </button>
                );
              })}
            </div>
            <div
              aria-hidden="true"
              className={`hidden sm:block absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none transition-opacity ${
                canScrollTabsLeft ? 'opacity-100' : 'opacity-0'
              }`}
            />
            <div
              aria-hidden="true"
              className={`hidden sm:block absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none transition-opacity ${
                canScrollTabsRight ? 'opacity-100' : 'opacity-0'
              }`}
            />
          </div>

          {activeTab === 'PARTICIPANTS' && (
            <div className="relative w-full mx-auto print:hidden">
              <div className="flex gap-2.5 bg-white p-2.5 rounded-[1.4rem] sm:rounded-[1.7rem] w-full overflow-x-auto no-scrollbar border border-black/5 whitespace-nowrap shadow-[0_18px_42px_-30px_rgba(0,0,0,0.65)]">
                <button
                  type="button"
                  onClick={() =>
                    setActiveParticipantsMatrixTab(PARTICIPANTS_COMPARISON_TAB_ID)
                  }
                  className={`group shrink-0 min-w-max inline-flex items-center justify-center gap-2.5 py-3 sm:py-4 lg:py-4.5 px-5 sm:px-6 lg:px-7 rounded-2xl border font-black text-[11px] sm:text-sm uppercase tracking-[0.1em] transition-all duration-300 whitespace-nowrap ${
                    activeParticipantsMatrixTab === PARTICIPANTS_COMPARISON_TAB_ID
                      ? 'bg-brand text-white border-brand shadow-[0_12px_26px_-14px_rgba(184,21,71,0.8)]'
                      : 'border-transparent text-black/45 hover:text-black/80 hover:bg-black/[0.04]'
                  }`}
                >
                  <Table
                    className={`w-[18px] h-[18px] shrink-0 transition-opacity ${
                      activeParticipantsMatrixTab === PARTICIPANTS_COMPARISON_TAB_ID
                        ? 'opacity-95'
                        : 'opacity-40 group-hover:opacity-65'
                    }`}
                  />
                  <span className="leading-none">Porovnanie</span>
                </button>

                {companyReport.participants.map((participant) => {
                  const isActive = activeParticipantsMatrixTab === participant.id;

                  return (
                    <button
                      key={participant.id}
                      type="button"
                      onClick={() => setActiveParticipantsMatrixTab(participant.id)}
                      className={`group shrink-0 min-w-max inline-flex items-center justify-center gap-2.5 py-3 sm:py-4 lg:py-4.5 px-5 sm:px-6 lg:px-7 rounded-2xl border font-black text-[11px] sm:text-sm uppercase tracking-[0.1em] transition-all duration-300 whitespace-nowrap ${
                        isActive
                          ? 'bg-brand text-white border-brand shadow-[0_12px_26px_-14px_rgba(184,21,71,0.8)]'
                          : 'border-transparent text-black/45 hover:text-black/80 hover:bg-black/[0.04]'
                      }`}
                    >
                      <UserCheck
                        className={`w-[18px] h-[18px] shrink-0 transition-opacity ${
                          isActive ? 'opacity-95' : 'opacity-40 group-hover:opacity-65'
                        }`}
                      />
                      <span className="leading-none">{participant.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'INTRO' && (
            <CompanyParticipantsBentoBlock
              companyReport={companyReport}
              scaleMax={data.scaleMax}
            />
          )}

          {activeTab === 'COMPANY_OVERVIEW' && (
            <CompanyOverviewBlock
              competencies={companyReport.competencies}
              respondentCounts={companyReport.respondentCounts}
              scaleMax={data.scaleMax}
            />
          )}

          {activeTab === 'COMPANY_DETAIL' && (
            <CompanyDetailBlock
              competencies={companyReport.competencies}
              respondentCounts={companyReport.respondentCounts}
            />
          )}

          {activeTab === 'STRENGTHS' && (
            <CompanyStrengthWeaknessBlock
              strengths={companyReport.strengths}
              developmentNeeds={companyReport.developmentNeeds}
            />
          )}

          {activeTab === 'PARTICIPANTS' && (
            <ParticipantsMatrixBlock
              participants={companyReport.participants}
              competencyColumns={competencyColumns}
              activeParticipantTab={activeParticipantsMatrixTab}
              onParticipantTabChange={handleParticipantsMatrixTabChange}
            />
          )}

          {activeTab === 'INDIVIDUALS' && (
            <div className="space-y-6 sm:space-y-8">
              {!selectedIndividual ? (
                <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-black/5 p-10 shadow-2xl text-center">
                  <AlertCircle className="w-10 h-10 mx-auto text-brand mb-4" />
                  <p className="font-black text-lg">Účastník nebol nájdený.</p>
                </div>
              ) : (
                <>
                  <IndividualOverviewBlock
                    individual={selectedIndividual}
                    individuals={individuals}
                    onIndividualChange={setSelectedIndividualId}
                    scaleMax={data.scaleMax}
                  />
                  <IndividualDetailBlock individual={selectedIndividual} />
                  <IndividualPotentialBlock
                    overestimatedPotential={selectedIndividual.overestimatedPotential}
                    hiddenPotential={selectedIndividual.hiddenPotential}
                  />
                </>
              )}
            </div>
          )}

          <div className="mt-12 sm:mt-16 pt-8 sm:pt-10 border-t border-black/10 flex flex-col md:flex-row justify-between items-center gap-4 sm:gap-6 text-black/40 pb-4 sm:pb-6 print:hidden">
            <div className="flex items-center gap-4">
              <img
                src="/logo.png"
                alt="Libellius"
                className="h-14 sm:h-20 lg:h-24 w-auto object-contain"
              />
            </div>

            <div className="text-center md:text-right">
              <p className="text-xs font-bold text-black/60">
                © {new Date().getFullYear()} Libellius. Všetky práva vyhradené.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Feedback360Dashboard;
