import React, { useState, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import Dashboard from './components/Dashboard';
import SatisfactionDashboard from './components/SatisfactionDashboard';
import { analyzeDocument, fileToBase64, parseExcelFile } from './services/geminiService';
import { AppStatus, FeedbackAnalysisResult, AnalysisMode } from './types';
import { AlertCircle, Key, BarChart3, Users, ChevronLeft, Sparkles } from 'lucide-react';
import LZString from 'lz-string';
import { decryptReportFromUrlPayload } from './utils/reportCrypto';

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.HOME);
  const [selectedMode, setSelectedMode] = useState<AnalysisMode | null>(null);
  const [result, setResult] = useState<FeedbackAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsKey, setNeedsKey] = useState<boolean>(false);

  const [pendingEncryptedPayload, setPendingEncryptedPayload] = useState<string | null>(null);
  const [sharePassword, setSharePassword] = useState<string>('');
  const [shareDecryptError, setShareDecryptError] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState<boolean>(false);

  const [showSharedGoodbye, setShowSharedGoodbye] = useState<boolean>(false);

  const [publicMeta, setPublicMeta] = useState<{
    client?: string;
    survey?: string;
    issued?: string;
  } | null>(null);

  useEffect(() => {
    const handleUrlData = () => {
      const hash = window.location.hash;

      if (hash && hash.startsWith('#report=')) {
        try {
          const raw = hash.slice(1); // remove '#'
          const params = new URLSearchParams(raw);

          const payload = params.get('report');
          const client = params.get('client');
          const survey = params.get('survey');
          const issued = params.get('issued');

          if (!payload) {
            throw new Error('Chýba payload reportu.');
          }

          setPublicMeta({
            client: client || undefined,
            survey: survey || undefined,
            issued: issued || undefined,
          });

          if (payload.startsWith('v1.')) {
            setPendingEncryptedPayload(payload);
            setShareDecryptError(null);
            setSharePassword('');
            setResult(null);
            setShowSharedGoodbye(false);
            setStatus(AppStatus.HOME);
            return;
          }

          const decompressed = LZString.decompressFromEncodedURIComponent(payload);
          if (decompressed) {
            const jsonData = JSON.parse(decompressed);
            if (!jsonData.mode) {
              jsonData.mode = jsonData.satisfaction ? 'ZAMESTNANECKA_SPOKOJNOST' : '360_FEEDBACK';
            }
            setResult(jsonData);
            setPendingEncryptedPayload(null);
            setShowSharedGoodbye(false);
            setStatus(AppStatus.SUCCESS);
            return;
          }

          throw new Error('Neplatný link reportu.');
        } catch (e) {
          console.error('Chyba linku', e);
          setShareDecryptError('Link reportu sa nepodarilo načítať.');
          setPendingEncryptedPayload(null);
          setShowSharedGoodbye(false);
          setPublicMeta(null);
        }
      }
    };

    handleUrlData();
    window.addEventListener('hashchange', handleUrlData);

    const checkKey = async () => {
      const aistudio = (window as any).aistudio;
      if (aistudio) {
        try {
          const hasKey = await aistudio.hasSelectedApiKey();
          if (!hasKey) setNeedsKey(true);
        } catch (e) {
          console.debug(e);
        }
      }
    };

    checkKey();

    return () => window.removeEventListener('hashchange', handleUrlData);
  }, []);

  const handleOpenKeyDialog = async () => {
    const aistudio = (window as any).aistudio;
    if (aistudio) {
      await aistudio.openSelectKey();
      setNeedsKey(false);
    }
  };

  const handleDecryptSharedReport = async () => {
    if (!pendingEncryptedPayload) return;

    setIsDecrypting(true);
    setShareDecryptError(null);

    try {
      const jsonData: any = await decryptReportFromUrlPayload(
        pendingEncryptedPayload,
        sharePassword.trim()
      );

      if (!jsonData.mode) {
        jsonData.mode = jsonData.satisfaction ? 'ZAMESTNANECKA_SPOKOJNOST' : '360_FEEDBACK';
      }

      setResult(jsonData);
      setPendingEncryptedPayload(null);
      setShowSharedGoodbye(false);
      setStatus(AppStatus.SUCCESS);
    } catch (err: any) {
      setShareDecryptError(err?.message || 'Nepodarilo sa odomknúť report.');
    } finally {
      setIsDecrypting(false);
    }
  };

  const selectMode = (mode: AnalysisMode) => {
    setShowSharedGoodbye(false);
    setSelectedMode(mode);
    setStatus(AppStatus.READY_TO_UPLOAD);
  };

  const handleFileSelect = async (file: File) => {
    if (!selectedMode) return;
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const jsonData = JSON.parse(e.target?.result as string);
          setShowSharedGoodbye(false);
          setResult(jsonData);
          setStatus(AppStatus.SUCCESS);
        } catch {
          setError('Chybný formát JSON.');
          setStatus(AppStatus.ERROR);
        }
      };
      reader.readAsText(file);
      return;
    }

    setStatus(AppStatus.ANALYZING);
    setError(null);

    try {
      const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv');
      const processedData = isExcel ? await parseExcelFile(file) : await fileToBase64(file);
      const data = await analyzeDocument(processedData, selectedMode, isExcel);

      if (!data || (!data.employees && !data.satisfaction)) {
        throw new Error('Nepodarilo sa extrahovať dáta.');
      }

      setShowSharedGoodbye(false);
      setResult(data);
      setStatus(AppStatus.SUCCESS);
    } catch (err: any) {
      setError(err.message || 'Chyba spracovania.');
      setStatus(AppStatus.ERROR);
    }
  };

  const handleReset = () => {
    const isSharedLink = typeof window !== 'undefined' && window.location.hash.startsWith('#report=');

    window.location.hash = '';
    setResult(null);
    setSelectedMode(null);
    setError(null);

    setPendingEncryptedPayload(null);
    setSharePassword('');
    setShareDecryptError(null);
    setIsDecrypting(false);
    setPublicMeta(null);

    if (isSharedLink) {
      setShowSharedGoodbye(true);
      setStatus(AppStatus.HOME);
      return;
    }

    setShowSharedGoodbye(false);
    setStatus(AppStatus.HOME);
  };

  const handleBackToMode = () => {
    setShowSharedGoodbye(false);
    setStatus(AppStatus.HOME);
    setSelectedMode(null);
  };

  return (
    <div className="min-h-screen bg-white text-black font-sans relative flex flex-col">
      {needsKey && (
        <button
          onClick={handleOpenKeyDialog}
          className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-[60] text-[10px] md:text-xs font-bold text-brand bg-white border border-brand/20 px-3 py-2 md:px-4 md:py-2 rounded-full flex items-center gap-2 shadow-xl hover:bg-brand/5"
        >
          <Key className="w-3 h-3 md:w-4 md:h-4" /> NASTAVIŤ API KĽÚČ
        </button>
      )}

      <main className="w-full max-w-[1440px] xl:max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 flex-grow flex flex-col">
        {showSharedGoodbye && (
          <div className="flex flex-col items-center justify-center flex-grow text-center animate-fade-in px-4">
            <div className="w-full max-w-6xl bg-white border border-black/5 rounded-[2rem] shadow-2xl p-8 sm:p-10 md:p-14 lg:p-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-brand/5 text-brand rounded-full mb-6 md:mb-8 text-xs md:text-sm font-black tracking-widest uppercase">
                ĎAKUJEME ZA VYUŽITIE LIBELLIUS INSIGHTHUB
              </div>

              <h2 className="text-[clamp(2rem,5vw,4rem)] font-black tracking-tight leading-[1.2] md:leading-[1.18] mb-8 md:mb-10 max-w-5xl mx-auto">
                Veríme, že vizualizácia dát Vám priniesla jasnejší pohľad na ďalšie rozhodnutia.
              </h2>

              <p className="text-[clamp(1rem,2vw,1.3rem)] text-black/50 font-semibold leading-relaxed max-w-4xl mx-auto">
                Ak budete potrebovať znovu otvoriť prehľad, použite zdieľaný odkaz.
              </p>
            </div>
          </div>
        )}

        {pendingEncryptedPayload && status !== AppStatus.SUCCESS && (
  <div className="flex flex-col min-h-[calc(100vh-120px)]">
    <div className="flex flex-col items-center justify-center flex-grow text-center animate-fade-in px-4 py-6 md:py-10">
      <div className="w-full max-w-5xl bg-white border border-black/5 rounded-[2rem] shadow-2xl px-6 sm:px-10 md:px-14 py-8 sm:py-10 md:py-12">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-brand/5 text-brand rounded-full mb-6 text-xs font-black tracking-widest uppercase">
          <Key className="w-3 h-3" /> Chránený report
        </div>

        <h1 className="text-sm sm:text-base font-black uppercase tracking-[0.24em] text-black/40 mb-5">
          Libellius <span className="text-brand">InsightHub</span>
        </h1>

        <h2 className="text-[clamp(2rem,4vw,3.4rem)] font-black tracking-tight leading-[1.12] mb-8 md:mb-10">
          Tento report je chránený heslom
        </h2>

        {publicMeta && (
          <div className="mb-6 md:mb-10 text-left bg-black/5 border border-black/5 rounded-3xl px-6 py-5 md:px-7 md:py-6 max-w-4xl mx-auto">
            {publicMeta.client && (
              <p className="text-lg md:text-xl font-black text-black leading-tight">
                Klient <span className="text-brand">{publicMeta.client}</span>
              </p>
            )}

            {publicMeta.survey && (
              <p className="text-base md:text-lg font-semibold text-black/70 mt-3 leading-snug">
                Report {publicMeta.survey}
              </p>
            )}

            {publicMeta.issued && (
              <p className="text-xs md:text-sm font-black uppercase tracking-[0.18em] text-black/40 mt-4">
                Vydané {publicMeta.issued}
              </p>
            )}
          </div>
        )}

        <div className="space-y-4 text-left max-w-4xl mx-auto">
          <input
            type="password"
            value={sharePassword}
            onChange={(e) => setSharePassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleDecryptSharedReport();
            }}
            placeholder="Zadajte heslo"
            className="w-full px-5 py-4 md:px-6 md:py-5 bg-black/5 border border-black/5 rounded-2xl outline-none focus:ring-2 focus:ring-brand/30 text-lg"
          />

          {shareDecryptError && (
            <p className="text-sm font-bold text-brand">{shareDecryptError}</p>
          )}

          <div className="flex flex-col sm:flex-row gap-4 pt-2">
            <button
              onClick={handleDecryptSharedReport}
              disabled={isDecrypting || !sharePassword.trim()}
              className="flex-1 px-6 py-4 bg-black text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-brand transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDecrypting ? 'Odomykám...' : 'Odomknúť report'}
            </button>

            <button
              onClick={() => {
                window.location.hash = '';
                setPendingEncryptedPayload(null);
                setSharePassword('');
                setShareDecryptError(null);
                setPublicMeta(null);
                setStatus(AppStatus.HOME);
              }}
              className="px-6 py-4 bg-black/5 text-black rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-black/10 transition-all min-w-[170px]"
            >
              Zrušiť
            </button>
          </div>
        </div>
      </div>
    </div>

    <div className="w-full max-w-5xl mx-auto mt-auto pt-10 border-t border-black/10 flex flex-col md:flex-row justify-between items-center gap-6 text-black/40 pb-4 px-4 md:px-0 animate-fade-in">
      <div className="flex items-center gap-4">
        <img
          src="/logo.png"
          alt="Libellius"
          className="h-16 md:h-20 w-auto object-contain opacity-80"
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
)}

        {!pendingEncryptedPayload && status === AppStatus.HOME && !showSharedGoodbye && (
          <div className="flex flex-col items-center justify-center flex-grow text-center animate-fade-in">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-brand/5 text-brand rounded-full mb-6 md:mb-8 text-[10px] md:text-sm font-black tracking-widest uppercase">
              <Sparkles className="w-3 h-3 md:w-4 md:h-4" /> Next-gen Analytics
            </div>

            <div className="w-full max-w-[360px] sm:max-w-3xl mx-auto px-2">
              <h1 className="text-center font-black tracking-tight leading-[0.95]">
                <span className="block text-[clamp(2rem,8vw,4.25rem)] text-black">
                  Vitajte v
                </span>

                <span className="mt-1 flex flex-wrap justify-center items-baseline gap-x-2 sm:gap-x-3">
                  <span className="uppercase text-black text-[clamp(2.2rem,9vw,4.8rem)]">
                    Libellius
                  </span>
                  <span className="uppercase text-brand text-[clamp(2.2rem,9vw,4.8rem)]">
                    InsightHub
                  </span>
                </span>
              </h1>
            </div>

            <p className="text-base sm:text-lg md:text-2xl text-black/50 mb-10 md:mb-16 mt-6 md:mt-8 max-w-2xl font-medium px-4 leading-relaxed">
              PREHĽADNÁ VIZUALIZÁCIA VAŠICH VÝSLEDKOV.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 w-full max-w-5xl px-0 sm:px-2">
              <div
                className="group p-6 sm:p-8 md:p-10 border-2 border-black/5 rounded-[2rem] md:rounded-[2.5rem] text-left flex flex-col items-start gap-5 md:gap-6 shadow-xl shadow-black/5 relative overflow-hidden bg-[#f9f9f9] opacity-85 cursor-not-allowed"
                aria-disabled="true"
              >
                <div className="absolute top-0 right-0 p-6 md:p-8 opacity-5 pointer-events-none">
                  <Users className="w-24 h-24 md:w-32 md:h-32 text-black" />
                </div>

                <div className="p-4 md:p-5 bg-black text-white rounded-[1.5rem] md:rounded-[2rem] shadow-lg">
                  <Users className="w-8 h-8 md:w-10 md:h-10" />
                </div>

                <div className="z-10">
                  <span className="text-[28px] sm:text-[30px] md:text-[32px] font-black block mb-3 md:mb-4 tracking-tight uppercase leading-tight">
                    Analýza 360° spätnej väzby
                  </span>
                  <p className="text-black/50 font-bold text-base md:text-lg leading-relaxed max-w-md">
                    Vidieť rozdiely. Pochopiť súvislosti. Rozvíjať potenciál.
                  </p>
                </div>

                <div className="z-10 mt-2 md:mt-4 w-full sm:w-auto px-6 sm:px-8 md:px-10 py-3.5 md:py-4 bg-black/10 text-black/40 rounded-full font-black text-xs sm:text-sm uppercase tracking-widest text-center border border-black/10">
                  PRIPRAVUJEME
                </div>
              </div>

              <button
                onClick={() => selectMode('ZAMESTNANECKA_SPOKOJNOST')}
                className="group p-6 sm:p-8 md:p-10 border-2 border-black/5 rounded-[2rem] md:rounded-[2.5rem] hover:border-black hover:bg-black/5 transition-all text-left flex flex-col items-start gap-5 md:gap-6 shadow-xl shadow-black/5 relative overflow-hidden bg-[#f9f9f9]"
              >
                <div className="absolute top-0 right-0 p-6 md:p-8 opacity-5 group-hover:opacity-10 pointer-events-none">
                  <BarChart3 className="w-24 h-24 md:w-32 md:h-32 text-black" />
                </div>

                <div className="p-4 md:p-5 bg-black text-white rounded-[1.5rem] md:rounded-[2rem] shadow-lg">
                  <BarChart3 className="w-8 h-8 md:w-10 md:h-10" />
                </div>

                <div className="z-10">
                  <span className="text-[28px] sm:text-[30px] md:text-[32px] font-black block mb-3 md:mb-4 tracking-tight uppercase leading-tight">
                    Analýza spokojnosti zamestnancov
                  </span>
                  <p className="text-black/50 font-bold text-base md:text-lg leading-relaxed max-w-md">
                    Vidieť nálady. Pochopiť súvislosti. Zlepšovať prostredie.
                  </p>
                </div>

                <div className="z-10 mt-2 md:mt-4 w-full sm:w-auto px-6 sm:px-8 md:px-10 py-3.5 md:py-4 bg-brand text-white rounded-full font-black text-xs sm:text-sm uppercase tracking-widest shadow-lg transform active:scale-95 transition-all text-center">
                  VYBRAŤ TENTO MÓD
                </div>
              </button>
            </div>
          </div>
        )}

        {status === AppStatus.READY_TO_UPLOAD && !showSharedGoodbye && (
          <div className="flex flex-col items-center justify-center flex-grow animate-fade-in px-4">
            <button
              onClick={handleBackToMode}
              className="mb-10 flex items-center gap-2 text-black/40 font-black uppercase tracking-widest text-xs hover:text-black transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Späť na výber módu
            </button>
            <FileUpload onFileSelect={handleFileSelect} isAnalyzing={false} mode={selectedMode} />
          </div>
        )}

        {status === AppStatus.ANALYZING && !showSharedGoodbye && (
          <div className="flex flex-col items-center justify-center flex-grow">
            <FileUpload onFileSelect={() => {}} isAnalyzing={true} mode={selectedMode} />
          </div>
        )}

        {status === AppStatus.SUCCESS && result && !showSharedGoodbye && (
          <div className="w-full">
            {result.mode === '360_FEEDBACK' ? (
              <Dashboard result={result} onReset={handleReset} />
            ) : (
              <SatisfactionDashboard result={result} onReset={handleReset} />
            )}
          </div>
        )}

        {status === AppStatus.ERROR && !showSharedGoodbye && (
          <div className="flex flex-col items-center justify-center flex-grow gap-6 text-center px-6">
            <AlertCircle className="w-20 h-20 text-brand" />
            <h3 className="text-3xl font-black uppercase tracking-tighter">Chyba analýzy</h3>
            <p className="text-black/50 font-medium max-w-md">{error}</p>
            <button
              onClick={handleReset}
              className="px-12 py-4 bg-black text-white rounded-full font-bold uppercase tracking-widest text-sm"
            >
              Skúsiť znova
            </button>
          </div>
        )}

        {status !== AppStatus.SUCCESS && !pendingEncryptedPayload && !showSharedGoodbye && (
          <div className="w-full max-w-5xl mx-auto mt-auto pt-16 border-t border-black/10 flex flex-col md:flex-row justify-between items-center gap-6 text-black/40 pb-4 px-4 md:px-0 animate-fade-in">
            <div className="flex items-center gap-4">
              <img
                src="/logo.png"
                alt="Libellius"
                className="h-20 md:h-24 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity"
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
        )}
      </main>
    </div>
  );
};

export default App;
