import React, { useCallback, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { AnalysisMode } from '../types';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isAnalyzing: boolean;
  mode?: AnalysisMode | null;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, isAnalyzing, mode }) => {
  const [isDragging, setIsDragging] = useState(false);

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

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isAnalyzing) setIsDragging(true);
  }, [isAnalyzing]);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
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
        title: 'Nahrajte dáta (Excel/PDF) alebo hotový JSON',
        description: 'Pre analýzu vložte Excel. Pre zobrazenie výsledkov vložte JSON report.'
      };
    }
    return {
      title: 'Nahrajte výsledky z 360° spätnej väzby',
      description: 'Podporujeme PDF, Excel aj vopred analyzované JSON formáty.'
    };
  };

  const labels = getLabels();

  return (
    <div 
      className={`
        w-full max-w-4xl mx-auto min-h-[400px] md:min-h-[480px] p-8 md:p-12 
        border-2 border-dashed rounded-[2.5rem] transition-all duration-300 ease-out
        flex flex-col items-center justify-center text-center overflow-hidden
        ${isAnalyzing 
          ? 'border-brand/10 bg-white cursor-wait' 
          : isDragging 
            ? 'border-brand bg-brand/5 scale-[1.02] shadow-2xl shadow-brand/10 cursor-copy' 
            : 'border-black/20 bg-[#f9f9f9] hover:border-brand/50 hover:bg-white hover:shadow-2xl hover:shadow-black/5 cursor-pointer'
        }
      `}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <input 
        type="file" 
        accept=".pdf,.xlsx,.xls,.csv,.json,application/pdf,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" 
        className="hidden" 
        id="file-upload"
        onChange={handleChange}
        disabled={isAnalyzing}
      />
      
      <label htmlFor="file-upload" className="w-full h-full flex flex-col items-center justify-center cursor-pointer group">
        {isAnalyzing ? (
          <div className="flex flex-col items-center w-full animate-fade-in px-2">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-brand/10 rounded-[1.5rem] flex items-center justify-center mb-8 shadow-inner border border-brand/20 relative overflow-hidden shrink-0">
              <div className="absolute inset-0 bg-brand/20 animate-pulse"></div>
              <UploadCloud className="w-8 h-8 md:w-10 md:h-10 text-brand relative z-10" />
            </div>

            <div className="flex items-center justify-center text-xl sm:text-2xl md:text-4xl lg:text-5xl font-black uppercase tracking-tighter w-full px-4 mx-auto">
              <div className="relative overflow-hidden h-[28px] sm:h-[32px] md:h-[48px] lg:h-[56px] w-full text-center">
                <div className="slot-words flex flex-col items-center">
                  <span className="block h-[28px] sm:h-[32px] md:h-[48px] lg:h-[56px] leading-[28px] sm:leading-[32px] md:leading-[48px] lg:leading-[56px] text-brand whitespace-nowrap">Analyzujem dokument...</span>
                  <span className="block h-[28px] sm:h-[32px] md:h-[48px] lg:h-[56px] leading-[28px] sm:leading-[32px] md:leading-[48px] lg:leading-[56px] text-brand whitespace-nowrap">Extrahujem dáta...</span>
                  <span className="block h-[28px] sm:h-[32px] md:h-[48px] lg:h-[56px] leading-[28px] sm:leading-[32px] md:leading-[48px] lg:leading-[56px] text-brand whitespace-nowrap">Priradzujem hodnoty...</span>
                  <span className="block h-[28px] sm:h-[32px] md:h-[48px] lg:h-[56px] leading-[28px] sm:leading-[32px] md:leading-[48px] lg:leading-[56px] text-brand whitespace-nowrap">Triedim odpovede...</span>
                  <span className="block h-[28px] sm:h-[32px] md:h-[48px] lg:h-[56px] leading-[28px] sm:leading-[32px] md:leading-[48px] lg:leading-[56px] text-brand whitespace-nowrap">Vytváram grafy...</span>
                  <span className="block h-[28px] sm:h-[32px] md:h-[48px] lg:h-[56px] leading-[28px] sm:leading-[32px] md:leading-[48px] lg:leading-[56px] text-brand whitespace-nowrap">Nastavujem porovnania...</span>
                  <span className="block h-[28px] sm:h-[32px] md:h-[48px] lg:h-[56px] leading-[28px] sm:leading-[32px] md:leading-[48px] lg:leading-[56px] text-brand whitespace-nowrap">Pripravujem odporúčania...</span>
                  <span className="block h-[28px] sm:h-[32px] md:h-[48px] lg:h-[56px] leading-[28px] sm:leading-[32px] md:leading-[48px] lg:leading-[56px] text-brand whitespace-nowrap">Analyzujem dokument...</span>
                </div>
              </div>
            </div>
            
            <p className="text-black/40 mt-8 font-bold text-xs md:text-sm uppercase tracking-[0.2em] text-center w-full shrink-0">
              Prosím nezatvárajte túto stránku
            </p>

            <style>{`
              .slot-words {
                animation: spin_words 16s infinite cubic-bezier(0.87, 0, 0.13, 1);
              }
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
          <div className="flex flex-col items-center">
            <div className={`
              w-20 h-20 md:w-28 md:h-28 bg-white border border-black/5 rounded-[2rem] mb-8 
              flex items-center justify-center transition-all duration-500 ease-out
              shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] shrink-0
              ${isDragging ? 'scale-110 shadow-brand/30 border-brand/20' : 'group-hover:scale-105 group-hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] group-hover:border-brand/20'}
            `}>
              <UploadCloud className={`w-10 h-10 md:w-14 md:h-14 transition-colors duration-300 ${isDragging ? 'text-brand' : 'text-black/40 group-hover:text-brand'}`} />
            </div>
            
            <h3 className="text-2xl md:text-4xl font-black text-black mb-3 px-2 tracking-tight uppercase leading-tight">
              {labels.title}
            </h3>
            
            <p className="text-black/50 font-semibold text-sm md:text-lg max-w-xl leading-relaxed mb-10 px-4">
              {labels.description} alebo súbor jednoducho pretiahnite sem
            </p>
            
            <div className="px-10 py-4 bg-black text-white rounded-2xl transition-all duration-300 font-black text-sm uppercase tracking-widest group-hover:bg-brand shadow-xl shadow-black/20 group-hover:shadow-brand/30 transform group-hover:-translate-y-1">
              Vybrať súbor
            </div>
          </div>
        )}
      </label>
    </div>
  );
};

export default FileUpload;
