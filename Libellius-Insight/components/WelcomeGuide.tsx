import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BarChart3, Download, MousePointerClick, Sparkles, X } from 'lucide-react';

interface WelcomeGuideProps {
  onClose: () => void;
  clientName?: string;
}

const WelcomeGuide: React.FC<WelcomeGuideProps> = ({ onClose, clientName }) => {
  const [isVisible, setIsVisible] = useState(false);

  // Efekt pre plynulé zobrazenie
  useEffect(() => {
    setIsVisible(true);
    // Zabránime scrollovaniu pozadia, kým je modal otvorený
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300); // Počká na dokončenie animácie pred úplným odstránením
  };

  const modalContent = (
    <div className={`fixed inset-0 z-[99999] flex items-center justify-center p-4 transition-all duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      
      {/* Rozmazané pozadie */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Samotná karta */}
      <div className={`relative w-full max-w-2xl bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden transition-all duration-300 transform ${isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-8'}`}>
        
        {/* Tlačidlo na zavretie (krížik) */}
        <button 
          onClick={handleClose}
          className="absolute top-6 right-6 p-2 bg-black/5 hover:bg-black/10 rounded-full text-black/40 hover:text-black transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8 sm:p-10 md:p-12">
          
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand/5 text-brand rounded-full mb-6 text-[10px] sm:text-xs font-black tracking-widest uppercase">
            <Sparkles className="w-3 h-3 sm:w-4 sm:h-4" /> Rýchly sprievodca
          </div>

          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-tighter leading-none mb-3 text-black">
            Vitajte v reporte {clientName ? <span className="text-brand">{clientName}</span> : ''}
          </h2>
          <p className="text-black/50 font-medium text-sm sm:text-base mb-10 max-w-lg">
            Pripravili sme pre vás interaktívny dashboard. Pozrite si, čo všetko v ňom môžete robiť, aby ste z dát vyťažili maximum.
          </p>

          <div className="space-y-6 sm:space-y-8 mb-10">
            
            <div className="flex items-start gap-4 sm:gap-5 group">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-black/5 group-hover:bg-brand group-hover:text-white text-black rounded-2xl flex items-center justify-center shrink-0 transition-colors duration-300">
                <BarChart3 className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <div>
                <h4 className="text-sm sm:text-base font-black uppercase tracking-tight text-black mb-1">Porovnania a Detaily</h4>
                <p className="text-xs sm:text-sm font-medium text-black/50 leading-relaxed">
                  Prepínajte sa medzi detailným pohľadom na konkrétny tím a komplexnou tabuľkou, ktorá porovnáva všetky strediská naraz.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 sm:gap-5 group">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-black/5 group-hover:bg-brand group-hover:text-white text-black rounded-2xl flex items-center justify-center shrink-0 transition-colors duration-300">
                <Download className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <div>
                <h4 className="text-sm sm:text-base font-black uppercase tracking-tight text-black mb-1">Okamžitý Export dát</h4>
                <p className="text-xs sm:text-sm font-medium text-black/50 leading-relaxed">
                  Každý graf alebo tabuľku si môžete jedným kliknutím stiahnuť ako čistý PNG obrázok pre vašu prezentáciu, alebo ako Excel súbor pre ďalšiu prácu.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 sm:gap-5 group">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-black/5 group-hover:bg-brand group-hover:text-white text-black rounded-2xl flex items-center justify-center shrink-0 transition-colors duration-300">
                <MousePointerClick className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <div>
                <h4 className="text-sm sm:text-base font-black uppercase tracking-tight text-black mb-1">Interaktívne prvky</h4>
                <p className="text-xs sm:text-sm font-medium text-black/50 leading-relaxed">
                  Klikajte na grafy, filtrujte tímy podľa potreby a všímajte si vysvetlivky, ktoré sa zobrazia po prejdení myšou. Report sa prispôsobí vám.
                </p>
              </div>
            </div>

          </div>

          <button 
            onClick={handleClose}
            className="w-full py-4 sm:py-5 bg-black text-white rounded-2xl font-black uppercase tracking-widest text-xs sm:text-sm hover:bg-brand transition-colors duration-300 shadow-xl shadow-black/20 transform hover:-translate-y-1"
          >
            Prejsť na výsledky analýzy
          </button>

        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modalContent, document.body);
};

export default WelcomeGuide;
