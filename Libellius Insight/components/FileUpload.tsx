import React, { useCallback } from 'react';
import { UploadCloud, Loader2 } from 'lucide-react';
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
      'application/vnd.ms-excel' // .xls
    ];
    const extension = file.name.split('.').pop()?.toLowerCase();
    return supportedTypes.includes(file.type) || extension === 'xlsx' || extension === 'xls' || extension === 'pdf';
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (isAnalyzing) return;
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (isSupportedFile(file)) {
        onFileSelect(file);
      } else {
        alert("Prosím nahrajte iba PDF alebo Excel súbory (.xlsx, .xls).");
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
        title: 'Nahrajte výsledky spokojnosti (PDF alebo Excel)',
        description: 'Podporujeme PDF exporty aj Excel tabuľky.'
      };
    }
    return {
      title: 'Nahrajte výsledky z 360° Spätnej väzby',
      description: 'Podporujeme PDF aj Excel formáty.'
    };
  };

  const labels = getLabels();

  return (
    <div 
      className={`w-full max-w-4xl mx-auto p-8 md:p-20 border-[2px] md:border-[3px] border-dashed rounded-[2rem] md:rounded-[3rem] transition-all duration-500 flex flex-col items-center justify-center text-center bg-white
        ${isAnalyzing ? 'border-brand/30 bg-brand/5 opacity-80 cursor-wait' : 'border-brand/40 hover:border-brand hover:shadow-2xl hover:shadow-brand/10 cursor-pointer'}
      `}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <input 
        type="file" 
        // Tu sme pridali podporu pre Excel do výberového okna
        accept=".pdf,.xlsx,.xls,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" 
        className="hidden" 
        id="file-upload"
        onChange={handleChange}
        disabled={isAnalyzing}
      />
      
      <label htmlFor="file-upload" className="w-full flex flex-col items-center cursor-pointer group">
        {isAnalyzing ? (
          <div className="flex flex-col items-center">
            <Loader2 className="w-16 h-16 md:w-24 h-24 text-brand animate-spin mb-6 md:mb-8" />
            <h3 className="text-2xl md:text-4xl font-black text-black px-4 uppercase tracking-tighter">Analyzujem Vaše dáta...</h3>
            <p className="text-black/50 mt-2 md:mt-4 font-medium text-sm md:text-xl">Už len chvíľočku, Libellius AI práve pripravuje Váš report.</p>
          </div>
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

export default FileUpload; FileUpload;
