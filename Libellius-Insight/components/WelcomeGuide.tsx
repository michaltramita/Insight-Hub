import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { ChevronLeft, ChevronRight, X, Sparkles } from 'lucide-react';

interface WelcomeGuideProps {
  onClose: () => void;
  clientName?: string;
  autoStartDelay?: number;
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
const TAP_SPRING = { type: 'tween', ease: [0.25, 1, 0.5, 1], duration: 1.0 };

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
      if (now - lastWheelTime.current < 420) return;

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

  const swipeConfidenceThreshold = 8500;
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

  const visibleIndices = [-2, -1, 0, 1, 2];

  const getMediaSrc = (item: FocusRailItem) =>
    isMobile && item.mobileImageSrc ? item.mobileImageSrc : item.mediaSrc;

  const getPosterSrc = (item: FocusRailItem) =>
    isMobile && item.mobilePosterSrc ? item.mobilePosterSrc : item.posterSrc;

  const isVideo = (src: string) =>
    src.toLowerCase().endsWith('.mp4') || src.toLowerCase().endsWith('.webm');

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onWheel={onWheel}
      className="relative h-[100dvh] w-full overflow-hidden text-white outline-none select-none"
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-50 rounded-full bg-white/10 p-2.5 sm:p-3 text-white shadow-lg backdrop-blur-md transition-all hover:scale-105 hover:bg-brand md:right-6 md:top-6"
        aria-label="Zavrieť sprievodcu"
      >
        <X className="h-5 w-5 md:h-6 md:w-6" />
      </button>

      <div className="relative z-10 mx-auto flex h-full w-full max-w-7xl flex-col px-4 pb-4 pt-10 sm:pt-14 md:px-8 md:pb-6 md:pt-6">
        <div className="mx-auto mb-2 w-full max-w-3xl text-center md:mb-6 shrink-0">
          <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.22em] text-brand backdrop-blur-md">
            Rýchly sprievodca
          </div>

          <h1 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl md:mt-4 md:text-5xl">
            Vitajte v Libellius InsightHub
          </h1>

          <p className="mx-auto mt-2 max-w-2xl text-xs sm:text-sm font-medium leading-relaxed text-neutral-300 md:text-base">
            Váš report je pripravený. Pozrite si krátky prehľad hlavných funkcií, vďaka ktorým sa vo výsledkoch zorientujete rýchlejšie.
          </p>
        </div>

        <div className="flex flex-1 items-center justify-center min-h-0 w-full py-2">
          <motion.div
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.12}
            onDragEnd={onDragEnd}
            className="relative flex h-full w-full items-center justify-center cursor-grab active:cursor-grabbing"
            style={{ perspective: 2200 }}
          >
            {visibleIndices.map((offset) => {
              const absIndex = active + offset;
              const index = wrap(0, count, absIndex);
              const item = items[index];
              const mediaSrc = getMediaSrc(item);
              const posterSrc = getPosterSrc(item);

              const isCenter = offset === 0;
              const dist = Math.abs(offset);
              const isVisible = dist <= 1;

              const xOffset = Math.round(offset * (isMobile ? 140 : 360));
              const rotateY = Math.round(offset * -8);

              const scale = isCenter ? 1 : 0.88;
              const opacity = isCenter ? 1 : isVisible ? 0.5 : 0;
              const blur = isCenter ? 0 : 0.6;
              const brightness = isCenter ? 1 : 0.68;

              return (
                <motion.div
                  key={`${item.id}-${absIndex}`}
                  initial={{ opacity: 0, scale: 0.85, y: 40, x: xOffset, rotateY }}
                  animate={{
                    x: xOffset,
                    y: 0,
                    scale,
                    rotateY,
                    opacity,
                    filter: `blur(${blur}px) brightness(${brightness})`,
                  }}
                  transition={{
                    default: BASE_SPRING,
                    scale: TAP_SPRING,
                  }}
                  onClick={() => {
                    if (isVisible && !isCenter) setActive((prev) => prev + offset);
                  }}
                  style={{
                    transformStyle: 'preserve-3d',
                    zIndex: isCenter ? 30 : 20 - dist,
                    willChange: 'transform',
                    backfaceVisibility: 'hidden',
                    pointerEvents: isVisible ? 'auto' : 'none',
                  }}
                  className={cn(
                    'absolute overflow-hidden rounded-[1.5rem] border bg-neutral-950/96 p-1.5 md:rounded-[2.4rem] md:p-3',
                    'aspect-[3/4] h-full max-h-[48vh] sm:max-h-[54vh] md:max-h-[62vh] max-w-[75vw] md:max-w-none w-auto',
                    isCenter
                      ? 'border-brand/60 shadow-[0_0_90px_-18px_rgba(184,21,71,0.52)]'
                      : 'border-white/14 shadow-[0_18px_60px_-18px_rgba(0,0,0,0.8)]'
                  )}
                >
                  <div className="relative h-full w-full overflow-hidden rounded-[1.1rem] bg-black md:rounded-[1.65rem]">
                    {isVideo(mediaSrc) ? (
                      <ControlledVideo
                        src={mediaSrc}
                        poster={posterSrc}
                        isActive={isCenter}
                        className="h-full w-full object-cover pointer-events-none"
                      />
                    ) : (
                      <img
                        src={mediaSrc}
                        alt={item.title}
                        className="h-full w-full object-cover pointer-events-none"
                      />
                    )}

                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/8 via-transparent to-transparent" />

                    {!isCenter && (
                      <>
                        <div className="pointer-events-none absolute inset-0 bg-black/28" />
                        <div className="pointer-events-none absolute inset-0 ring-1 ring-white/10" />
                      </>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        <div className="relative mt-auto shrink-0 p-3 sm:p-4 md:p-6">
          <div className="pointer-events-none absolute inset-0 z-0 rounded-[1.25rem] bg-neutral-900/95 ring-1 ring-white/5 md:rounded-[1.75rem]" />

          <div className="relative z-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="h-[75px] sm:h-[80px] md:h-[120px] flex-1">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={activeItem.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.22 }}
                  className="space-y-1 md:space-y-2 text-center md:text-left"
                >
                  {activeItem.meta && (
                    <span className="text-[9px] md:text-[11px] font-black uppercase tracking-[0.22em] text-brand">
                      {activeItem.meta}
                    </span>
                  )}

                  <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white md:text-4xl">
                    {activeItem.title}
                  </h2>

                  {activeItem.description && (
                    <p className="mx-auto max-w-2xl text-[11px] sm:text-xs font-medium text-neutral-300 md:mx-0 md:text-base line-clamp-2 md:line-clamp-none">
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
                  className="rounded-full p-2 md:p-3 text-neutral-300 transition hover:bg-brand hover:text-white active:scale-95"
                  aria-label="Predchádzajúca ukážka"
                >
                  <ChevronLeft className="h-4 w-4 md:h-5 md:w-5" />
                </button>

                <span className="min-w-[48px] md:min-w-[56px] text-center text-[10px] md:text-xs font-bold text-neutral-300">
                  {activeIndex + 1} / {count}
                </span>

                <button
                  onClick={handleNext}
                  className="rounded-full p-2 md:p-3 text-neutral-300 transition hover:bg-brand hover:text-white active:scale-95"
                  aria-label="Ďalšia ukážka"
                >
                  <ChevronRight className="h-4 w-4 md:h-5 md:w-5" />
                </button>
              </div>

              <button
                onClick={onClose}
                className="flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-2.5 text-[11px] md:text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-brand/30 transition-all hover:scale-105 active:scale-95 md:px-8 md:py-3.5"
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

const WelcomeGuide: React.FC<WelcomeGuideProps> = ({ onClose, autoStartDelay = 1500 }) => {
  const [isVisible, setIsVisible] = useState(autoStartDelay === 0);
  const isSharedView = typeof window !== 'undefined' && window.location.hash.startsWith('#report=');
  const hasAutoStarted = useRef(false); // Toto zabráni opätovnému spusteniu

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    // Spustí sa LEN RAZ (hasAutoStarted.current === false) a len pre klienta
    if (autoStartDelay > 0 && isSharedView && !hasAutoStarted.current) {
      hasAutoStarted.current = true;
      timer = setTimeout(() => {
        setIsVisible(true);
      }, autoStartDelay);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [autoStartDelay, isSharedView]);

  useEffect(() => {
    if (isVisible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isVisible]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 1500); 
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
      posterSrc: '/zapojenie-poster.png',
    },
    {
      id: 2,
      title: 'Otvorené otázky',
      description:
        'Spoznajte najčastejšie témy cez mapu početnosti tvrdení a prečítajte si odporúčania od AI.',
      meta: 'Analýza AI',
      mediaSrc: '/otazky.mp4',
      mobileImageSrc: '/otazky-mobil.mp4',
      posterSrc: '/otazky-poster.png',
    },
    {
      id: 3,
      title: 'Hodnotenie tímov',
      description:
        'Podrobné zhrnutie každej oblasti pre konkrétny tím, vrátane identifikácie silných stránok.',
      meta: 'Detailný pohľad',
      mediaSrc: '/tim.mp4',
      mobileImageSrc: '/tim-mobil.mp4',
      posterSrc: '/tim-poster.png',
    },
    {
      id: 4,
      title: 'Porovnávanie tímov',
      description:
        'Porovnajte si v danej oblasti viacero tímov naraz a odhaľte kľúčové rozdiely vo výsledkoch.',
      meta: 'Súvislosti',
      mediaSrc: '/porovnanie.mp4',
      mobileImageSrc: '/porovnanie-mobil.mp4',
      posterSrc: '/porovnanie-poster.png',
    },
    {
      id: 5,
      title: 'Export súborov',
      description:
        'Každý graf alebo tabuľku si stiahnete jedným kliknutím ako čistý PNG obrázok.',
      meta: 'Prezentácia',
      mediaSrc: '/export.mp4',
      mobileImageSrc: '/export-mobil.mp4',
      posterSrc: '/export-poster.png',
    },
  ];

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      {/* PLÁVAJÚCE TLAČIDLO (FAB) */}
      {!isVisible && isSharedView && (
        <div className="fixed bottom-6 left-4 sm:bottom-10 sm:left-8 z-[90]">
          {/* DESKTOP */}
          <button
            onClick={() => setIsVisible(true)}
            className="hidden xl:flex group items-center bg-white border border-black/5 rounded-full h-[54px] pl-4 pr-4 hover:pr-6 transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] shadow-[0_8px_30px_rgb(0,0,0,0.12)] cursor-pointer"
          >
            <Sparkles className="w-6 h-6 text-brand shrink-0" />
            <div className="grid grid-cols-[0fr] group-hover:grid-cols-[1fr] transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]">
              <span className="overflow-hidden whitespace-nowrap font-black text-[11px] sm:text-[12px] uppercase tracking-[0.15em] text-black flex items-center">
                <span className="pl-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">
                  Sprievodca reportom
                </span>
              </span>
            </div>
          </button>

          {/* MOBIL */}
          <button
            onClick={() => setIsVisible(true)}
            className="xl:hidden flex items-center justify-center bg-white border border-black/5 rounded-full h-[54px] w-[54px] shadow-[0_8px_30px_rgb(0,0,0,0.12)] text-brand active:scale-95 transition-transform"
          >
            <Sparkles className="w-6 h-6" />
          </button>
        </div>
      )}

      <AnimatePresence>
        {isVisible && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5, ease: [0.25, 1, 0.5, 1] }}
              className="fixed inset-0 z-[99998] bg-black/90 backdrop-blur-[14px]"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-black/86 via-black/72 to-black/92" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03),transparent_30%)]" />
              <div className="absolute inset-0 shadow-[inset_0_0_220px_rgba(0,0,0,0.55)]" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5, ease: [0.25, 1, 0.5, 1] }}
              className="fixed inset-0 z-[99999] pointer-events-auto"
            >
              <FocusRail items={GUIDE_ITEMS} onClose={handleClose} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>,
    document.body
  );
};

export default WelcomeGuide;
