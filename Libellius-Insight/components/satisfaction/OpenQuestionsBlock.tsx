import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, MessageCircle, Quote, X } from 'lucide-react';
import StyledSelect from '../ui/StyledSelect';

interface Props {
  openQuestions: any[];
  masterTeams: string[];
}

// --------------------------------------------------------------------------
// PRÉMIOVÝ VÝSUVNÝ PANEL PRE MOBILY
// --------------------------------------------------------------------------
const MobileBottomSheet = ({
  isOpen,
  onClose,
  themeData,
}: {
  isOpen: boolean;
  onClose: () => void;
  themeData: { theme: string; count: number; percentage: number } | null;
}) => {
  // Zámok scrollovania pri otvorenom paneli
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (typeof document === 'undefined' || !themeData) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop - Tmavé pozadie klikateľné na zavretie */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[99998] bg-black/60 backdrop-blur-sm"
          />

          {/* Samotný panel */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            // Umožní zatvorenie potiahnutím nadol
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100) onClose();
            }}
            className="fixed bottom-0 left-0 right-0 z-[99999] bg-white rounded-t-[2rem] shadow-[0_-20px_60px_-15px_rgba(0,0,0,0.3)] touch-none"
          >
            {/* Indikátor pre swipovanie */}
            <div className="w-full flex justify-center pt-4 pb-2 active:cursor-grabbing cursor-grab">
              <div className="w-12 h-1.5 bg-black/15 rounded-full" />
            </div>

            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 bg-black/5 rounded-full text-black/40 hover:text-black hover:bg-black/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="px-6 pb-10 pt-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand mb-2">
                Detail témy
              </p>
              <h3 className="text-xl font-black text-black leading-tight mb-6">
                {themeData.theme}
              </h3>

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between bg-black/5 p-4 rounded-xl">
                  <span className="text-sm font-bold text-black/50">Výskyt</span>
                  <span className="text-lg font-black">{themeData.count}x</span>
                </div>
                <div className="flex items-center justify-between bg-black/5 p-4 rounded-xl">
                  <span className="text-sm font-bold text-black/50">Podiel</span>
                  <span className="text-lg font-black">{themeData.percentage}%</span>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};
// --------------------------------------------------------------------------

const OpenQuestionsBlock: React.FC<Props> = ({ openQuestions, masterTeams }) => {
  const [openQuestionsTeam, setOpenQuestionsTeam] = useState<string>('');
  const [selectedQuestionText, setSelectedQuestionText] = useState<string>('');
  const [selectedThemeFilter, setSelectedThemeFilter] = useState<string | null>(null);

  // Detekcia, či sme na mobile
  const [isMobile, setIsMobile] = useState(false);
  
  // Tento stav drží dáta, keď na mobile používateľ ťukne na tému
  const [mobileSelectedTheme, setMobileSelectedTheme] = useState<{
    theme: string;
    count: number;
    percentage: number;
  } | null>(null);

  // Klasický tooltip pre PC zostal zachovaný
  const [themeTooltip, setThemeTooltip] = useState<{
    x: number;
    y: number;
    theme: string;
    count: number;
    percentage: number;
  } | null>(null);

  // Sledovanie veľkosti okna
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
    setSelectedThemeFilter(null);
  }, [openQuestionsTeam, openQuestions, selectedQuestionText]);

  // Vypnutie PC tooltipu pri kliknutí inde
  useEffect(() => {
    if (isMobile) return; // Na mobile to neriešime, tam máme panel
    const handleGlobalClick = () => setThemeTooltip(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [isMobile]);

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

  const getOpenResponses = (question: any) => {
    if (!question?.responses || !Array.isArray(question.responses)) return [];
    return question.responses
      .map((r: any) => ({
        text: String(r?.text || '').trim(),
        theme: String(r?.theme || '').trim(),
      }))
      .filter((r: any) => r.text);
  };

  const normalizeThemeKey = (theme: string) =>
    String(theme || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

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
  const teamOptions = masterTeams.map((team: string) => ({
    value: team,
    label: team,
  }));
  const questionOptions =
    availableQuestions.length > 0
      ? availableQuestions.map((question: any, index: number) => ({
          value: String(question?.questionText || ''),
          label: String(question?.questionText || `Otázka ${index + 1}`),
        }))
      : [{ value: '', label: 'Žiadne otázky nie sú k dispozícii', disabled: true }];

  const selectedQuestionThemeCloud = getThemeCloud(selectedQuestionData);
  const selectedQuestionMaxThemeCount = selectedQuestionThemeCloud.length > 0
    ? Math.max(...selectedQuestionThemeCloud.map((t: any) => t.count))
    : 0;
  const selectedQuestionResponses = getOpenResponses(selectedQuestionData);
  const filteredResponses = selectedThemeFilter
    ? selectedQuestionResponses.filter(
        (response: any) =>
          normalizeThemeKey(response.theme) === normalizeThemeKey(selectedThemeFilter)
      )
    : selectedQuestionResponses;

  return (
    <div className="space-y-8 sm:space-y-10 animate-fade-in print:hidden">
      
      {/* VÝSUVNÝ PANEL PRE MOBIL */}
      {isMobile && (
        <MobileBottomSheet
          isOpen={!!mobileSelectedTheme}
          onClose={() => setMobileSelectedTheme(null)}
          themeData={mobileSelectedTheme}
        />
      )}

      <div className="bg-white p-6 sm:p-8 lg:p-10 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-black/5 shadow-2xl">
        <div className="flex flex-col lg:flex-row justify-between items-start gap-6 sm:gap-8">
          <div className="space-y-4 sm:space-y-6 w-full lg:w-1/2 min-w-0">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand/5 rounded-full text-[10px] font-black uppercase text-brand tracking-[0.2em]">
              <Lightbulb className="w-3 h-3" /> Tematická mapa a odpovede
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-tighter leading-none">Otvorené otázky</h2>
            <p className="text-sm font-medium text-black/50 leading-relaxed max-w-md">
              Prezrite si tematickú mapu a konkrétne znenia odpovedí zamestnancov pre vybraný tím a otázku.
            </p>
          </div>

          <div className="flex flex-col gap-4 w-full lg:w-1/2">
            <div className="w-full">
              <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-black/20 mb-2">VYBERTE TÍM:</span>
              <StyledSelect
                value={openQuestionsTeam}
                onChange={setOpenQuestionsTeam}
                options={teamOptions}
                buttonClassName="w-full p-4 sm:p-5 bg-black text-white rounded-[1rem] sm:rounded-[1.5rem] font-black text-base sm:text-lg shadow-xl hover:bg-brand tracking-tight"
                panelClassName="bg-white border-black/10"
                optionClassName="text-black/70 hover:bg-black/5 hover:text-black"
                selectedOptionClassName="bg-brand text-white"
                iconClassName="text-white/40"
              />
            </div>

            <div className="w-full">
              <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-black/20 mb-2">VYBERTE OTÁZKU:</span>
              <StyledSelect
                value={selectedQuestionText}
                onChange={setSelectedQuestionText}
                options={questionOptions}
                disabled={availableQuestions.length === 0}
                buttonClassName="w-full p-4 sm:p-5 bg-black/5 text-black rounded-[1rem] sm:rounded-[1.5rem] font-bold text-sm shadow-sm border border-black/5 hover:bg-black/10"
                panelClassName="bg-white border border-black/10"
                selectedOptionClassName="bg-black text-white"
                iconClassName="text-black/40"
              />
            </div>
          </div>
        </div>
      </div>

      {selectedQuestionData ? (
        <div className="flex flex-col gap-4 sm:gap-6">
          {selectedQuestionThemeCloud.length > 0 && (
            <div className="bg-white p-6 sm:p-8 md:p-10 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-black/5 shadow-xl">
              <h5 className="text-[11px] font-black uppercase tracking-[0.2em] text-brand mb-4 flex items-center gap-2">
                <Lightbulb className="w-4 h-4" /> Tematická mapa odpovedí (otázka)
              </h5>

              <div className="bg-black/5 rounded-2xl p-4 sm:p-5 md:p-6 border border-black/5">
                <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-2 sm:gap-y-3">
                  {selectedQuestionThemeCloud.map((theme: any, tIdx: number) => (
                    (() => {
                      const isThemeSelected =
                        selectedThemeFilter !== null &&
                        normalizeThemeKey(selectedThemeFilter) ===
                          normalizeThemeKey(theme.theme);

                      return (
                        <span
                          key={tIdx}
                          // Hover udalosti pobežia iba na PC. Na mobile to ignorujeme, aby neblikali
                          onMouseEnter={(e) => {
                            if (isMobile) return;
                            setThemeTooltip({
                              x: e.clientX,
                              y: e.clientY,
                              theme: theme.theme,
                              count: theme.count,
                              percentage: theme.percentage,
                            });
                          }}
                          onMouseMove={(e) => {
                            if (isMobile) return;
                            setThemeTooltip((prev) =>
                              prev ? { ...prev, x: e.clientX, y: e.clientY } : prev
                            );
                          }}
                          onMouseLeave={() => {
                            if (isMobile) return;
                            setThemeTooltip(null);
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedThemeFilter((prev) =>
                              prev && normalizeThemeKey(prev) === normalizeThemeKey(theme.theme)
                                ? null
                                : theme.theme
                            );
                            if (isMobile) {
                              setMobileSelectedTheme({
                                theme: theme.theme,
                                count: theme.count,
                                percentage: theme.percentage,
                              });
                            } else {
                              setThemeTooltip({
                                theme: theme.theme,
                                count: theme.count,
                                percentage: theme.percentage,
                                x: e.clientX,
                                y: e.clientY,
                              });
                            }
                          }}
                          className={`
                            inline-flex items-center rounded-xl px-3 py-1.5
                            font-black tracking-tight cursor-pointer md:cursor-help select-none transition-all
                            ${
                              isThemeSelected
                                ? 'text-white bg-brand shadow-lg'
                                : tIdx < 2
                                ? 'text-brand bg-brand/10'
                                : 'text-black bg-white shadow-sm'
                            }
                            ${getThemeFontSizeClass(theme.count, selectedQuestionMaxThemeCount)}
                            hover:scale-[1.03] active:scale-95
                          `}
                        >
                          {theme.theme}
                        </span>
                      );
                    })()
                  ))}
                </div>
                
                {/* Dynamická nápoveda */}
                <p className="text-[10px] font-bold uppercase tracking-widest text-black/35 mt-5 text-center sm:text-left">
                  Veľkosť témy zodpovedá frekvencii výskytu | témy slúžia ako filter pre výber odpovedí
                </p>
              </div>
            </div>
          )}

          <div className="bg-white p-6 sm:p-8 md:p-10 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-black/5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h5 className="text-[11px] font-black uppercase tracking-[0.2em] text-brand flex items-center gap-2">
                <MessageCircle className="w-4 h-4" /> Znenia otvorených odpovedí
              </h5>
              {selectedThemeFilter && (
                <button
                  type="button"
                  onClick={() => setSelectedThemeFilter(null)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black text-white text-[10px] font-black uppercase tracking-widest hover:bg-brand transition-colors w-fit"
                >
                  Zobraziť všetky témy
                </button>
              )}
            </div>

            <p className="mt-4 text-xs sm:text-sm font-bold text-black/45">
              Zobrazené odpovede: {filteredResponses.length} z {selectedQuestionResponses.length}
              {selectedThemeFilter ? (
                <span>
                  {' '}| Aktívny filter: <span className="text-brand">{selectedThemeFilter}</span>
                </span>
              ) : null}
            </p>

            {filteredResponses.length > 0 ? (
              <div className="mt-5 sm:mt-6 rounded-2xl border border-black/10 bg-black/[0.02] p-3 sm:p-4">
                <div className="max-h-[340px] sm:max-h-[440px] lg:max-h-[520px] overflow-y-auto pr-1 sm:pr-2 space-y-3 sm:space-y-4">
                  {filteredResponses.map((response: any, responseIndex: number) => (
                    <div
                      key={`${response.text}-${responseIndex}`}
                      className="bg-black/5 p-4 sm:p-5 rounded-2xl relative border border-black/5"
                    >
                      <Quote className="w-5 h-5 text-black/10 absolute top-4 left-4" />
                      <p className="text-sm sm:text-base font-medium text-black/85 italic pl-8 leading-relaxed break-words">
                        "{response.text}"
                      </p>
                      {response.theme ? (
                        <div className="mt-4 pl-8">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-white text-[10px] font-black uppercase tracking-widest text-black/55 border border-black/10">
                            Téma: {response.theme}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-5 sm:mt-6 bg-black/5 rounded-2xl p-5 sm:p-6 text-sm font-bold text-black/50">
                Pre vybranú tému nie sú dostupné odpovede.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-16 sm:py-20 bg-white rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-black/5 text-black/30 font-black uppercase tracking-widest text-xs sm:text-sm">
          Pre túto otázku a stredisko nie sú dostupné žiadne odpovede.
        </div>
      )}

      {/* Portál pre PC Tooltip - vykreslí sa len ak nie sme na mobile */}
      {!isMobile && themeTooltip && typeof document !== 'undefined' && createPortal(
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
