import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, PanInfo } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface WelcomeGuideProps {
  onClose: () => void;
}

type FocusRailItem = {
  id: string | number;
  title: string;
  description?: string;
  mediaSrc: string;
  mobileImageSrc?: string;
  posterSrc?: string; 
  mobilePosterSrc?: string;
  meta?: string;
};

const cn = (...classes: (string | undefined | null | false)[]) =>
  classes.filter(Boolean).join(' ');

function wrap(min: number, max: number, v: number) {
  const rangeSize = max - min;
  return ((((v - min) % rangeSize) + rangeSize) % rangeSize) + min;
}

const BASE_SPRING = { type: 'tween', ease: [0.25, 1, 0.5, 1], duration: 1.2 };

const ControlledVideo = ({
  src,
  poster,
  isActive,
  className,
}: {
  src: string;
  poster?: string;
  isActive: boolean;
  className?: string;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      setTimeout(() => {
        video.play().catch(() => null);
      }, 50);
    } else {
      video.pause();
    }
  }, [isActive, src]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      {poster && (
        <img
          src={poster}
          alt=""
          className={cn(
            className,
            "absolute inset-0 z-10 transition-opacity duration-500",
            isVideoPlaying ? "opacity-0" : "opacity-100"
          )}
        />
      )}
      <video
        ref={videoRef}
        src={src}
        loop
        muted
        playsInline
        preload="auto"
        className={cn(className, "absolute inset-0 z-0")}
        onPlaying={() => setIsVideoPlaying(true)}
      />
    </div>
  );
};

const FocusRail: React.FC<{
  items: FocusRailItem[];
  onClose: () => void;
}> = ({ items, onClose }) => {
  const [active, setActive] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const count = items.length;
  const activeIndex = wrap(0, count, active);

  const handlePrev = useCallback(() => setActive((prev) => prev - 1), []);
  const handleNext = useCallback(() => setActive((prev) => prev + 1), []);

  const onDragEnd = (_e: any, { offset, velocity }: PanInfo) => {
    const swipe = Math.abs(offset.x) * velocity.x;
    if (swipe < -8500) handleNext();
    else if (swipe > 8500) handlePrev();
  };

  const visibleIndices = [-2, -1, 0, 1, 2];

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden text-white outline-none select-none">
      <button
        onClick={onClose}
        className="absolute right-6 top-6 z-[100] rounded-full bg-white/10 p-3 text-white shadow-lg backdrop-blur-md transition-all hover:bg-brand"
      >
        <X className="h-6 w-6" />
      </button>

      <div className="relative z-10 mx-auto flex h-full w-full max-w-7xl flex-col px-4 sm:px-8 py-4 sm:py-6">
        <div className="mx-auto mb-4 sm:mb-6 w-full max-w-3xl text-center shrink-0">
          <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.22em] text-brand">
            Rýchly sprievodca
          </div>
          <h1 className="mt-2 sm:mt-4 text-2xl sm:text-3xl md:text-5xl font-black tracking-tight text-white leading-tight">
            Vitajte v Libellius InsightHub
          </h1>
        </div>

        <div className="flex flex-1 items-center justify-center min-h-0 w-full py-2">
          <motion.div
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={onDragEnd}
            className="relative flex h-full w-full items-center justify-center cursor-grab active:cursor-grabbing"
            style={{ perspective: 2200 }}
          >
            {visibleIndices.map((offset) => {
              const absIndex = active + offset;
              const index = wrap(0, count, absIndex);
              const item = items[index];
              const isCenter = offset === 0;
              const dist = Math.abs(offset);
              const isVisible = dist <= 1;

              return (
                <motion.div
                  key={`${item.id}-${absIndex}`}
                  animate={{
                    x: offset * (isMobile ? 140 : 360),
                    scale: isCenter ? 1 : 0.88,
                    opacity: isCenter ? 1 : isVisible ? 0.5 : 0,
                    rotateY: offset * -8,
                  }}
                  transition={BASE_SPRING}
                  className={cn(
                    'absolute overflow-hidden rounded-[1.5rem] sm:rounded-[2.4rem] border p-2 sm:p-3 aspect-[3/4] h-full max-h-[45vh] sm:max-h-[62vh]',
                    isCenter ? 'border-brand/60 shadow-2xl' : 'border-white/10'
                  )}
                >
                  <ControlledVideo src={item.mediaSrc} isActive={isCenter} className="h-full w-full object-cover rounded-[1.1rem] sm:rounded-[1.65rem]" />
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        <div className="relative mt-auto p-4 sm:p-6 bg-neutral-900/95 rounded-[1.25rem] sm:rounded-[1.75rem] flex flex-col md:flex-row justify-between items-center gap-4">
           <div className="text-center md:text-left">
              <h2 className="text-xl sm:text-2xl font-black text-white">{items[activeIndex].title}</h2>
              <p className="text-neutral-300 text-xs sm:text-sm max-w-xl line-clamp-2 md:line-clamp-none">{items[activeIndex].description}</p>
           </div>
           <div className="flex items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-1 sm:gap-2 bg-white/5 rounded-full p-1 border border-white/10">
                <button onClick={handlePrev} className="p-2 hover:text-brand transition"><ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" /></button>
                <span className="text-[10px] sm:text-xs font-bold w-10 sm:w-12 text-center">{activeIndex + 1} / {count}</span>
                <button onClick={handleNext} className="p-2 hover:text-brand transition"><ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" /></button>
              </div>
              <button onClick={onClose} className="bg-brand px-6 sm:px-8 py-2.5 sm:py-3 rounded-full font-black uppercase tracking-widest text-[10px] sm:text-sm">Zobraziť report</button>
           </div>
        </div>
      </div>
    </div>
  );
};

const WelcomeGuide: React.FC<WelcomeGuideProps> = ({ onClose }) => {
  const GUIDE_ITEMS: FocusRailItem[] = [
    { id: 1, title: 'Zapojenie účastníkov', description: 'Prezrite si účasť cez prehľadnú tabuľku, interaktívny graf alebo detailné karty stredísk.', mediaSrc: '/zapojenie.mp4' },
    { id: 2, title: 'Otvorené otázky', description: 'Spoznajte najčastejšie témy cez mapu početnosti tvrdení a prečítajte si odporúčania od AI.', mediaSrc: '/otazky.mp4' },
    { id: 3, title: 'Hodnotenie tímov', description: 'Podrobné zhrnutie každej oblasti pre konkrétny tím, vrátane identifikácie silných stránok.', mediaSrc: '/tim.mp4' },
    { id: 4, title: 'Porovnávanie tímov', description: 'Porovnajte si v danej oblasti viacero tímov naraz a odhaľte kľúčové rozdiely vo výsledkoch.', mediaSrc: '/porovnanie.mp4' },
    { id: 5, title: 'Export súborov', description: 'Každý graf alebo tabuľku si stiahnete jedným kliknutím ako čistý PNG obrázok.', mediaSrc: '/export.mp4' },
  ];

  return (
    <div className="fixed inset-0 z-[99999]">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/90 backdrop-blur-[14px]" />
      <FocusRail items={GUIDE_ITEMS} onClose={onClose} />
    </div>
  );
};

export default WelcomeGuide;
