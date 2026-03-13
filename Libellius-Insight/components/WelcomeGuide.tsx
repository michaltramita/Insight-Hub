import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

// --- TYPY A POMOCNÉ FUNKCIE ---
interface WelcomeGuideProps {
  onClose: () => void;
  clientName?: string;
}

type FocusRailItem = {
  id: string | number;
  title: string;
  description?: string;
  mediaSrc: string;
  mobileImageSrc?: string;
  meta?: string;
};

// Jednoduchá utilita na spájanie CSS tried
const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(' ');

function wrap(min: number, max: number, v: number) {
  const rangeSize = max - min;
  return ((((v - min) % rangeSize) + rangeSize) % rangeSize) + min;
}

const BASE_SPRING = { type: "spring", stiffness: 300, damping: 30, mass: 1 };
const TAP_SPRING = { type: "spring", stiffness: 450, damping: 18, mass: 1 };

// --- INTERNÝ KOMPONENT: FOCUS RAIL (3D Karusel) ---
const FocusRail: React.FC<{
  items: FocusRailItem[];
  onClose: () => void;
}> = ({ items, onClose }) => {
  const [active, setActive] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const lastWheelTime = useRef<number>(0);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const count = items.length;
  const activeIndex = wrap(0, count, active);
  const activeItem = items[activeIndex];

  const handlePrev = useCallback(() => {
    setActive((p) => p - 1);
  }, []);

  const handleNext = useCallback(() => {
    setActive((p) => p + 1);
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    const now = Date.now();
    if (now - lastWheelTime.current < 400) return;
    const isHorizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
    const delta = isHorizontal ? e.deltaX : e.deltaY;
    if (Math.abs(delta) > 20) {
      delta > 0 ? handleNext() : handlePrev();
      lastWheelTime.current = now;
    }
  }, [handleNext, handlePrev]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") handlePrev();
    if (e.key === "ArrowRight") handleNext();
    if (e.key === "Escape") onClose();
  };

  const swipeConfidenceThreshold = 10000;
  const swipePower = (offset: number, velocity: number) => Math.abs(offset) * velocity;

  const onDragEnd = (e: MouseEvent | TouchEvent | PointerEvent, { offset, velocity }: PanInfo) => {
    const swipe = swipePower(offset.x, velocity.x);
    if (swipe < -swipeConfidenceThreshold) handleNext();
    else if (swipe > swipeConfidenceThreshold) handlePrev();
  };

  const visibleIndices = [-2, -1, 0, 1, 2];
  
  const getMediaSrc = (item: FocusRailItem) => {
      return isMobile && item.mobileImageSrc ? item.mobileImageSrc : item.mediaSrc;
  };

  const isVideo = (src: string) => src.toLowerCase().endsWith('.mp4') || src.toLowerCase().endsWith('.webm');

  return (
    <div
      // Odstránili sme bg-neutral-950 a nahradili bg-transparent, pretože rozmazanie robí rodič
      className="group relative flex h-[100dvh] w-full flex-col overflow-hidden bg-transparent text-white outline-none select-none overflow-x-hidden"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onWheel={onWheel}
    >
      {/* Zatváracie tlačidlo */}
      <button onClick={onClose} className="absolute top-6 right-6 z-50 p-3 bg-white/10 hover:bg-brand backdrop-blur-md rounded-full text-white transition-all shadow-lg group-hover/close:scale-105">
        <X className="w-6 h-6" />
      </button>

      {/* Jemný gradient, aby text dole bol vždy čitateľný */}
      <div className="absolute inset-0 z-0 pointer-events-none bg-gradient-to-t from-black/80 via-black/20 to-black/10" />

      {/* Hlavný Stage pre karty (Zmenená výška pre vertikálne karty) */}
      <div className="relative z-10 flex flex-1 flex-col justify-center px-0 md:px-8 mt-12 md:mt-0">
        <motion.div
          className="relative mx-auto flex h-[420px] md:h-[550px] w-full max-w-6xl items-center justify-center perspective-[1200px] cursor-grab active:cursor-grabbing"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={onDragEnd}
        >
          {visibleIndices.map((offset) => {
            const absIndex = active + offset;
            const index = wrap(0, count, absIndex);
            const item = items[index];
            const mediaSrc = getMediaSrc(item);

            const isCenter = offset === 0;
            const dist = Math.abs(offset);
            
            // Zmenšený rozostup, keďže karty sú teraz na šírku užšie (vertikálne)
            const xOffset = offset * (isMobile ? 160 : 220);
            const zOffset = -dist * 140;
            const scale = isCenter ? 1 : 0.85;
            const rotateY = offset * -15;
            const opacity = isCenter ? 1 : Math.max(0.1, 1 - dist * 0.5);
            const blur = isCenter ? 0 : dist * 6;
            const brightness = isCenter ? 1 : 0.4;

            return (
              <motion.div
                key={absIndex}
                className={cn(
                  // TU JE ZMENA: aspect-[9/16] (vertikálne) a užšia šírka
                  "absolute aspect-[9/16] w-[200px] md:w-[280px] rounded-[2rem] border-t bg-neutral-900 transition-shadow duration-300 overflow-hidden",
                  isCenter 
                    ? "z-20 border-brand/50 shadow-[0_0_60px_-15px_rgba(0,0,0,0.5)] shadow-brand/20" 
                    : "z-10 border-white/10 shadow-2xl"
                )}
                initial={false}
                animate={{ x: xOffset, z: zOffset, scale: scale, rotateY: rotateY, opacity: opacity, filter: `blur(${blur}px) brightness(${brightness})` }}
                transition={(val) => (val === "scale" ? TAP_SPRING : BASE_SPRING)}
                style={{ transformStyle: "preserve-3d" }}
                onClick={() => { if (offset !== 0) setActive((p) => p + offset); }}
              >
                {isVideo(mediaSrc) ? (
                  <video src={mediaSrc} className="h-full w-full object-cover pointer-events-none" autoPlay={isCenter} muted loop playsInline />
                ) : (
                  <img src={mediaSrc} alt={item.title} className="h-full w-full object-cover pointer-events-none" />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
                {!isCenter && <div className="absolute inset-0 bg-black/60 pointer-events-none" />}
              </motion.div>
            );
          })}
        </motion.div>

        {/* Texty a ovládanie */}
        <div className="mx-auto mt-8 md:mt-12 flex w-full max-w-4xl flex-col items-center justify-between gap-6 md:flex-row pointer-events-auto px-6">
          <div className="flex flex-1 flex-col items-center text-center md:items-start md:text-left h-32 justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeItem.id}
                initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
                transition={{ duration: 0.3 }}
                className="space-y-2"
              >
                {activeItem.meta && <span className="text-xs font-black uppercase tracking-widest text-brand">{activeItem.meta}</span>}
                <h2 className="text-3xl font-black tracking-tight md:text-4xl text-white">{activeItem.title}</h2>
                <p className="max-w-md text-neutral-300 font-medium">{activeItem.description}</p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 mt-2 md:mt-0">
            <div className="flex items-center gap-1 rounded-full bg-white/10 p-1 ring-1 ring-white/20 backdrop-blur-md">
              <button onClick={handlePrev} className="rounded-full p-3 text-neutral-300 transition hover:bg-brand hover:text-white active:scale-95"><ChevronLeft className="h-5 w-5" /></button>
              <span className="min-w-[40px] text-center text-xs font-bold text-neutral-300">{activeIndex + 1} / {count}</span>
              <button onClick={handleNext} className="rounded-full p-3 text-neutral-300 transition hover:bg-brand hover:text-white active:scale-95"><ChevronRight className="h-5 w-5" /></button>
            </div>
            
            <button onClick={onClose} className="group flex items-center justify-center gap-2 rounded-full bg-brand px-8 py-3.5 text-sm font-black text-white transition-all hover:scale-105 active:scale-95 uppercase tracking-widest shadow-xl shadow-brand/30">
              Zobraziť report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- HLAVNÝ EXPORTOVANÝ KOMPONENT ---
const WelcomeGuide: React.FC<WelcomeGuideProps> = ({ onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 500);
  };

  const GUIDE_ITEMS: FocusRailItem[] = [
    {
      id: 1,
      title: "Zapojenie účastníkov",
      description: "Prezrite si účasť cez prehľadnú tabuľku, interaktívny graf alebo detailné karty stredísk.",
      meta: "Funkcia 1",
      mediaSrc: "/zapojenie.mp4", 
      mobileImageSrc: "/zapojenie-mobil.mp4"
    },
    {
      id: 2,
      title: "Otvorené otázky",
      description: "Spoznajte najčastejšie témy cez mapu početnosti tvrdení a prečítajte si odporúčania od AI.",
      meta: "Analýza AI",
      mediaSrc: "/otazky.mp4",
      mobileImageSrc: "/otazky-mobil.mp4"
    },
    {
      id: 3,
      title: "Hodnotenie tímov",
      description: "Podrobné zhrnutie každej oblasti pre konkrétny tím, vrátane identifikácie silných stránok.",
      meta: "Detailný pohľad",
      mediaSrc: "/tim.mp4",
      mobileImageSrc: "/tim-mobil.mp4"
    },
    {
      id: 4,
      title: "Porovnávanie tímov",
      description: "Porovnajte si v danej oblasti viacero tímov naraz a odhaľte kľúčové rozdiely vo výsledkoch.",
      meta: "Súvislosti",
      mediaSrc: "/porovnanie.mp4",
      mobileImageSrc: "/porovnanie-mobil.mp4"
    },
    {
      id: 5,
      title: "Export súborov",
      description: "Každý graf alebo tabuľku si stiahnete jedným kliknutím ako čistý PNG obrázok.",
      meta: "Prezentácia",
      mediaSrc: "/export.mp4",
      mobileImageSrc: "/export-mobil.mp4"
    },
  ];

  const content = (
    // TU JE ZMENA POZADIA: bg-black/70 a backdrop-blur-xl zabezpečia, že vidíš rozmazaný dashboard pod tým
    <div className={`fixed inset-0 z-[99999] transition-opacity duration-500 bg-black/70 backdrop-blur-xl ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      <FocusRail 
        items={GUIDE_ITEMS} 
        onClose={handleClose}
      />
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
};

export default WelcomeGuide;
