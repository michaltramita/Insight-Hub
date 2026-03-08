import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Sparkles, X, Users, MessageSquare, Target, GitMerge } from 'lucide-react';

interface WelcomeGuideProps {
  onClose: () => void;
  clientName?: string;
}

const WelcomeGuide: React.FC<WelcomeGuideProps> = ({ onClose, clientName }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [activeFeature, setActiveFeature] = useState<number>(0);
  const [cycleIndex, setCycleIndex] = useState<number>(0);

  // Zobrazenie s animáciou a uzamknutie scrollu na pozadí
  useEffect(() => {
    setIsVisible(true);
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Časovač predĺžený na 5 sekúnd (5000 ms)
  useEffect(() => {
    const timer = setInterval(() => {
      setCycleIndex((prev) => prev + 1);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  const features = [
    {
      id: 'engagement',
      title: 'Zapojenie účastníkov',
      desc: 'Prezrite si účasť cez prehľadnú tabuľku, interaktívny graf alebo detailné karty stredísk.',
      icon: <Users className="w-5 h-5" />,
      images: ['/zapojenie.mp4', '/kolac.mp4', '/karta-tim.mp4'] 
    },
    {
      id: 'open-questions',
      title: 'Otvorené otázky',
      desc: 'Spoznajte najčastejšie témy cez mapu početnosti tvrdení a prečítajte si strategické odporúčania od AI.',
      icon: <MessageSquare className="w-5 h-5" />,
      images: ['/preview-open-questions.png']
    },
    {
      id: 'team-eval',
      title: 'Hodnotenie tímov',
      desc: 'Podrobné zhrnutie každej oblasti pre konkrétny tím, vrátane identifikácie silných stránok a príležitostí.',
      icon: <Target className="w-5 h-5" />,
      images: ['/preview-team-eval.png']
    },
    {
      id: 'team-compare',
      title: 'Porovnávanie tímov',
      desc: 'Porovnajte si v danej oblasti viacero tímov naraz a odhaľte kľúčové rozdiely vo výsledkoch.',
      icon: <GitMerge className="w-5 h-5" />,
      images: ['/preview-compare.png']
    },
    {
      id: 'export',
      title: 'Export súborov',
      desc: 'Každý graf alebo tabuľku si stiahnete jedným kliknutím ako čistý PNG obrázok alebo ako Excel súbor pre ďalšiu prácu.',
      icon: <Download className="w-5 h-5" />,
      images: ['/preview-export.png']
    }
  ];

  const modalContent = (
    <div className={`fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 md:p-8 transition-all duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      
      {/* Rozmazané pozadie */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={handleClose}
      />

      {/* Hlavná karta */}
      <div className={`relative w-full max-w-6xl bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-[0_30px_80px_-15px_rgba(0,0,0,0.7)] overflow-hidden transition-all duration-500 transform flex flex-col md:flex-row ${isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-12'}`}>
        
        <button 
          onClick={handleClose}
          className="absolute top-4 right-4 md:top-6 md:right-6 p-2.5 bg-black/5 hover:bg-black/10 rounded-full text-black/40 hover:text-black transition-colors z-50"
        >
          <X className="w-5 h-5" />
        </button>

        {/* ĽAVÁ STRANA: Zoznam 5 situácií */}
        <div className="w-full md:w-1/2 p-6 sm:p-8 md:p-10 lg:p-12 flex flex-col justify-center max-h-[90vh] overflow-y-auto no-scrollbar">
          
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand/5 text-brand rounded-full mb-5 w-fit text-[10px] font-black tracking-widest uppercase shrink-0">
            <Sparkles className="w-3 h-3" /> Rýchly sprievodca
          </div>

          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-tighter leading-[1.1] mb-3 text-black shrink-0">
            Váš report je <span className="text-brand">pripravený</span>
          </h2>
          <p className="text-black/50 font-medium text-xs sm:text-sm mb-6 max-w-md shrink-0">
            {clientName ? `Vitajte, ${clientName}. ` : ''} 
            Prejdite si, čo všetko nájdete v interaktívnom dashboarde.
          </p>

          <div className="space-y-2 mb-8 shrink-0">
            {features.map((feature, index) => (
              <div 
                key={feature.id}
                onMouseEnter={() => { setActiveFeature(index); setCycleIndex(0); }}
                onClick={() => { setActiveFeature(index); setCycleIndex(0); }}
                className={`flex items-start gap-3 p-3 rounded-2xl cursor-pointer transition-all duration-300 border-2 ${
                  activeFeature === index 
                    ? 'border-brand/20 bg-brand/5' 
                    : 'border-transparent hover:bg-black/5'
                }`}
              >
                <div className={`mt-1 flex-shrink-0 transition-colors duration-300 ${activeFeature === index ? 'text-brand' : 'text-black/30'}`}>
                  {feature.icon}
                </div>
                <div>
                  <h4 className={`text-sm font-black uppercase tracking-tight mb-0.5 transition-colors duration-300 ${activeFeature === index ? 'text-brand' : 'text-black'}`}>
                    {feature.title}
                  </h4>
                  <p className="text-xs font-medium text-black/50 leading-relaxed">
                    {feature.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <button 
            onClick={handleClose}
            className="w-full py-4 bg-black text-white rounded-2xl font-black uppercase tracking-widest text-xs sm:text-sm hover:bg-brand transition-colors duration-300 shadow-xl shadow-black/20 shrink-0"
          >
            Prejsť na výsledky analýzy
          </button>
        </div>

        {/* PRAVÁ STRANA: Dynamické obrázky a videá */}
        {/* Zmenšené paddingy pre väčší priestor na video (p-4 lg:p-6 namiesto p-8 lg:p-12) */}
        <div className="w-full md:w-1/2 bg-[#f4f4f5] relative hidden md:block overflow-hidden p-4 lg:p-6">
          {/* Dekoračné pozadie za obrázkom */}
          <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-brand/5 to-transparent pointer-events-none"></div>
          
          <div className="relative w-full h-full flex items-center justify-center">
            {features.map((feature, fIndex) => {
              const isActiveFeature = activeFeature === fIndex;
              
              return (
                <div 
                  key={`container-${feature.id}`}
                  className={`absolute inset-0 flex items-center justify-center transition-all duration-700 ease-in-out ${
                    isActiveFeature 
                      ? 'opacity-100 translate-y-0 scale-100 z-10' 
                      : 'opacity-0 translate-y-8 scale-95 pointer-events-none z-0'
                  }`}
                >
                  {/* Ak má feature viac ukážok, tu sa cyklia */}
                  {feature.images.map((mediaSrc, imgIndex) => {
                    const isVisibleImage = isActiveFeature && (cycleIndex % feature.images.length === imgIndex);
                    // Zistenie, či ide o video na základe koncovky
                    const isVideo = mediaSrc.toLowerCase().endsWith('.mp4') || mediaSrc.toLowerCase().endsWith('.webm');
                    
                    return (
                      <div 
                        key={`${feature.id}-${imgIndex}`}
                        // Zmenšené odsadenie videa od okraja (inset-4 namiesto inset-8) pre maximálnu veľkosť
                        className={`absolute inset-4 flex items-center justify-center transition-opacity duration-700 ease-in-out ${
                          isVisibleImage ? 'opacity-100' : 'opacity-0'
                        }`}
                      >
                        {isVideo ? (
                          <video 
                            src={mediaSrc} 
                            autoPlay 
                            loop 
                            muted 
                            playsInline
                            className="w-full max-h-full object-contain rounded-xl shadow-2xl border border-black/10 bg-white"
                            onError={(e) => {
                              (e.target as HTMLVideoElement).style.display = 'none';
                              e.currentTarget.parentElement?.classList.add('fallback-bg');
                            }}
                          />
                        ) : (
                          <img 
                            src={mediaSrc} 
                            alt={`${feature.title} - Ukážka ${imgIndex + 1}`}
                            className="w-full max-h-full object-contain rounded-xl shadow-2xl border border-black/10 bg-white"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                              e.currentTarget.parentElement?.classList.add('fallback-bg');
                            }}
                          />
                        )}
                        
                        {/* Fallback UI (ak chýba súbor) */}
                        <div className="absolute inset-0 border-2 border-dashed border-black/10 rounded-2xl flex flex-col items-center justify-center text-center -z-10 bg-white shadow-xl">
                          <div className="text-black/20 mb-3">{feature.icon}</div>
                          <p className="text-black/30 font-black uppercase tracking-widest text-[10px]">
                            Tu sa zobrazí ukážka<br/>({mediaSrc})
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modalContent, document.body);
};

export default WelcomeGuide;
