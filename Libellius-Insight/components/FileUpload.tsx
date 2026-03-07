import React, { useCallback } from 'react';
import { UploadCloud } from 'lucide-react';
import { AnalysisMode } from '../types';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isAnalyzing: boolean;
  mode?: AnalysisMode | null;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, isAnalyzing, mode }) => {
  // Funkcia na kontrolu, či je súbor podporovaný
  const isSupportedFile = (file: File) => {
    const supportedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'application/json' // .json
    ];
    const extension = file.name.split('.').pop()?.toLowerCase();
    return supportedTypes.includes(file.type) || 
           ['xlsx', 'xls', 'pdf', 'json', 'csv'].includes(extension || '');
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (isAnalyzing) return;
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (isSupportedFile(file)) {
        onFileSelect(file);
      } else {
        alert("Prosím nahrajte iba podporované súbory (PDF, Excel alebo JSON report).");
      }
    }
  }, [onFileSelect, isAnalyzing]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isAnalyzing) return;
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  const getLabels = () => {
    if (mode === 'ZAMESTNANECKA_SPOKOJNOST') {
      return {
        title: 'Nahrajte dáta (Excel/PDF) alebo hotový JSON report',
        description: 'Pre analýzu vložte Excel. Pre zobrazenie výsledku vložte JSON.'
      };
    }
    return {
      title: 'Nahrajte výsledky z 360° Spätnej väzby',
      description: 'Podporujeme PDF, Excel aj vopred analyzované JSON formáty.'
    };
  };

  const labels = getLabels();

  return (
    <div 
      className={`w-full max-w-4xl mx-auto p-8 md:p-20 border-[2px] md:border-[3px] border-dashed rounded-[2rem] md:rounded-[3rem] transition-all duration-500 flex flex-col items-center justify-center text-center bg-white
        ${isAnalyzing ? 'border-brand/10 bg-brand/[0.02] cursor-wait' : 'border-brand/40 hover:border-brand hover:shadow-2xl hover:shadow-brand/10 cursor-pointer'}
      `}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <input 
        type="file" 
        accept=".pdf,.xlsx,.xls,.csv,.json,application/pdf,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" 
        className="hidden" 
        id="file-upload"
        onChange={handleChange}
        disabled={isAnalyzing}
      />
      
      <label htmlFor="file-upload" className="w-full flex flex-col items-center cursor-pointer group">
        {isAnalyzing ? (
          // --- ZAČIATOK NOVEJ ANIMÁCIE (SLOT MACHINE) ---
          <div className="flex flex-col items-center py-10 w-full animate-fade-in">
            {/* Animovaná ikona nad textom */}
            <div className="w-20 h-20 md:w-24 md:h-24 bg-brand/10 rounded-[1.5rem] md:rounded-[2rem] flex items-center justify-center mb-8 sm:mb-12 shadow-inner border border-brand/20 relative overflow-hidden">
              <div className="absolute inset-0 bg-brand/20 animate-pulse"></div>
              <UploadCloud className="w-10 h-10 md:w-12 md:h-12 text-brand relative z-10" />
            </div>

            {/* Samotný Slot Machine Loader */}
            <div className="flex items-center justify-center text-xl md:text-3xl lg:text-4xl font-black uppercase tracking-tighter w-full max-w-[90%] md:max-w-[80%] mx-auto">
              <p className="text-black mr-3 sm:mr-4 shrink-0">Analyzujem:</p>
              <div className="relative overflow-hidden h-[30px] md:h-[44px] lg:h-[52px] min-w-[200px] sm:min-w-[280px] text-left shrink-0">
                {/* Gradient maska pre jemné miznutie slov na vrchu a na spodku */}
                <div 
                  className="absolute inset-0 z-20 pointer-events-none" 
                  style={{ 
                    background: 'linear-gradient(#ffffff 5%, transparent 25%, transparent 75%, #ffffff 95%)' 
                  }}
                />
                <div className="slot-words absolute top-0 left-0 w-full">
                  <span className="block h-[30px] md:h-[44px] lg:h-[52px] leading-[30px] md:leading-[44px] lg:leading-[52px] text-brand">Čítam dokument...</span>
                  <span className="block h-[30px] md:h-[44px] lg:h-[52px] leading-[30px] md:leading-[44px] lg:leading-[52px] text-brand">Extrahujem dáta...</span>
                  <span className="block h-[30px] md:h-[44px] lg:h-[52px] leading-[30px] md:leading-[44px] lg:leading-[52px] text-brand">Kalkulujem skóre...</span>
                  <span className="block h-[30px] md:h-[44px] lg:h-[52px] leading-[30px] md:leading-[44px] lg:leading-[52px] text-brand">Šifrujem odkaz...</span>
                  {/* Zopakované prvé slovo pre hladkú nekonečnú slučku */}
                  <span className="block h-[30px] md:h-[44px] lg:h-[52px] leading-[30px] md:leading-[44px] lg:leading-[52px] text-brand">Čítam dokument...</span>
                </div>
              </div>
            </div>
            
            <p className="text-black/40 mt-8 md:mt-12 font-medium text-sm md:text-lg uppercase tracking-widest">
              Prosím nezatvárajte túto stránku
            </p>

            {/* CSS pre animáciu točenia */}
            <style>{`
              .slot-words {
                animation: spin_words 5s infinite cubic-bezier(0.87, 0, 0.13, 1);
              }
              @keyframes spin_words {
                10% { transform: translateY(-20%); }
                25% { transform: translateY(-20%); }
                
                35% { transform: translateY(-40%); }
                50% { transform: translateY(-40%); }
                
                60% { transform: translateY(-60%); }
                75% { transform: translateY(-60%); }
                
                85% { transform: translateY(-80%); }
                100% { transform: translateY(-80%); }
              }
            `}</style>
          </div>
          // --- KONIEC NOVEJ ANIMÁCIE ---
        ) : (
          <>
            <div className="w-20 h-20 md:w-32 h-32 bg-brand rounded-full mb-6 md:mb-10 flex items-center justify-center transition-all duration-300 group-hover:scale-110 shadow-2xl shadow-brand/20">
              <UploadCloud className="w-10 h-10 md:w-16 h-16 text-white" />
            </div>
            <h3 className="text-xl md:text-4xl font-black text-black mb-2 md:mb-4 px-2 tracking-tight uppercase leading-tight">{labels.title}</h3>
            <p className="text-black/40 font-medium text-sm md:text-xl max-w-lg leading-relaxed mb-8 md:mb-12 px-4">
              {labels.description}
            </p>
            <div className="px-8 py-4 md:px-12 md:py-5 bg-black text-white rounded-full transition-all duration-300 font-black text-xs md:text-xl uppercase tracking-widest hover:bg-brand shadow-xl shadow-black/30 transform hover:-translate-y-1">
              Vybrať súbor
            </div>
          </>
        )}
      </label>
    </div>
  );
};

export default FileUpload;
