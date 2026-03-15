import React, { useState, useMemo } from 'react';
import { FeedbackAnalysisResult } from '../types';
import EngagementBlock from './satisfaction/EngagementBlock';
import OpenQuestionsBlock from './satisfaction/OpenQuestionsBlock';
import AreaAnalysisBlock from './satisfaction/AreaAnalysisBlock';
import { encryptReportToUrlPayload } from '../utils/reportCrypto';
import WelcomeGuide from './WelcomeGuide'; 
import {
  Users,
  BarChart4,
  UserCheck,
  Building2,
  Download,
  Link as LinkIcon,
  Check,
  ArrowUpDown,
  MessageSquare,
  Sparkles,
} from 'lucide-react';

interface Props {
  result: FeedbackAnalysisResult;
  onReset: () => void;
}

type TabType = 'ENGAGEMENT' | 'OPEN_QUESTIONS' | string;

const SatisfactionDashboard: React.FC<Props> = ({ result, onReset }) => {
  const data = result.satisfaction || (result as any);
  const scaleMax =
    result.reportMetadata?.scaleMax || (data as any).reportMetadata?.scaleMax || 6;
  const isSharedView =
    typeof window !== 'undefined' && window.location.hash.startsWith('#report=');

  const [activeTab, setActiveTab] = useState<TabType>('ENGAGEMENT');
  const [copyStatus, setCopyStatus] = useState(false);

  // Stavy pre ovládanie sprievodcu
  const [showGuide, setShowGuide] = useState(isSharedView);
  const [isGuideStartedManually, setIsGuideStartedManually] = useState(false);

  const openGuideManually = () => {
    setIsGuideStartedManually(true);
    setShowGuide(true);
  };

  const generateShareLink = async () => {
    try {
      const password = window.prompt('Zadajte heslo pre report (min. 6 znakov):');
      if (!password) return;
      if (password.trim().length < 6) {
        return alert('Heslo musí mať aspoň 6 znakov.');
      }

      const encryptedPayload = await encryptReportToUrlPayload(result, password.trim());
      const clientMeta = encodeURIComponent(data.clientName || 'Klient');
      const surveyMeta = encodeURIComponent(data.surveyName || 'Prieskum spokojnosti');
      const issuedMeta = encodeURIComponent(
        result.reportMetadata?.date || new Date().toLocaleDateString('sk-SK')
      );

      const shareUrl = `${window.location.origin}${window.location.pathname}#report=${encodeURIComponent(
        encryptedPayload
      )}&client=${clientMeta}&survey=${surveyMeta}&issued=${issuedMeta}`;

      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopyStatus(true);
        setTimeout(() => setCopyStatus(false), 2000);
        alert('Odkaz bol skopírovaný. Heslo pošlite používateľovi zvlášť.');
      } catch (clipboardErr) {
        window.prompt('Skopírujte odkaz manuálne (Cmd+C):', shareUrl);
        setCopyStatus(true);
        setTimeout(() => setCopyStatus(false), 2000);
      }
    } catch (err: any) {
      alert('Chyba pri vytváraní zabezpečeného odkazu.');
    }
  };

  const exportToJson = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(result));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', dataStr);

    const fileBaseName = `${data.clientName || 'firma'}_${data.surveyName || 'prieskum'}`
      .replace(/\s+/g, '_')
      .replace(/[^\w\-]/g, '');

    downloadAnchorNode.setAttribute('download', `${fileBaseName}_analyza.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const masterTeams = useMemo(() => {
    if (!data?.teamEngagement) return [];

    return data.teamEngagement
      .map((t: any) => t.name)
      .filter(
        (name: string) => name && !['total', 'celkom'].includes(name.toLowerCase())
      )
      .sort((a: string, b: string) => {
        if (a.toLowerCase().includes('priemer')) return -1;
        if (b.toLowerCase().includes('priemer')) return 1;
        return a.localeCompare(b);
      });
  }, [data]);

  if (!data) return null;

  const areaTabs = (data.areas || []).map((area: any, idx: number) => {
    const icons = [BarChart4, UserCheck, Users, Building2];
    return {
      id: area.id,
      icon: icons[idx % icons.length],
      label: area.title,
    };
  });

  const allTabs = [
    { id: 'ENGAGEMENT', icon: Users, label: 'Zapojenie' },
    { id: 'OPEN_QUESTIONS', icon: MessageSquare, label: 'Otvorené otázky' },
    ...areaTabs,
  ];

  return (
    <div className="min-h-screen flex flex-col px-4 sm:px-6 lg:px-8">
      
      {/* SPRIEVODCA REPORTOM */}
      {showGuide && (
        <WelcomeGuide 
          onClose={() => setShowGuide(false)} 
          autoStartDelay={isGuideStartedManually ? 0 : 1500} 
        />
      )}

      <div className="flex-1 w-full max-w-[1600px] 2xl:max-w-[1800px] mx-auto flex flex-col">
        <div className="space-y-6 sm:space-y-8 animate-fade-in pb-10 sm:pb-12">
          
          {/* HLAVIČKA */}
          <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-black/5 p-5 sm:p-8 md:p-10 lg:p-12 shadow-2xl flex flex-col xl:flex-row justify-between items-start gap-6 sm:gap-8 relative overflow-hidden print:hidden">
            <div className="flex flex-col gap-4 sm:gap-6 relative z-10 w-full xl:w-auto min-w-0">
              <div className="space-y-2 sm:space-y-3">
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

              <div className="w-16 h-1 bg-black/5 rounded-full"></div>

              <div className="space-y-2 sm:space-y-3 min-w-0">
                <h1 className="text-2xl sm:text-3xl md:text-4xl xl:text-5xl font-black tracking-tighter uppercase leading-none text-black break-words max-w-4xl">
                  {data.surveyName || 'Prieskum spokojnosti'}
                </h1>

                <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-black/5 rounded-lg border border-black/5 min-w-0">
                    <Building2 className="w-4 h-4 text-black/40 shrink-0" />
                    <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-black/60 truncate">
                      {data.clientName || 'Názov firmy'}
                    </span>
                  </div>

                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-black/30">
                    Vydané:{' '}
                    {result.reportMetadata?.date || new Date().getFullYear().toString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-stretch gap-2 sm:gap-3 relative z-10 w-full xl:w-auto xl:min-w-[220px] xl:items-end shrink-0 pt-1 sm:pt-2 md:pt-4 xl:pt-0">
              
              {/* TLAČIDLO SPRIEVODCU - IBA PRE KLIENTA */}
              {isSharedView && (
                <button
                  onClick={openGuideManually}
                  className="w-full xl:w-[220px] flex items-center justify-center gap-3 px-4 sm:px-6 py-3 sm:py-4 bg-white border border-black/5 rounded-xl sm:rounded-2xl font-black transition-all text-[10px] sm:text-[11px] uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 group"
                >
                  <Sparkles className="w-4 h-4 text-brand group-hover:animate-pulse" />
                  <span className="text-black">Sprievodca reportom</span>
                </button>
              )}

              {!isSharedView && (
                <>
                  <button
                    onClick={generateShareLink}
                    className={`w-full xl:w-[220px] flex items-center justify-center gap-2 px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black transition-all text-[10px] sm:text-[11px] uppercase tracking-widest shadow-xl ${
                      copyStatus
                        ? 'bg-green-600 text-white scale-105'
                        : 'bg-white border-2 border-brand text-brand hover:bg-brand hover:text-white'
                    }`}
                  >
                    {copyStatus ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <LinkIcon className="w-4 h-4" />
                    )}
                    {copyStatus ? 'Skopírované!' : 'Zdieľať'}
                  </button>

                  <button
                    onClick={exportToJson}
                    className="w-full xl:w-[220px] flex items-center justify-center gap-2 px-4 sm:px-6 py-3 sm:py-4 bg-black text-white hover:bg-brand rounded-xl sm:rounded-2xl font-black transition-all text-[10px] sm:text-[11px] uppercase tracking-widest shadow-2xl"
                  >
                    <Download className="w-4 h-4" /> Export
                  </button>
                </>
              )}

              <button
                onClick={onReset}
                className="w-full xl:w-[220px] flex items-center justify-center gap-2 px-4 sm:px-6 py-3 sm:py-4 bg-black/5 hover:bg-black hover:text-white rounded-xl sm:rounded-2xl font-black transition-all text-[10px] sm:text-[11px] uppercase tracking-widest border border-black/5 group"
              >
                <ArrowUpDown className="w-4 h-4 text-black/40 group-hover:text-white" />
                {isSharedView ? 'Zavrieť report' : 'Zavrieť'}
              </button>
            </div>

            <div className="absolute top-[-20%] right-[-10%] w-72 sm:w-96 h-72 sm:h-96 bg-brand/5 rounded-full blur-[100px] pointer-events-none -z-0"></div>
          </div>

          {/* TABY */}
          <div className="flex gap-2 bg-black/5 p-2 rounded-2xl sm:rounded-3xl w-full mx-auto overflow-x-auto no-scrollbar border border-black/5 print:hidden">
            {allTabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as TabType)}
                className={`shrink-0 xl:shrink xl:flex-1 xl:min-w-0 flex items-center justify-center gap-2 py-3 sm:py-4 lg:py-5 px-4 sm:px-5 lg:px-6 rounded-xl sm:rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap ${
                  activeTab === t.id
                    ? 'bg-white text-black shadow-lg'
                    : 'text-black/40 hover:text-black'
                }`}
              >
                <t.icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{t.label}</span>
              </button>
            ))}
          </div>

          {/* VYKRESLENIE SEKCII PODĽA AKTÍVNEHO TABU */}
          {activeTab === 'ENGAGEMENT' && (
            <EngagementBlock data={data} masterTeams={masterTeams} />
          )}

          {activeTab === 'OPEN_QUESTIONS' && (
            <OpenQuestionsBlock
              openQuestions={data.openQuestions || []}
              masterTeams={masterTeams}
            />
          )}

          {(() => {
            const activeArea = (data.areas || []).find((a: any) => a.id === activeTab);
            if (activeArea) {
              return (
                <AreaAnalysisBlock
                  area={activeArea}
                  masterTeams={masterTeams}
                  scaleMax={scaleMax}
                />
              );
            }
            return null;
          })()}

          {/* PÄTIČKA */}
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
              <p className="text-[10px] font-bold uppercase tracking-widest mt-1">
                Generované pomocou umelej inteligencie
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SatisfactionDashboard;
