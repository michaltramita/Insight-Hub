import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Lightbulb, ChevronDown, MessageCircle, Quote } from 'lucide-react';

interface Props {
  openQuestions: any[];
  masterTeams: string[];
}

const OpenQuestionsBlock: React.FC<Props> = ({ openQuestions, masterTeams }) => {
  const [openQuestionsTeam, setOpenQuestionsTeam] = useState<string>('');
  const [selectedQuestionText, setSelectedQuestionText] = useState<string>('');
  const [expandedRecIndex, setExpandedRecIndex] = useState<number | null>(null);
  
  const [themeTooltip, setThemeTooltip] = useState<{
    x: number;
    y: number;
    theme: string;
    count: number;
    percentage: number;
  } | null>(null);

  // Inicializácia tímu
  useEffect(() => {
    if (masterTeams.length === 0) return;
    if (!openQuestionsTeam) {
      const initialTeam = masterTeams.find((t: string) => t.toLowerCase().includes('priemer')) || masterTeams[0];
      setOpenQuestionsTeam(initialTeam);
    }
  }, [masterTeams, openQuestionsTeam]);

  // Inicializácia vybranej otázky po zmene tímu
  useEffect(() => {
    if (openQuestionsTeam && openQuestions) {
      const teamQuestions = openQuestions.find((t: any) => t.teamName === openQuestionsTeam)?.questions || [];
      if (teamQuestions.length > 0) {
        if (!teamQuestions.find((q: any) => q.questionText === selectedQuestionText)) {
          setSelectedQuestionText(teamQuestions[0].questionText);
        }
      } else {
        setSelectedQuestionText('');
      }
    }
    setExpandedRecIndex(null);
  }, [openQuestionsTeam, openQuestions, selectedQuestionText]);

  // Vypnutie tooltipu pri kliknutí inde
  useEffect(() => {
    const handleGlobalClick = () => setThemeTooltip(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const getThemeCloud = (question: any) => {
    if (!question?.themeCloud || !Array.isArray(question.themeCloud)) return [];
    return question.themeCloud
      .filter((t: any) => t?.theme)
      .map((t: any) => ({
        theme: String(t.theme),
        count: Number(t.count) || 0,
        percentage: Number(t.percentage) || 0,
      }))
      .sort((a: any, b: any) => b.count - a.count);
  };

  const getThemeFontSizeClass = (count: number, maxCount: number) => {
    if (maxCount <= 0) return 'text-sm';
    const ratio = count / maxCount;
    if (ratio >= 0.8) return 'text-2xl md:text-3xl';
    if (ratio >= 0.6) return 'text-xl md:text-2xl';
    if (ratio >= 0.4) return 'text-lg md:text-xl';
    if (ratio >= 0.2) return 'text-base md:text-lg';
    return 'text-sm md:text-base';
  };

  const openQuestionsTeamData = openQuestions?.find((t: any) => t.teamName === openQuestionsTeam);
  const availableQuestions = openQuestionsTeamData?.questions || [];
  const selectedQuestionData = availableQuestions.find((q: any) => q.questionText === selectedQuestionText) || availableQuestions[0];

  const selectedQuestionThemeCloud = getThemeCloud(selectedQuestionData);
  const selectedQuestionMaxThemeCount = selectedQuestionThemeCloud.length > 0
    ? Math.max(...selectedQuestionThemeCloud.map((t: any) => t.count))
    : 0;

  return (
    <div className="space-y-8 sm:space-y-10 animate-fade-in print:hidden">
      <div className="bg-white p-6 sm:p-8 lg:p-10 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-black/5 shadow-2xl">
        <div className="flex flex-col lg:flex-row justify-between items-start gap-6 sm:gap-8">
          <div className="space-y-4 sm:space-y-6 w-full lg:w-1/2 min-w-0">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand/5 rounded-full text-[10px] font-black uppercase text-brand tracking-[0.2em]">
              <Lightbulb className="w-3 h-3" /> Analýza a odporúčania
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-tighter leading-none">Otvorené otázky</h2>
            <p className="text-sm font-medium text-black/50 leading-relaxed max-w-md">
              Umelá inteligencia zosumarizovala odpovede zamestnancov a pre každú otázku vygenerovala kľúčové odporúčania pre manažment.
            </p>
          </div>

          <div className="flex flex-col gap-4 w-full lg:w-1/2">
            <div className="w-full">
              <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-black/20 mb-2">VYBERTE TÍM:</span>
              <div className="relative">
                <select
                  value={openQuestionsTeam}
                  onChange={(e) => setOpenQuestionsTeam(e.target.value)}
                  className="w-full p-4 sm:p-5 pr-12 bg-black text-white rounded-[1rem] sm:rounded-[1.5rem] font-black text-base sm:text-lg outline-none shadow-xl cursor-pointer hover:bg-brand transition-all appearance-none tracking-tight"
                >
                  {masterTeams.map((t: string) => <option key={t} value={t}>{t}</option>)}
                </select>
                <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 pointer-events-none" />
              </div>
            </div>

            <div className="w-full">
              <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-black/20 mb-2">VYBERTE OTÁZKU:</span>
              <div className="relative">
                <select
                  value={selectedQuestionText}
                  onChange={(e) => setSelectedQuestionText(e.target.value)}
                  className="w-full p-4 sm:p-5 pr-12 bg-black/5 text-black rounded-[1rem] sm:rounded-[1.5rem] font-bold text-sm outline-none shadow-sm cursor-pointer border border-black/5 hover:bg-black/10 transition-all appearance-none"
                  disabled={availableQuestions.length === 0}
                >
                  {availableQuestions.length > 0
                    ? availableQuestions.map((q: any, i: number) => <option key={i} value={q.questionText}>{q.questionText}</option>)
                    : <option value="">Žiadne otázky nie sú k dispozícii</option>}
                </select>
                <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-black/40 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {selectedQuestionData?.recommendations && selectedQuestionData.recommendations.length > 0 ? (
        <div className="flex flex-col gap-4 sm:gap-6">
          {selectedQuestionThemeCloud.length > 0 && (
            <div className="bg-white p-6 sm:p-8 md:p-10 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-black/5 shadow-xl">
              <h5 className="text-[11px] font-black uppercase tracking-[0.2em] text-brand mb-4 flex items-center gap-2">
                <Lightbulb className="w-4 h-4" /> Tematická mapa odpovedí (otázka)
              </h5>

              <div className="bg-black/5 rounded-2xl p-4 sm:p-5 md:p-6 border border-black/5">
                <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-2 sm:gap-y-3">
                  {selectedQuestionThemeCloud.map((theme: any, tIdx: number) => (
                    <span
                      key={tIdx}
                      onMouseEnter={(e) => {
                        setThemeTooltip({
                          x: e.clientX,
                          y: e.clientY,
                          theme: theme.theme,
                          count: theme.count,
                          percentage: theme.percentage,
                        });
                      }}
                      onMouseMove={(e) => {
                        setThemeTooltip((prev) => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev);
                      }}
                      onMouseLeave={() => setThemeTooltip(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setThemeTooltip((prev) => {
                          if (prev?.theme === theme.theme) return null;
                          return { theme: theme.theme, count: theme.count, percentage: theme.percentage, x: e.clientX, y: e.clientY };
                        });
                      }}
                      className={`
                        inline-flex items-center rounded-xl px-3 py-1.5
                        font-black tracking-tight cursor-help select-none transition-all
                        ${tIdx < 2 ? 'text-brand bg-brand/10' : 'text-black bg-white'}
                        ${getThemeFontSizeClass(theme.count, selectedQuestionMaxThemeCount)}
                        hover:scale-[1.03]
                      `}
                    >
                      {theme.theme}
                    </span>
                  ))}
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-black/35 mt-4">
                  Veľkosť témy zodpovedá frekvencii výskytu
                </p>
              </div>
            </div>
          )}

          {selectedQuestionData.recommendations.map((rec: any, index: number) => {
            const hasQuotes = Array.isArray(rec?.quotes) && rec.quotes.length > 0;

            return (
              <div
                key={index}
                className={`bg-white p-5 sm:p-6 md:p-8 lg:p-10 rounded-[1.25rem] sm:rounded-[1.75rem] lg:rounded-[2.5rem] border transition-all duration-300 flex flex-col group cursor-pointer ${expandedRecIndex === index ? 'border-brand/20 shadow-2xl' : 'border-black/5 shadow-xl hover:shadow-2xl hover:border-black/10'}`}
                onClick={() => setExpandedRecIndex(expandedRecIndex === index ? null : index)}
              >
                <div className="flex flex-col md:flex-row gap-4 sm:gap-6 md:gap-8 items-start w-full">
                  <div className={`w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 shadow-sm ${expandedRecIndex === index ? 'bg-brand text-white scale-110' : 'bg-brand/5 text-brand group-hover:scale-110 group-hover:bg-brand group-hover:text-white'}`}>
                    <span className="font-black text-xl sm:text-2xl">{index + 1}</span>
                  </div>

                  <div className="flex-grow pt-1 sm:pt-2 flex flex-col md:flex-row justify-between items-start gap-4 min-w-0">
                    <div className="max-w-4xl min-w-0">
                      <h4 className="text-lg sm:text-xl md:text-2xl font-black text-black mb-2 sm:mb-4 leading-tight break-words">{rec.title}</h4>
                      <p className="text-sm sm:text-base text-black/60 font-medium leading-relaxed break-words">{rec.description}</p>
                    </div>

                    <div className={`shrink-0 mt-1 md:mt-2 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-black/5 transition-transform duration-300 ${expandedRecIndex === index ? 'rotate-180 bg-brand/10 text-brand' : 'text-black/40 group-hover:bg-black/10'}`}>
                      <ChevronDown className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                {expandedRecIndex === index && (
                  <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-black/5 animate-fade-in pl-0 md:pl-24 space-y-6 sm:space-y-8">
                    {hasQuotes ? (
                      <div>
                        <h5 className="text-[11px] font-black uppercase tracking-[0.2em] text-brand mb-4 sm:mb-6 flex items-center gap-2">
                          <MessageCircle className="w-4 h-4" /> Reprezentatívne citácie z odpovedí
                        </h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                          {rec.quotes.map((quote: string, qIdx: number) => (
                            <div key={qIdx} className="bg-black/5 p-4 sm:p-5 rounded-2xl relative">
                              <Quote className="w-5 h-5 text-black/10 absolute top-4 left-4" />
                              <p className="text-sm font-medium text-black/80 italic pl-8 leading-relaxed">"{quote}"</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-black/5 rounded-2xl p-4 sm:p-5 text-sm font-bold text-black/50">
                        Pre toto odporúčanie nie sú dostupné citácie.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 sm:py-20 bg-white rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-black/5 text-black/30 font-black uppercase tracking-widest text-xs sm:text-sm">
          Pre túto otázku a stredisko nie sú dostupné žiadne odporúčania.
        </div>
      )}

      {/* Portál pre Tooltip vysunutý úplne von */}
      {themeTooltip && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{
            left: themeTooltip.x,
            top: themeTooltip.y,
            transform: 'translate(15px, 15px)',
          }}
        >
          <div className="bg-black text-white rounded-2xl shadow-2xl border border-white/10 px-4 py-3 min-w-[220px] max-w-[280px]">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50 mb-2">Theme cloud</p>
            <p className="text-sm sm:text-base font-black leading-tight mb-3">{themeTooltip.theme}</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-white/60 font-bold">Výskyt</span>
                <span className="font-black">{themeTooltip.count}x</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-white/60 font-bold">Podiel</span>
                <span className="font-black">{themeTooltip.percentage}%</span>
              </div>
            </div>
          </div>
        </div>,
        document.body 
      )}
    </div>
  );
};

export default OpenQuestionsBlock;
