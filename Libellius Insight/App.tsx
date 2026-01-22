import React, { useState, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import Dashboard from './components/Dashboard';
import SatisfactionDashboard from './components/SatisfactionDashboard';
import { analyzeDocument, fileToBase64, parseExcelFile } from './services/geminiService';
import { AppStatus, FeedbackAnalysisResult, AnalysisMode } from './types';
import { AlertCircle, Key, BarChart3, Users, ChevronLeft, Sparkles, FileJson } from 'lucide-react';
import LZString from 'lz-string';

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.HOME);
  const [selectedMode, setSelectedMode] = useState<AnalysisMode | null>(null);
  const [result, setResult] = useState<FeedbackAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsKey, setNeedsKey] = useState<boolean>(false);

  useEffect(() => {
    const handleUrlData = () => {
      const hash = window.location.hash;
      if (hash && hash.startsWith('#report=')) {
        try {
          const compressedData = hash.replace('#report=', '');
          const decompressed = LZString.decompressFromEncodedURIComponent(compressedData);
          
          if (decompressed) {
            const jsonData = JSON.parse(decompressed);
            
            if (!jsonData.mode) {
              jsonData.mode = jsonData.satisfaction ? 'ZAMESTNANECKA_SPOKOJNOST' : '360_FEEDBACK';
            }

            setResult(jsonData);
            setStatus(AppStatus.SUCCESS);
          }
        } catch (err) {
          console.error(err);
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
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const jsonData = JSON.parse(e.target?.result as string);
          if (!jsonData.mode) {
            jsonData.mode = jsonData.satisfaction ? 'ZAMESTNANECKA_SPOKOJNOST' : '360_FEEDBACK';
          }
          setResult(jsonData);
          setStatus(AppStatus.SUCCESS);
        } catch (err) {
          setError("Chybný formát JSON súboru.");
          setStatus(AppStatus.ERROR);
        }
      };
      reader.readAsText(file);
      return;
    }

    if (!selectedMode) return;
    setStatus(AppStatus.ANALYZING);
    setError(null);

    try {
      const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv');
      let processedData: string;
      if (isExcel) {
        processedData = await parseExcelFile(file);
      } else {
        processedData = await fileToBase64(file);
      }

      const data = await analyzeDocument(processedData, selectedMode, isExcel);
      if (!data || (!data.employees && !data.satisfaction)) {
        throw new Error("Nepodarilo sa extrahovať štruktúrované dáta.");
      }

      setResult(data);
      setStatus(AppStatus.SUCCESS);
    } catch (err: any) {
      setError(err.message || "Nepodarilo sa spracovať dokument.");
      setStatus(AppStatus.ERROR);
    }
  };

  const handleReset = () => {
    window.location.hash = '';
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
        <button 
          onClick={handleOpenKeyDialog} 
          className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-[60] text-[10px] md:text-xs font-bold text-brand bg-white border border-brand/20 px-3 py-2 md:px-4 md:py-2 rounded-full flex items-center gap-2 shadow-xl hover:bg-brand/5"
        >
          <Key className="w-3 h-3 md:w-4 h-4" /> NASTAVIŤ API KĽÚČ
        </button>
      )}

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-12 md:py-20">
        {status === AppStatus.HOME && (
          <div className="flex flex-col items-center justify-center min-h-[70vh] text-center animate-fade-in">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-brand/5 text-brand rounded-full mb-6 md:mb-8 text-[10px] md:text-sm font-black tracking-widest uppercase">
              <Sparkles className="w-3 h-3 md:w-4 h-4" /> Next-gen Analytics
            </div>
            
            <h1 className="text-4xl md:text-7xl font-black mb-4 md:mb-6 leading-none tracking-tighter flex flex-col items-center uppercase">
              <span>Libellius</span>
              <span className="text-brand">InsightHub</span>
            </h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 w-full max-w-5xl px-2 mb-12">
              <button onClick={() => selectMode('360_FEEDBACK')} className="group p-10 border-2 border-black/5 rounded-[2.5rem] hover:border-black hover:bg-black/5 transition-all text-left relative overflow-hidden bg-[#f9f9f9]">
                <Users className="w-10 h-10 mb-6" />
                <span className="text-2xl md:text-3xl font-black block uppercase leading-tight">360° Spätná väzba</span>
                <div className="mt-6 px-8 py-3 bg-brand text-white rounded-full font-black text-xs uppercase tracking-widest">Spustiť analýzu</div>
              </button>
              
              <button onClick={() => selectMode('ZAMESTNANECKA_SPOKOJNOST')} className="group p-10 border-2 border-black/5 rounded-[2.5rem] hover:border-black hover:bg-black/5 transition-all text-left relative overflow-hidden bg-[#f9f9f9]">
                <BarChart3 className="w-10 h-10 mb-6" />
                <span className="text-2xl md:text-3xl font-black block uppercase leading-tight">Spokojnosť</span>
                <div className="mt-6 px-8 py-3 bg-black text-white rounded-full font-black text-xs uppercase tracking-widest">Spustiť analýzu</div>
              </button>
            </div>

            <label className="flex items-center gap-3 px-8 py-4 bg-black/5 hover:bg-black/10 rounded-2xl cursor-pointer transition-all group">
              <FileJson className="w-5 h-5 text-black/40 group-hover:text-brand transition-colors" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black/60">Nahrať existujúci .json report</span>
              <input type="file" accept=".json" className="hidden" onChange={(e) => e.target.files && handleFileSelect(e.target.files[0])} />
            </label>
          </div>
        )}

        {status === AppStatus.READY_TO_UPLOAD && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in px-4">
             <button onClick={handleBackToMode} className="mb-10 flex items-center gap-2 text-black/40 font-black uppercase tracking-widest text-[10px] hover:text-black">
               <ChevronLeft className="w-4 h-4" /> Späť
             </button>
             <FileUpload onFileSelect={handleFileSelect} isAnalyzing={false} mode={selectedMode} />
          </div>
        )}

        {status === AppStatus.ANALYZING && <FileUpload onFileSelect={() => {}} isAnalyzing={true} mode={selectedMode} />}

        {status === AppStatus.SUCCESS && result && (
          <div className="px-2 md:px-0">
            {result.mode === '360_FEEDBACK' ? 
              <Dashboard result={result} onReset={handleReset} /> : 
              <SatisfactionDashboard result={result} onReset={handleReset} />
            }
          </div>
        )}

        {status === AppStatus.ERROR && (
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
            <AlertCircle className="w-16 h-16 text-brand mb-6" />
            <h3 className="text-2xl font-black mb-2 uppercase tracking-tighter">Chyba</h3>
            <p className="text-black/50 mb-8 max-w-sm">{error}</p>
            <button onClick={handleReset} className="px-12 py-4 bg-black text-white rounded-full font-black uppercase tracking-widest text-xs">Skúsiť znova</button>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
