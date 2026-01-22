import React, { useState, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import Dashboard from './components/Dashboard';
import SatisfactionDashboard from './components/SatisfactionDashboard';
import { analyzeDocument, fileToBase64, parseExcelFile } from './services/geminiService';
import { AppStatus, FeedbackAnalysisResult, AnalysisMode } from './types';
import { AlertCircle, Key, BarChart3, Users, ChevronLeft, Sparkles } from 'lucide-react';
// Potrebný import pre dekompresiu linku
import LZString from 'lz-string';

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.HOME);
  const [selectedMode, setSelectedMode] = useState<AnalysisMode | null>(null);
  const [result, setResult] = useState<FeedbackAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsKey, setNeedsKey] = useState<boolean>(false);

  // --- RADAR: Ticho sleduje link v prehliadači ---
  useEffect(() => {
    const handleUrlData = () => {
      const hash = window.location.hash;
      if (hash && hash.startsWith('#report=')) {
        try {
          const compressed = hash.replace('#report=', '');
          const decompressed = LZString.decompressFromEncodedURIComponent(compressed);
          if (decompressed) {
            const jsonData = JSON.parse(decompressed);
            // Poistka pre mód
            if (!jsonData.mode) {
              jsonData.mode = jsonData.satisfaction ? 'ZAMESTNANECKA_SPOKOJNOST' : '360_FEEDBACK';
            }
            setResult(jsonData);
            setStatus(AppStatus.SUCCESS);
          }
        } catch (e) { console.error("Chyba linku", e); }
      }
    };

    handleUrlData();
    window.addEventListener('hashchange', handleUrlData);
    
    // Pôvodná kontrola kľúča
    const checkKey = async () => {
      const aistudio = (window as any).aistudio;
      if (aistudio) {
        try {
          const hasKey = await aistudio.hasSelectedApiKey();
          if (!hasKey) setNeedsKey(true);
        } catch (e) { console.debug(e); }
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

  const selectMode = (mode: AnalysisMode) => {
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
          setResult(jsonData);
          setStatus(AppStatus.SUCCESS);
        } catch (err) {
          setError("Chybný formát JSON.");
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
      let processedData = isExcel ? await parseExcelFile(file) : await fileToBase64(file);
      const data = await analyzeDocument(processedData, selectedMode, isExcel);
      
      if (!data || (!data.employees && !data.satisfaction)) {
        throw new Error("Nepodarilo sa extrahovať dáta.");
      }

      setResult(data);
      setStatus(AppStatus.SUCCESS);
    } catch (err: any) {
      setError(err.message || "Chyba spracovania.");
      setStatus(AppStatus.ERROR);
    }
  };

  const handleReset = () => {
    window.location.hash = ''; // Vyčistíme link pri resete
    setStatus(AppStatus.HOME);
    setResult(null);
    setSelectedMode(null);
    setError(null);
  };

  const handleBackToMode = () => {
    setStatus(AppStatus.HOME);
    setSelectedMode(null);
  };

  return (
    <div className="min-h-screen bg-white text-black font-sans relative">
      {needsKey && (
        <button onClick={handleOpenKeyDialog} className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-[60] text-[10px] md:text-xs font-bold text-brand bg-white border border-brand/20 px-3 py-2 md:px-4 md:py-2 rounded-full flex items-center gap-2 shadow-xl hover:bg-brand/5">
          <Key className="w-3 h-3 md:w-4 h-4" /> NASTAVIŤ API KĽÚČ
        </button>
      )}

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-12 md:py-20">
        {status === AppStatus.HOME && (
          <div className="flex flex-col items-center justify-center min-h-[70vh] text-center animate-fade-in">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-brand/5 text-brand rounded-full mb-8 text-[10px] md:text-sm font-black tracking-widest uppercase">
              <Sparkles className="w-3 h-3 md:w-4 h-4" /> Next-gen Analytics
            </div>
            
            <h1 className="text-4xl md:text-7xl font-black mb-6 leading-none tracking-tighter flex flex-col items-center">
              <span className="mb-2">Vitajte v</span>
              <span className="flex items-center gap-4 uppercase tracking-tighter">
                <span className="text-black">Libellius</span>
                <span className="text-brand">InsightHub</span>
              </span>
            </h1>
            
            <p className="text-lg md:text-2xl text-black/50 mb-16 max-w-2xl font-medium px-4">
              Vizualizujte výsledky. Jasne. Prehľadne.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 w-full max-w-5xl px-2">
              <button onClick={() => selectMode('360_FEEDBACK')} className="group p-10 border-2 border-black/5 rounded-[2.5rem] hover:border-black hover:bg-black/5 transition-all text-left flex flex-col items-start gap-6 shadow-xl shadow-black/5 relative overflow-hidden bg-[#f9f9f9]">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 pointer-events-none">
                  <Users className="w-32 h-32 text-black" />
                </div>
                <div className="p-5 bg-black text-white rounded-[2rem] shadow-lg"><Users className="w-10 h-10" /></div>
                <div className="z-10">
                  <span className="text-[32px] font-black block mb-4 tracking-tight uppercase leading-tight">Analýza 360° spätnej väzby</span>
                  <p className="text-black/50 font-bold text-lg leading-relaxed max-w-xs">Vidieť rozdiely. Pochopiť súvislosti. Rozvíjať potenciál.</p>
                </div>
                <div className="z-10 mt-4 px-10 py-4 bg-brand text-white rounded-full font-black text-sm uppercase tracking-widest shadow-lg transform active:scale-95 transition-all">VYBRAŤ TENTO MÓD</div>
              </button>
              
              <button onClick={() => selectMode('ZAMESTNANECKA_SPOKOJNOST')} className="group p-10 border-2 border-black/5 rounded-[2.5rem] hover:border-black hover:bg-black/5 transition-all text-left flex flex-col items-start gap-6 shadow-xl shadow-black/5 relative overflow-hidden bg-[#f9f9f9]">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 pointer-events-none"><BarChart3 className="w-32 h-32 text-black" /></div>
                <div className="p-5 bg-black text-white rounded-[2rem] shadow-lg"><BarChart3 className="w-10 h-10" /></div>
                <div className="z-10">
                  <span className="text-[32px] font-black block mb-4 tracking-tight uppercase leading-tight">Analýza spokojnosti zamestnancov</span>
                  <p className="text-black/50 font-bold text-lg leading-relaxed max-w-xs">Vidieť nálady. Pochopiť súvislosti. Zlepšovať prostredie.</p>
                </div>
                <div className="z-10 mt-4 px-10 py-4 bg-brand text-white rounded-full font-black text-sm uppercase tracking-widest shadow-lg transform active:scale-95 transition-all">VYBRAŤ TENTO MÓD</div>
              </button>
            </div>
          </div>
        )}

        {status === AppStatus.READY_TO_UPLOAD && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in px-4">
             <button onClick={handleBackToMode} className="mb-10 flex items-center gap-2 text-black/40 font-black uppercase tracking-widest text-xs hover:text-black transition-colors">
               <ChevronLeft className="w-4 h-4" /> Späť na výber módu
             </button>
             <FileUpload onFileSelect={handleFileSelect} isAnalyzing={false} mode={selectedMode} />
          </div>
        )}

        {status === AppStatus.ANALYZING && <div className="flex flex-col items-center justify-center min-h-[60vh]"><FileUpload onFileSelect={() => {}} isAnalyzing={true} mode={selectedMode} /></div>}

        {status === AppStatus.SUCCESS && result && (
          <div className="px-2 md:px-0">
            {result.mode === '360_FEEDBACK' ? <Dashboard result={result} onReset={handleReset} /> : <SatisfactionDashboard result={result} onReset={handleReset} />}
          </div>
        )}

        {status === AppStatus.ERROR && (
          <div className="flex flex-col items-center justify-center min-h-[40vh] gap-6 text-center px-6">
            <AlertCircle className="w-20 h-20 text-brand" />
            <h3 className="text-3xl font-black uppercase tracking-tighter">Chyba analýzy</h3>
            <p className="text-black/50 font-medium max-w-md">{error}</p>
            <button onClick={handleReset} className="px-12 py-4 bg-black text-white rounded-full font-bold uppercase tracking-widest text-sm">Skúsiť znova</button>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
