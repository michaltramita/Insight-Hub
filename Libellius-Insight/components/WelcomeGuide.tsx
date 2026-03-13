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

const BASE_SPRING = { type: 'spring', stiffness: 260, damping: 30, mass: 1 };
const TAP_SPRING = { type: 'spring', stiffness: 380, damping: 24, mass: 1 };

const isVideoFile = (src: string) =>
  src.toLowerCase().endsWith('.mp4') || src.toLowerCase().endsWith('.webm');

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
      poster={poster}
      preload={isActive ? 'auto' : 'metadata'}
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

  const getMediaSrc = useCallback(
    (item: FocusRailItem) =>
      isMobile && item.mobileImageSrc ? item.mobileImageSrc : item.mediaSrc,
    [isMobile]
  );

  const getPosterSrc = useCallback(
    (item: FocusRailItem) =>
      isMobile && item.mobilePosterSrc ? item.mobilePosterSrc : item.posterSrc,
    [isMobile]
  );

  useEffect(() => {
    const preloadOffsets = [-1, 0, 1];
    const createdVideos: HTMLVideoElement[] = [];

    preloadOffsets.forEach((offset) => {
      const index = wrap(0, count, active + offset);
      const item = items[index];
      const mediaSrc = getMediaSrc(item);
      const posterSrc = getPosterSrc(item);

      if (posterSrc) {
        const img = new Image();
        img.src = posterSrc;
      }

      if (isVideoFile(mediaSrc)) {
        const video = document.createElement('video');
        video.preload = 'auto';
        video.muted = true;
        video.playsInline = true;
        video.src = mediaSrc;
        video.load();
        createdVideos.push(video);
      } else {
        const img = new Image();
        img.src = mediaSrc;
      }
    });

    return () => {
      createdVideos.forEach((video) => {
        video.src = '';
        video.load();
      });
    };
  }, [active, count, getMediaSrc, getPosterSrc, items]);

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

  const visibleIndices = [-1, 0, 1];

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
        className="absolute right-4 top-4 z-50 rounded-full bg-white/10 p-3 text-white shadow-lg backdrop-blur-md transition-all hover:scale-105 hover:bg-brand md:right-6 md:top-6"
        aria-label="Zavrieť sprievodcu"
      >
        <X className="h-6 w-6" />
      </button>

      <div className="pointer-events-none absolute inset-0 z-0 bg-black/92 backdrop-blur-[16px]" />
      <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-black/88 via-black/76 to-black/94" />
      <div className="pointer-events-none absolute inset-0 z-0 shadow-[inset_0_0_240px_rgba(0,0,0,0.62)]" />

      <div className="relative z-10 mx-auto flex h-full w-full max-w-7xl flex-col px-4 pb-4 pt-14 md:px-8 md:pb-6 md:pt-6">
        <div className="mx-auto mb-3 w-full max-w-3xl shrink-0 text-center md:mb-4">
          <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-brand backdrop-blur-md">
            Rýchly sprievodca
          </div>

          <h1 className="mt-3 text-3xl font-black tracking-tight text-white md:text-5xl">
            Vitajte v Libellius InsightHub
          </h1>

          <p className="mx-auto mt-2 max-w-2xl text-sm font-medium leading-relaxed text-neutral-300 md:text-base">
            Váš report je pripravený. Pozrite si krátky prehľad hlavných
            funkcií, vďaka ktorým sa vo výsledkoch zorientujete rýchlejšie a
            naplno využijete možnosti reportu.
          </p>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center">
          <motion.div
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.12}
            onDragEnd={onDragEnd}
            className="relative flex h-full min-h-0 w-full items-center justify-center cursor-grab active:cursor-grabbing"
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

              const xOffset = offset * (isMobile ? 185 : 400);
              const scale = isCenter ? 1 : 0.9;
              const rotateY = offset * -8;
              const opacity = isCenter ? 1 : 0.56;
              const blur = isCenter ? 0 : 0.4;
              const brightness = isCenter ? 1 : 0.72;

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
                    'absolute overflow-hidden rounded-[1.9rem] border bg-neutral-950/96 p-2 md:rounded-[2.4rem] md:p-3',
                    'h-[86%] aspect-[3/4] w-auto max-h-[760px]',
                    isCenter
                      ? 'border-brand/60 shadow-[0_0_90px_-18px_rgba(184,21,71,0.52)]'
                      : 'border-white/16 shadow-[0_18px_60px_-18px_rgba(0,0,0,0.8)]'
                  )}
                >
                  <div className="relative h-full w-full overflow-hidden rounded-[1.2rem] bg-neutral-100 md:rounded-[1.65rem]">
                    {isVideoFile(mediaSrc) ? (
                      <ControlledVideo
                        src={mediaSrc}
                        poster={posterSrc}
                        isActive={isCenter}
                        className="h-full w-full object-contain bg-neutral-100 pointer-events-none"
                      />
                    ) : (
                      <img
                        src={mediaSrc}
                        alt={item.title}
                        className="h-full w-full object-contain bg-neutral-100 pointer-events-none"
                      />
                    )}

                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/8 via-transparent to-transparent" />

                    {!isCenter && (
                      <>
                        <div className="pointer-events-none absolute inset-0 bg-black/22" />
                        <div className="pointer-events-none absolute inset-0 ring-1 ring-white/10" />
                      </>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        <div className="mt-3 shrink-0 rounded-[1.5rem] bg-black/80 p-3 backdrop-blur-xl md:mt-4 md:rounded-[1.75rem] md:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="min-h-[84px] flex-1">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeItem.id}
                  initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
                  transition={{ duration: 0.22 }}
                  className="space-y-1.5 text-center md:text-left"
                >
                  {activeItem.meta && (
                    <span className="text-[10px] font-black uppercase tracking-[0.22em] text-brand">
                      {activeItem.meta}
                    </span>
                  )}

                  <h2 className="text-xl font-black tracking-tight text-white md:text-4xl">
                    {activeItem.title}
                  </h2>

                  {activeItem.description && (
                    <p className="mx-auto max-w-2xl text-xs font-medium text-neutral-300 md:mx-0 md:text-sm">
                      {activeItem.description}
                    </p>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="flex flex-col items-center gap-3 sm:flex-row md:items-center">
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
                className="flex items-center justify-center gap-2 rounded-full bg-brand px-8 py-3 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-brand/30 transition-all hover:scale-105 active:scale-95"
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
      posterSrc: '/zapojenie-poster.jpg',
      mobilePosterSrc: '/zapojenie-mobil-poster.jpg',
    },
    {
      id: 2,
      title: 'Otvorené otázky',
      description:
        'Spoznajte najčastejšie témy cez mapu početnosti tvrdení a prečítajte si odporúčania od AI.',
      meta: 'Analýza AI',
      mediaSrc: '/otazky.mp4',
      mobileImageSrc: '/otazky-mobil.mp4',
      posterSrc: '/otazky-poster.jpg',
      mobilePosterSrc: '/otazky-mobil-poster.jpg',
    },
    {
      id: 3,
      title: 'Hodnotenie tímov',
      description:
        'Podrobné zhrnutie každej oblasti pre konkrétny tím, vrátane identifikácie silných stránok.',
      meta: 'Detailný pohľad',
      mediaSrc: '/tim.mp4',
      mobileImageSrc: '/tim-mobil.mp4',
      posterSrc: '/tim-poster.jpg',
      mobilePosterSrc: '/tim-mobil-poster.jpg',
    },
    {
      id: 4,
      title: 'Porovnávanie tímov',
      description:
        'Porovnajte si v danej oblasti viacero tímov naraz a odhaľte kľúčové rozdiely vo výsledkoch.',
      meta: 'Súvislosti',
      mediaSrc: '/porovnanie.mp4',
      mobileImageSrc: '/porovnanie-mobil.mp4',
      posterSrc: '/porovnanie-poster.jpg',
      mobilePosterSrc: '/porovnanie-mobil-poster.jpg',
    },
    {
      id: 5,
      title: 'Export súborov',
      description:
        'Každý graf alebo tabuľku si stiahnete jedným kliknutím ako čistý PNG obrázok.',
      meta: 'Prezentácia',
      mediaSrc: '/export.mp4',
      mobileImageSrc: '/export-mobil.mp4',
      posterSrc: '/export-poster.jpg',
      mobilePosterSrc: '/export-mobil-poster.jpg',
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
