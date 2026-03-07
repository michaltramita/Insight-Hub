import React, { useCallback } from 'react';
import { UploadCloud } from 'lucide-react';
import { AnalysisMode } from '../types';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isAnalyzing: boolean;
  mode?: AnalysisMode | null;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, isAnalyzing, mode }) => {
  const isSupportedFile = (file: File) => {
    const supportedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 
      'application/vnd.ms-excel', 
      'application/json' 
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
      className={`w-full max-w-2xl mx-auto p-6 md:p-12 border-[2px] md:border-[3px] border-dashed rounded-[2rem] transition-all duration-500 flex flex-col items-center justify-center text-center bg-white
        ${isAnalyzing ? 'border-brand/10 bg-brand/[0.02] cursor-wait py-10 md:py-14' : 'border-brand/40 hover:border-brand hover:shadow-2xl hover:shadow-brand/10 cursor-pointer'}
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
          <div className="flex flex-col items-center w-full animate-fade-in">
            <div className="w-14 h-14 md:w-16 md:h-16 bg-brand/10 rounded-2xl flex items-center justify-center mb-6 shadow-inner border border-brand/20 relative overflow-hidden">
              <div className="absolute inset-0 bg-brand/20 animate-pulse"></div>
              <UploadCloud className="w-7 h-7 md:w-8 md:h-8 text-brand relative z-10" />
            </div>

            <div className="flex items-center justify-center text-lg md:text-2xl font-black uppercase tracking-tighter w-full">
              <p className="text-black mr-2 md:mr-3 shrink-0">Analyzujem:</p>
              
              <div className="relative overflow-hidden h-[28px] md:h-[32px] min-w-[200px] md:min-w-[280px] text-left shrink-0">
                <div 
                  className="absolute inset-0 z-20 pointer-events-none" 
                  style={{ 
                    background: 'linear-gradient(#ffffff 0%, transparent 20%, transparent 80%, #ffffff 100%)' 
                  }}
                />
                
                <div className="slot-words flex flex-col">
                  {/* Nové rozšírené texty: */}
                  <span className="block h-[28px] md:h-[32px] leading-[28px] md:leading-[32px] text-brand whitespace-nowrap">Analyzujem dokument...</span>
                  <span className="block h-[28px] md:h-[32px] leading-[28px] md:leading-[32px] text-brand whitespace-nowrap">Extrahujem dáta...</span>
                  <span className="block h-[28px] md:h-[32px] leading-[28px] md:leading-[32px] text-brand whitespace-nowrap">Priradzujem hodnoty...</span>
                  <span className="block h-[28px] md:h-[32px] leading-[28px] md:leading-[32px] text-brand whitespace-nowrap">Triedim odpovede...</span>
                  <span className="block h-[28px] md:h-[32px] leading-[28px] md:leading-[32px] text-brand whitespace-nowrap">Vytváram grafy...</span>
                  <span className="block h-[28px] md:h-[32px] leading-[28px] md:leading-[32px] text-brand whitespace-nowrap">Nastavujem porovnania...</span>
                  <span className="block h-[28px] md:h-[32px] leading-[28px] md:leading-[32px] text-brand whitespace-nowrap">Pripravujem odporúčania...</span>
                  
                  {/* Zopakovanie prvého textu pre nekonečnú slučku */}
                  <span className="block h-[28px] md:h-[32px] leading-[28px] md:leading-[32px] text-brand whitespace-nowrap">Analyzujem dokument...</span>
                </div>
              </div>
            </div>
            
            <p className="text-black/40 mt-5 md:mt-6 font-bold text-[10px] md:text-xs uppercase tracking-[0.2em]">
              Prosím nezatvárajte túto stránku
            </p>

            <style>{`
              .slot-words {
                /* Nastavené na 16s podľa tvojho zadania */
                animation: spin_words 16s infinite cubic-bezier(0.87, 0, 0.13, 1);
              }
              /* Vypočítané percentá pre 8 položiek v kontajneri
                Každá fráza zaberá 12.5% výšky a je tam presný čas na zastavenie
              */
              @keyframes spin_words {
                0%, 10% { transform: translateY(0); }
                14%, 24% { transform: translateY(-12.5%); }
                28%, 38% { transform: translateY(-25%); }
                43%, 53% { transform: translateY(-37.5%); }
                57%, 67% { transform: translateY(-50%); }
                71%, 81% { transform: translateY(-62.5%); }
                85%, 95% { transform: translateY(-75%); }
                100% { transform: translateY(-87.5%); }
              }
            `}</style>
          </div>
        ) : (
          <>
            <div className="w-16 h-16 md:w-24 md:h-24 bg-brand rounded-full mb-6 md:mb-8 flex items-center justify-center transition-all duration-300 group-hover:scale-110 shadow-2xl shadow-brand/20">
              <UploadCloud className="w-8 h-8 md:w-12 md:h-12 text-white" />
            </div>
            <h3 className="text-lg md:text-3xl font-black text-black mb-2 px-2 tracking-tight uppercase leading-tight">{labels.title}</h3>
            <p className="text-black/40 font-medium text-xs md:text-lg max-w-md leading-relaxed mb-8 px-4">
              {labels.description}
            </p>
            <div className="px-8 py-3 md:px-10 md:py-4 bg-black text-white rounded-full transition-all duration-300 font-black text-xs md:text-sm uppercase tracking-widest hover:bg-brand shadow-xl shadow-black/30 transform hover:-translate-y-1">
              Vybrať súbor
            </div>
          </>
        )}
      </label>
    </div>
  );
};

export default FileUpload;
