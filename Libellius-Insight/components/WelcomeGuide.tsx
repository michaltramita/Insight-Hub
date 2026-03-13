import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

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

const cn = (...classes: (string | undefined | null | false)[]) =>
  classes.filter(Boolean).join(' ');

function wrap(min: number, max: number, v: number) {
  const rangeSize = max - min;
  return ((((v - min) % rangeSize) + rangeSize) % rangeSize) + min;
}

const BASE_SPRING = { type: 'spring', stiffness: 280, damping: 30, mass: 1 };
const TAP_SPRING = { type: 'spring', stiffness: 420, damping: 24, mass: 1 };

const ControlledVideo = ({
  src,
  isActive,
  className,
}: {
  src: string;
  isActive: boolean;
  className?: string;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      video.currentTime = 0;
      video.play().catch(() => null);
    } else {
      video.pause();
    }
  }, [isActive, src]);

  return (
    <video
      ref={videoRef}
      src={src}
      loop
      muted
      playsInline
      className={className}
    />
  );
};

const FocusRail: React.FC<{
  items: FocusRailItem[];
  onClose: () => void;
}> = ({ items, onClose }) => {
  const [active, setActive] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const lastWheelTime = useRef<number>(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    rootRef.current?.focus();
  }, []);

  const count = items.length;
  const activeIndex = wrap(0, count, active);
  const activeItem = items[activeIndex];

  const handlePrev = useCallback(() => {
    setActive((prev) => prev - 1);
  }, []);

  const handleNext = useCallback(() => {
    setActive((prev) => prev + 1);
  }, []);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      const now = Date.now();
      if (now - lastWheelTime.current < 450) return;

      const isHorizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      const delta = isHorizontal ? e.deltaX : e.deltaY;

      if (Math.abs(delta) > 24) {
        delta > 0 ? handleNext() : handlePrev();
        lastWheelTime.current = now;
      }
    },
    [handleNext, handlePrev]
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') handlePrev();
    if (e.key === 'ArrowRight') handleNext();
    if (e.key === 'Escape') onClose();
  };

  const swipeConfidenceThreshold = 9000;
  const swipePower = (offset: number, velocity: number) =>
    Math.abs(offset) * velocity;

  const onDragEnd = (
    _e: MouseEvent | TouchEvent | PointerEvent,
    { offset, velocity }: PanInfo
  ) => {
    const swipe = swipePower(offset.x, velocity.x);
    if (swipe < -swipeConfidenceThreshold) handleNext();
    else if (swipe > swipeConfidenceThreshold) handlePrev();
  };

  const visibleIndices = [-1, 0, 1];

  const getMediaSrc = (item: FocusRailItem) =>
    isMobile && item.mobileImageSrc ? item.mobileImageSrc : item.mediaSrc;

  const isVideo = (src: string) =>
    src.toLowerCase().endsWith('.mp4') || src.toLowerCase().endsWith('.webm');

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onWheel={onWheel}
      className="relative min-h-[100dvh] w-full overflow-y-auto overflow-x-hidden text-white outline-none select-none"
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-50 rounded-full bg-white/10 p-3 text-white shadow-lg backdrop-blur-md transition-all hover:scale-105 hover:bg-brand md:right-6 md:top-6"
        aria-label="Zavrieť sprievodcu"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Silnejšie utopenie dashboardu v pozadí */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-black/82 backdrop-blur-[10px]" />
      <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-black/70 via-black/45 to-black/85" />
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.04),transparent_35%)]" />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-7xl flex-col px-4 pb-8 pt-20 md:px-8 md:pb-10 md:pt-10">
        {/* Horný intro blok */}
        <div className="mx-auto mb-5 w-full max-w-3xl text-center md:mb-7">
          <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-brand backdrop-blur-md">
            Rýchly sprievodca
          </div>

          <h1 className="mt-4 text-3xl font-black tracking-tight text-white md:text-5xl">
            Vitajte v Libellius InsightHub
          </h1>

          <p className="mx-auto mt-3 max-w-2xl text-sm font-medium leading-relaxed text-neutral-300 md:text-base">
            Váš report je pripravený. Pozrite si krátky prehľad hlavných
            funkcií, vďaka ktorým sa vo výsledkoch zorientujete rýchlejšie a
            naplno využijete možnosti reportu.
          </p>
        </div>

        {/* Stage pre karusel */}
        <div className="flex flex-1 items-center justify-center">
          <motion.div
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.14}
            onDragEnd={onDragEnd}
            className="relative flex h-[58vh] sm:h-[62vh] md:h-[68vh] w-full items-center justify-center cursor-grab active:cursor-grabbing"
            style={{ perspective: 1800 }}
          >
            {visibleIndices.map((offset) => {
              const absIndex = active + offset;
              const index = wrap(0, count, absIndex);
              const item = items[index];
              const mediaSrc = getMediaSrc(item);

              const isCenter = offset === 0;
              const dist = Math.abs(offset);

              const xOffset = offset * (isMobile ? 210 : 480);
              const scale = isCenter ? 1 : 0.82;
              const rotateY = offset * -10;
              const opacity = isCenter ? 1 : 0.18;
              const blur = isCenter ? 0 : 2;
              const brightness = isCenter ? 1 : 0.38;

              return (
                <motion.div
                  key={`${item.id}-${absIndex}`}
                  initial={false}
                  animate={{
                    x: xOffset,
                    scale,
                    rotateY,
                    opacity,
                    filter: `blur(${blur}px) brightness(${brightness})`,
                  }}
                  transition={(val) =>
                    val === 'scale' ? TAP_SPRING : BASE_SPRING
                  }
                  onClick={() => {
                    if (!isCenter) setActive((prev) => prev + offset);
                  }}
                  style={{
                    transformStyle: 'preserve-3d',
                    zIndex: isCenter ? 30 : 20 - dist,
                  }}
                  className={cn(
                    'absolute overflow-hidden rounded-[1.75rem] border bg-neutral-950/96 p-2 md:rounded-[2.25rem] md:p-3',
                    'w-[84vw] h-[50vh] max-w-[500px] max-h-[760px]',
                    'sm:w-[76vw] sm:h-[54vh] sm:max-w-[560px]',
                    'md:w-[min(54vw,760px)] md:h-[min(62vh,760px)]',
                    isCenter
                      ? 'border-brand/55 shadow-[0_0_80px_-20px_rgba(184,21,71,0.48)]'
                      : 'border-white/10 shadow-2xl'
                  )}
                >
                  <div className="relative h-full w-full overflow-hidden rounded-[1.15rem] bg-white md:rounded-[1.5rem]">
                    {isVideo(mediaSrc) ? (
                      <ControlledVideo
                        src={mediaSrc}
                        isActive={isCenter}
                        className="h-full w-full object-contain bg-white pointer-events-none"
                      />
                    ) : (
                      <img
                        src={mediaSrc}
                        alt={item.title}
                        className="h-full w-full object-contain bg-white pointer-events-none"
                      />
                    )}

                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/8 via-transparent to-transparent" />
                    {!isCenter && (
                      <div className="pointer-events-none absolute inset-0 bg-black/55" />
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        {/* Spodný informačný blok */}
        <div className="mt-5 rounded-[1.75rem] bg-black/72 p-4 backdrop-blur-xl md:mt-8 md:p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="min-h-[110px] flex-1">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeItem.id}
                  initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
                  transition={{ duration: 0.22 }}
                  className="space-y-2 text-center md:text-left"
                >
                  {activeItem.meta && (
                    <span className="text-[11px] font-black uppercase tracking-[0.22em] text-brand">
                      {activeItem.meta}
                    </span>
                  )}

                  <h2 className="text-2xl font-black tracking-tight text-white md:text-4xl">
                    {activeItem.title}
                  </h2>

                  {activeItem.description && (
                    <p className="mx-auto max-w-2xl text-sm font-medium text-neutral-300 md:mx-0 md:text-base">
                      {activeItem.description}
                    </p>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="flex flex-col items-center gap-4 sm:flex-row md:items-center">
              <div className="flex items-center gap-1 rounded-full bg-white/8 p-1 ring-1 ring-white/15 backdrop-blur-md">
                <button
                  onClick={handlePrev}
                  className="rounded-full p-3 text-neutral-300 transition hover:bg-brand hover:text-white active:scale-95"
                  aria-label="Predchádzajúca ukážka"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                <span className="min-w-[56px] text-center text-xs font-bold text-neutral-300">
                  {activeIndex + 1} / {count}
                </span>

                <button
                  onClick={handleNext}
                  className="rounded-full p-3 text-neutral-300 transition hover:bg-brand hover:text-white active:scale-95"
                  aria-label="Ďalšia ukážka"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              <button
                onClick={onClose}
                className="flex items-center justify-center gap-2 rounded-full bg-brand px-8 py-3.5 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-brand/30 transition-all hover:scale-105 active:scale-95"
              >
                Zobraziť report
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

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
    setTimeout(onClose, 300);
  };

  const GUIDE_ITEMS: FocusRailItem[] = [
    {
      id: 1,
      title: 'Zapojenie účastníkov',
      description:
        'Prezrite si účasť cez prehľadnú tabuľku, interaktívny graf alebo detailné karty stredísk.',
      meta: 'Funkcia 1',
      mediaSrc: '/zapojenie.mp4',
      mobileImageSrc: '/zapojenie-mobil.mp4',
    },
    {
      id: 2,
      title: 'Otvorené otázky',
      description:
        'Spoznajte najčastejšie témy cez mapu početnosti tvrdení a prečítajte si odporúčania od AI.',
      meta: 'Analýza AI',
      mediaSrc: '/otazky.mp4',
      mobileImageSrc: '/otazky-mobil.mp4',
    },
    {
      id: 3,
      title: 'Hodnotenie tímov',
      description:
        'Podrobné zhrnutie každej oblasti pre konkrétny tím, vrátane identifikácie silných stránok.',
      meta: 'Detailný pohľad',
      mediaSrc: '/tim.mp4',
      mobileImageSrc: '/tim-mobil.mp4',
    },
    {
      id: 4,
      title: 'Porovnávanie tímov',
      description:
        'Porovnajte si v danej oblasti viacero tímov naraz a odhaľte kľúčové rozdiely vo výsledkoch.',
      meta: 'Súvislosti',
      mediaSrc: '/porovnanie.mp4',
      mobileImageSrc: '/porovnanie-mobil.mp4',
    },
    {
      id: 5,
      title: 'Export súborov',
      description:
        'Každý graf alebo tabuľku si stiahnete jedným kliknutím ako čistý PNG obrázok.',
      meta: 'Prezentácia',
      mediaSrc: '/export.mp4',
      mobileImageSrc: '/export-mobil.mp4',
    },
  ];

  const content = (
    <div
      className={cn(
        'fixed inset-0 z-[99999] transition-opacity duration-300',
        isVisible ? 'opacity-100' : 'opacity-0'
      )}
    >
      <FocusRail items={GUIDE_ITEMS} onClose={handleClose} />
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
};

export default WelcomeGuide;
