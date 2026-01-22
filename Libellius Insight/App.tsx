import React, { useState, useEffect } from 'react'; 
import FileUpload from './components/FileUpload'; 
import Dashboard from './components/Dashboard'; 
import SatisfactionDashboard from './components/SatisfactionDashboard'; 
// Pridaný import parseExcelFile 
import { analyzeDocument, fileToBase64, parseExcelFile } from './services/geminiService'; 
import { AppStatus, FeedbackAnalysisResult, AnalysisMode } from './types'; 
import { AlertCircle, Key, BarChart3, Users, ChevronLeft, Sparkles } from 'lucide-react'; 

const App: React.FC = () => { 
  const [status, setStatus] = useState<AppStatus>(AppStatus.HOME); 
  const [selectedMode, setSelectedMode] = useState<AnalysisMode | null>(null); 
  const [result, setResult] = useState<FeedbackAnalysisResult | null>(null); 
  const [error, setError] = useState<string | null>(null); 
  const [needsKey, setNeedsKey] = useState<boolean>(false); 

  useEffect(() => { 
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

    // 1. ŠPECIÁLNY PRÍPAD: Ak klient nahrá vopred analyzovaný JSON 
    if (fileName.endsWith('.json')) { 
      const reader = new FileReader(); 
      reader.onload = (e) => { 
        try { 
          const jsonData = JSON.parse(e.target?.result as string); 
          setResult(jsonData); 
          setStatus(AppStatus.SUCCESS); 
        } catch (err) { 
          setError("Chybný formát JSON súboru. Uistite sa, že nahrávate platný export."); 
          setStatus(AppStatus.ERROR); 
        } 
      }; 
      reader.readAsText(file); 
      return; 
    } 

    setStatus(AppStatus.ANALYZING); 
    setError(null); 

    try { 
      // 2. Zistíme, či ide o Excel alebo CSV súbor 
      const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv'); 
        
      let processedData: string; 

      // 3. Spracujeme dáta: Excel/CSV na text, PDF na Base64 
      if (isExcel) { 
        processedData = await parseExcelFile(file); 
      } else { 
        processedData = await fileToBase64(file); 
      } 

      // 4. Odošleme na analýzu 
      const data = await analyzeDocument(processedData, selectedMode, isExcel); 
        
      // Základná validácia dát 
      if (!data || (!data.employees && !data.satisfaction)) { 
        throw new Error("Nepodarilo sa extrahovať štruktúrované dáta z dokumentu."); 
      } 

      setResult(data); 
      setStatus(AppStatus.SUCCESS); 
    } catch (err: any) { 
      console.error(err); 
      if (err.message === "AUTH_ERROR") { 
        setError("Chyba autorizácie. Prosím, skontrolujte svoj API kľúč."); 
        setNeedsKey(true); 
      } else { 
        setError(err.message || "Nepodarilo sa spracovať dokument. Skontrolujte formát súboru."); 
      } 
      setStatus(AppStatus.ERROR); 
    } 
  }; 

  const handleReset = () => { 
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
      {/* Floating button for API key */} 
      {needsKey && ( 
        <button  
          onClick={handleOpenKeyDialog}  
          className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-[60] text-[10px] md:text-xs font-bold text-brand bg-white border border-brand/20 px-3 py-2 md:px-4 md:py-2 rounded-full flex items-center gap-2 shadow-xl hover:bg-brand/5 transition-all" 
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
              
            <h1 className="text-4xl md:text-7xl font-black mb-4 md:mb-6 leading-none tracking-tighter flex flex-col items-center"> 
              <span className="mb-1 md:mb-2">Vitajte v</span> 
              <span className="flex items-center gap-2 md:gap-4 scale-90 md:scale-100 uppercase tracking-tighter"> 
                <span className="text-black">Libellius</span> 
                <span className="text-brand">InsightHub</span> 
              </span> 
            </h1> 
              
            <p className="text-lg md:text-2xl text-black/50 mb-10 md:mb-16 max-w-2xl font-medium leading-relaxed px-4"> 
              Vizualizujte výsledky. Jasne. Prehľadne. 
            </p> 
              
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 w-full max-w-5xl px-2"> 
              <button  
                onClick={() => selectMode('360_FEEDBACK')} 
                className="group p-6 md:p-10 border-2 border-black/5 rounded-[2rem] md:rounded-[2.5rem] hover:border-black hover:bg-black/5 transition-all text-left flex flex-col items-start gap-4 md:gap-6 shadow-xl shadow-black/5 relative overflow-hidden bg-[#f9f9f9]" 
              > 
                <div className="absolute -top-4 -right-4 md:top-0 md:right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none"> 
                  <Users className="w-24 h-24 md:w-32 h-32 text-black" /> 
                </div> 
                <div className="p-4 md:p-5 bg-black text-white rounded-[1.5rem] md:rounded-[2rem] group-hover:scale-105 transition-transform shadow-lg"> 
                  <Users className="w-6 h-6 md:w-10 h-10" /> 
                </div> 
                <div className="z-10"> 
                  <span className="text-2xl md:text-[32px] font-black block mb-2 md:mb-4 tracking-tight uppercase leading-tight">Analýza 360° spätnej väzby</span> 
                  <p className="text-black/50 font-bold text-sm md:text-lg leading-relaxed max-w-[240px] md:max-w-xs">Vidieť rozdiely. Pochopiť súvislosti. Rozvíjať potenciál.</p> 
                </div> 
                <div className="z-10 mt-2 md:mt-4 px-6 md:px-10 py-3 md:py-4 bg-brand text-white rounded-full font-black text-[10px] md:text-sm uppercase tracking-widest shadow-lg transform active:scale-95 transition-all"> 
                  VYBRAŤ TENTO MÓD 
                </div> 
              </button> 
                
              <button  
                onClick={() => selectMode('ZAMESTNANECKA_SPOKOJNOST')} 
                className="group p-6 md:p-10 border-2 border-black/5 rounded-[2rem] md:rounded-[2.5rem] hover:border-black hover:bg-black/5 transition-all text-left flex flex-col items-start gap-4 md:gap-6 shadow-xl shadow-black/5 relative overflow-hidden bg-[#f9f9f9]" 
              > 
                 <div className="absolute -top-4 -right-4 md:top-0 md:right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none"> 
                  <BarChart3 className="w-24 h-24 md:w-32 h-32 text-black" /> 
                </div> 
                <div className="p-4 md:p-5 bg-black text-white rounded-[1.5rem] md:rounded-[2rem] group-hover:scale-105 transition-transform shadow-lg"> 
                  <BarChart3 className="w-6 h-6 md:w-10 h-10" /> 
                </div> 
                <div className="z-10"> 
                  <span className="text-2xl md:text-[32px] font-black block mb-2 md:mb-4 tracking-tight uppercase leading-tight">Analýza spokojnosti zamestnancov</span> 
                  <p className="text-black/50 font-bold text-sm md:text-lg leading-relaxed max-w-[240px] md:max-w-xs">Vidieť nálady. Pochopiť súvislosti. Zlepšovať prostredie.</p> 
                </div> 
                <div className="z-10 mt-2 md:mt-4 px-6 md:px-10 py-3 md:py-4 bg-brand text-white rounded-full font-black text-[10px] md:text-sm uppercase tracking-widest shadow-lg transform active:scale-95 transition-all"> 
                  VYBRAŤ TENTO MÓD 
                </div> 
              </button> 
            </div> 
          </div> 
        )} 

        {status === AppStatus.READY_TO_UPLOAD && ( 
          <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in px-4"> 
             <button  
               onClick={handleBackToMode} 
               className="mb-6 md:mb-10 flex items-center gap-2 text-black/40 font-black uppercase tracking-widest text-[10px] md:text-xs hover:text-black transition-colors" 
             > 
               <ChevronLeft className="w-3 h-3 md:w-4 h-4" /> Späť na výber módu 
             </button> 
             
             <div className="text-center mb-8 md:mb-12"> 
                <span className={`px-4 py-2 rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest mb-4 inline-block ${selectedMode === '360_FEEDBACK' ? 'bg-brand/10 text-brand' : 'bg-black text-white'}`}> 
                  {selectedMode === '360_FEEDBACK' ? 'Mód: 360° Spätná väzba' : 'Mód: Analýza Spokojnosti'} 
                </span> 
             </div> 

             <FileUpload onFileSelect={handleFileSelect} isAnalyzing={false} mode={selectedMode} /> 
          </div> 
        )} 

        {status === AppStatus.ANALYZING && ( 
          <div className="flex flex-col items-center justify-center min-h-[60vh] px-4"> 
            <FileUpload onFileSelect={() => {}} isAnalyzing={true} mode={selectedMode} /> 
          </div> 
        )} 

        {status === AppStatus.SUCCESS && result && ( 
          <div className="px-2 md:px-0"> 
            {result.mode === '360_FEEDBACK' ?  
              <Dashboard result={result} onReset={handleReset} /> :  
              <SatisfactionDashboard result={result} onReset={handleReset} /> 
            } 
          </div> 
        )} 

        {status === AppStatus.ERROR && ( 
          <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 md:gap-6 text-center px-6"> 
            <AlertCircle className="w-16 h-16 md:w-20 h-20 text-brand" /> 
            <div> 
              <h3 className="text-2xl md:text-3xl font-black mb-2 uppercase tracking-tighter">Chyba analýzy</h3> 
              <p className="text-black/50 font-medium max-w-md text-sm md:text-base">{error}</p> 
            </div> 
            <button onClick={handleReset} className="px-10 py-3 md:px-12 md:py-4 bg-black text-white rounded-full font-bold hover:bg-brand transition-colors text-sm md:text-base uppercase tracking-widest">Skúsiť znova</button> 
          </div> 
        )} 
      </main> 
    </div> 
  ); 
}; 

export default App;
